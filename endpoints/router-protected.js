const express = require('express');
const bodyParser = require('body-parser');
const passport = require('passport');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Grid = require('gridfs-stream');
const util = require('util');
const multiparty = require('multiparty')
const sharp = require('sharp');
const Binary = require('mongodb').Binary;

const {DATABASE_URL} = require('../config');
const {Content} = require('../models/content');
const {validateFields} = require('./validators');

const router = express.Router();
const jwtAuth = passport.authenticate('jwt', { session: false });
//for gfs
const mongoConn = mongoose.connection;
let gfs;
//define gfs stream
mongoConn.once('open', () => {
  gfs = Grid(mongoConn.db, mongoose.mongo);
  gfs.collection('fs');
})

router.use(bodyParser.json({limit: '50mb', extended: true}));

function parseForm(request) {
  return new Promise(function(resolve, reject) {
    let resolveObject = {};
    const form = new multiparty.Form();
    form.parse(request, function(err, fields, files) {
      if(err){
        console.log('sending a promise rejection from multiparty parsing');
        reject(err);
      }
      if(files) {
        //console.log('returning files from multiparty parsing');
        resolveObject.files = files.files;
      }
      if(fields) {
        //console.log('returning fields from multiparty parsing');
        resolveObject.fields = fields;
      }
      //console.log('returning parse object from parseForm');
      resolve(resolveObject);
    });
  })
}

function uploadThumbNail(file, index, contentId, artistName, title){
  return new Promise(function(resolve, reject) {
    sharp(file.path)
      .resize(500, 500, {fit: 'cover'})
      .toFormat('jpg')
      .toBuffer({resolveWithObject: true})
      .then((thumbNailBuffer) => {
        const fileName = `${artistName}_${title}_tn${index}`;
        Content.
          findByIdAndUpdate(contentId,
            {$push: {
              thumbNails: {
                contentId: contentId,
                fileName: fileName,
                data: Binary(thumbNailBuffer.data),
                }
              }
            },
            {'new': true},
            (error, doc) => {
              if (error) {
                //console.log('returning a promise reject from trying to insert thumbnails in mongo')
                reject(error)
              } else {
                console.log('after carrying out uploadThumbnail, doc.thumbnails array is now', doc.thumbNails)
                resolve(doc.thumbNails[doc.thumbNails.length-1])
              }
          })
      })
    })
  }

  function uploadFile(file, index, contentId, artistName, title, thumbNailId){
    return new Promise(function(resolve, reject) {
      const fileName = `${artistName}_${title}_${index}`;
      const fileInfo = {
        filename: fileName,
        metadata: {
          contentId: contentId,
          thumbNailId: thumbNailId
        }
      };
      const writestream = gfs.createWriteStream(fileInfo);
      fs.createReadStream(file.path).pipe(writestream);
      writestream.on("error", (error) => {
        //console.log('returning a promise reject from trying to write files to gridfs');
        reject(error)
      });
      writestream.on("close", (uploadedFile) => resolve(uploadedFile));
    })
  }

  function uploadTandF(filesArray, contentId, artistName, title, index) {
    //console.log('doing uploadTandF with this filesArray', filesArray);
    return new Promise(function(resolve, reject) {
       const _artistName = artistName.replace(/ /g, '_');
       const _title = title.replace(/ /g, '_');
       return Promise.all(filesArray.map((file) => {
         return new Promise(async function(resolve, reject) {
           try {
             let uploadedThumbNail = await uploadThumbNail(file, index, contentId, _artistName, _title);
             let fileAdded = await uploadFile(file, index, contentId, _artistName, _title, uploadedThumbNail.id);
             ++index;
             resolve(uploadedThumbNail);
           } catch(err) {
             reject(err);
           }
         })
       })).then(uploadedThumbNails => resolve(uploadedThumbNails))
    })
  }

 //parse the multiform data into field and files,
 //upload fields to mongo and retrieve the Id
 //resize files and upload them as thumbnails to the corresponding doc in mongo
 //upload files to GridFs with the contentId attached
 router.post('/content', jwtAuth, (req, res ) => {

 //define insertContent function for posting all fields
   function insertContent(fieldsObject) {
     return new Promise(function(resolve, reject) {
       Content
         .create({
           artistName: fieldsObject.artistName[0],
           title: fieldsObject.title[0],
           category: fieldsObject.category,
           tags: fieldsObject.tags
         }, function(err, insertedContent) {
           if(err) {
             //console.log('returning promise reject from Content.create in mongo');
             reject(err)
           } else {
             //console.log('returning promise resolve from Content.create in mongo');
             resolve(insertedContent)
           }
        })
     })
  }

  function parseAndInsert(request) {
    return new Promise(async function(resolve, reject) {
      //parse text and files fields
      const parsed = await parseForm(request);
      console.log('parsed results are:', parsed);
      const {files, fields} = parsed;
      let artistName, title, insertedContentId;
      validateFields(fields).then(async (fields) => {
        //console.log('validateFields succeeded')
        //insert all the content except for the thumbnails into mongodb
        const insertedContent = await insertContent(fields);
        return Promise.resolve(insertedContent);
      }).catch(error => reject(error)) //errors from validateFields promise
        .then(insertedContent => {
          console.log('passing insertedContent onto uploadTandF', insertedContent);
          uploadTandF(files, insertedContent.id, insertedContent.artistName, insertedContent.title);
        }).then(resolved => {
          console.log('returning a resolve promise from parseAndInsert');
          resolve(resolved);
          })
      }).catch(error => reject(error))  //errors from Promise.all promise
  }

  try {
   parseAndInsert(req)
    .then(resolve => {
     console.log('sending back a success message from server');
     res.status(200).end();
    })
  } catch(e) {
    console.log('sending back an error message from server');
    res.status(500).json({error: e});
  }
});


