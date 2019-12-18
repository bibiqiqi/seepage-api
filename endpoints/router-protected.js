const express = require('express');
const bodyParser = require('body-parser');
const passport = require('passport');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Grid = require('gridfs-stream');
const util = require('util');
const multiparty = require('multiparty');
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

//uses multiparty to parse a multipart form request and return an object with files and fields keys
function parseForm(request) {
  return new Promise(function(resolve, reject) {
    let resolveObject = {};
    const form = new multiparty.Form();
    form.parse(request, function(err, fields, files) {
      if(err){
        //console.log('sending a promise rejection from multiparty parsing');
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

//uses grid-fs stream to write file to GridFS, and promise resolves with the uploaded file
//called by uploadTandF()
function uploadFile(file, fileName){
  return new Promise(function(resolve, reject) {
    const writestream = gfs.createWriteStream({filename: fileName});
    fs.createReadStream(file.path).pipe(writestream);
    writestream.on("error", (error) => {
      console.log('returning a promise reject from trying to write files to gridfs');
      reject(error)
    });
    writestream.on("close", (uploadedFile) => resolve(uploadedFile));
  });
}

router.post('/content', jwtAuth, (req, res ) => {

//uploads only the text-based fields for a content entry
//returns a promise that resolves with the inserted document
 function insertContent(fieldsObject, fileObjects) {
   return new Promise(function(resolve, reject) {
     Content
       .create({
         artistName: fieldsObject.artistName[0],
         title: fieldsObject.title[0],
         category: fieldsObject.category,
         tags: fieldsObject.tags,
         files: fileObjects
       }, function(err, insertedContent) {
         if(err) {
           console.log('returning promise reject from Content.create in mongo');
           reject(err)
         } else {
           console.log('returning promise resolve from Content.create in mongo');
           resolve(insertedContent)
         }
      })
   })
}
//calls parseForm to parse the multipart form,
//validateFields to validate the text-fields,
//uploadFile to insert the file into gridFs
//and then inserts the fields into mongo with the file id
  function parseAndInsert(request) {
    return new Promise(async function(resolve, reject) {
      //parse text and files fields
      const parsed = await parseForm(request);
      //console.log('parsed results are:', parsed);
      const {files, fields} = parsed;
      console.log('parsed files are', files);
      console.log('parsed fields are', fields);
      validateFields(fields).then(async (fields) => {
        const {artistName, title} = fields;
        const _artistName = artistName[0].replace(/ /g, '_');
        const _title = title[0].replace(/ /g, '_');
        return Promise.all(files.map((file, index) => {
          const fileName = `${_artistName}_${_title}_${index}`;
          return new Promise(async function (resolve, reject) {
            const fileObject = {};
            fileObject.type = file.headers['content-type'];
            fileObject.name = fileName;
            const uploadedFile = await uploadFile(file, fileName);
            fileObject.fileId = await uploadedFile._id;
            resolve(fileObject);
          })
        })).then(async (fileObjects) => {
          console.log('fileObjects are:', fileObjects);
          const insertedContent = await insertContent(fields, fileObjects);
          console.log('insertedContent is:', insertedContent);
          resolve(insertedContent);
        }).catch(error => reject(error))
      }).catch(error => reject(error))
    });
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
  //patch only accepts 1 text field to edit at a time
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
    })
    .catch(err => {
    console.error(err);
    res.status(500).json({error: 'Something went wrong'});
    })
})


router.patch('/files/:contentId', jwtAuth, (req, res) => {
  const contentId = req.params.contentId;

  //removes thumbNails from array of ids (filesArray) and returns the new thumbnails from
  //the modified doc
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

  //removes files from array of ids (filesArray) and returns the new files from
  //the modified doc
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

  //calls removeThumbNails and removeFiles and returns the current array of thumbnails after removal
  function removeTnsAndFiles(fields){
    return new Promise(async function(resolve, reject) {
      const postRemoveTn = await removeThumbNails(fields, contentId);
      console.log('postRemoveTn is', postRemoveTn);
      await removeFiles(fields);
      resolve(postRemoveTn)
    })
  }

//queries mongo to pass on artistName, title, and number of thumbnails currently in mongo
//calls uploadTandF and resolves with an array of the thumbNails that were uploaded
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

  //determines whether to call removeTnsAndFile or uploadTnsAndFiles or both
  //and returns a promise that resolves with the new array of thumbNails
  //called by parseAndEdit
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

//calls parseForm and then editTnsAndFiles and returns promise which resolves with the new array of thumbnails
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

//queries mongo by id of content entry and removes document
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