router.patch('/content/:contentId', jwtAuth, (req, res) => {
  //console.log('reached the patch endpoint!');
  //patch only accepts 1 field to edit at a time
  const contentId = req.params.contentId;
  console.log(req.body);
  Content
    .findByIdAndUpdate(
      contentId,
      req.body,
      {new: true}
    )
    .then(edited => {
      console.log('successfully updated the following:', edited);
      res.json(edited.serialize())
      //res.status(200).end();
    })
    .catch(err => {
    console.error(err);
    res.status(500).json({error: 'Something went wrong'});
    })
})


router.patch('/files/:contentId', jwtAuth, (req, res) => {
  const contentId = req.params.contentId;
  //1. return a promise of the parsed fields and files
  //fields is an object where the property names are field names and the values are arrays of field values.
  //files is an object where the property names are field names and the values are arrays of file objects.
  function removeThumbNails(filesArray, id){
    console.log('doing removeThumbNails');
    return new Promise(function(resolve, reject) {
      Content.findByIdAndUpdate( //first delete the thumbNail from the Content collection
        id,
        {$pull: {thumbNails: {_id: {$in: (filesArray).map(mongoose.Types.ObjectId)}}}},
        {new: true},
        (error, modified) => {
          if (error) {
            //console.log('returning a promise reject from trying to remove thumbnails in mongo')
            reject(error)
          } else {
            //console.log('returning a promise resolve from trying to remove thumbnails in mongo:', modified.thumbNails)
            resolve(modified.thumbNails)
          }
        }
      )
    })
  }

  function removeFiles(filesArray){
    console.log('doing removeFiles');
    return new Promise(function(resolve, reject) {
       gfs.files
         .deleteMany(
           {'metadata.thumbNailId' : {$in: filesArray}},
           function(err, files) {
             if(err){
               //console.log('returning a promise reject from trying to remove files in gridfs')
               reject(err)
             } else {
               //console.log('returning a promise resolve from trying to remove files in gridfs')
               resolve(files);
             }
           }
         )
     })
  }

  function removeTnsAndFiles(fields){
    return new Promise(async function(resolve, reject) {
      const postRemoveTn = await removeThumbNails(fields, contentId);
      console.log('postRemoveTn is', postRemoveTn);
      await removeFiles(fields);
      resolve(postRemoveTn)
    })
  }

  function uploadTnsAndFiles(files){
    return new Promise(function(resolve, reject) {
      //console.log('contentId in uploadTnsAndFiles is', contentId);
      Content.findById(contentId)
       .then(async function(doc) {
         //console.log('doc for this contentId is', doc)
         const index = doc.thumbNails.length;
         const postAddTn = await uploadTandF(files, contentId, doc.artistName, doc.title, index); //uploadTandF resolves an array of thumbNail arrays
         console.log('postAddTn is ', postAddTn);
         resolve(postAddTn)
       })
    })
  }

  function editTnsAndFiles(parsed) {
    return new Promise(async function(resolve, reject) {
      const {files, fields} = parsed;
        if(fields && files){
          //call function to removeThumbNails and removeFiles & function to uploadTandF
          const newThumbNails1 = await removeTnsAndFiles(fields.files);
          console.log('newThumbNails1 is', newThumbNails1);
          const newThumbNails2 = await uploadTnsAndFiles(files);
          console.log('newThumbNails2 is', newThumbNails2);
          const newThumbNails3 = newThumbNails1.concat(newThumbNails2);
          console.log('newThumbNails3 is', newThumbNails3);
          resolve(newThumbNails3)
        } else if(fields && !files){
          //call function to removeThumbNails
          const newThumbNails = await removeTnsAndFiles(fields.files);
          resolve(newThumbNails)
        } else if(files && !fields){
          //call function to removeFiles
          const newThumbNails = await uploadTnsAndFiles(files);
          resolve(newThumbNails)
        }
    })
  }

  function parseAndEdit(request){
    return new Promise(async function(resolve, reject) {
      const parsed = await parseForm(request);
      //console.log('parsed results are:', parsed);
      const newTnArray = await editTnsAndFiles(parsed); //returns the final new array of thumbNails to update the state with
      resolve(newTnArray);
    })
  }

  parseAndEdit(req)
    .then(newTnArray => {
      console.log('sending this array of thumbNails to the client', newTnArray);
      res.contentType('json');
      res.send(newTnArray);
    })
})

router.delete('/content/:contentId', jwtAuth, (req, res) => {
  //console.log('request reached the endpoint and the contentId is:', req.params.contentId);
  Content
  .findByIdAndRemove(req.params.contentId)
  .then((deletedContent) => {
    //console.log('the content that was deleted from Mongo is:', deletedContent);
    gfs.files
      .deleteMany({id: deletedContent.id})
      .then(() => {
        res.status(204).end();
      })
      .catch(err => {
        console.error(err);
        res.status(500).json({ error: 'Something went wrong' });
      });
  })
  .catch(err => {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  })
});



module.exports = {router};
