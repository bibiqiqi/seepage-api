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

//parse the multiform data into field and files,
//upload fields to mongo and retrieve the Id
//upload files to GridFs with the contentId attached
router.post('/content', jwtAuth, (req, res ) => {
  //parse text and files fields
  const form = new multiparty.Form();
  let filesArray;
  return new Promise(function(resolve, reject) {
    form.parse(req, function(err, fields, files) {
      if(err){
        console.log('theres an err', err);
      }
      //console.log('parsed fields is', JSON.stringify(fields));
      console.log('parsed fields is', util.inspect(fields, false, null, true));
      //console.log('title is a', typeof(fields.title[0]));
      //console.log('artistName is a', typeof(fields.artistName[0]));
      //console.log('parsed files is', files);
      filesArray = files.files.map((e, i) => {
        e.key = i;
        return e;
      })
      //console.log('filesArray is', filesArray);
      resolve(fields);
    });
  })
  .then(fieldsObject => {
    validateFields(fieldsObject)
      .then(fields => {
        //insert all the content except for the thumbnails into mongodb
        //console.log('inserting content document');
        Content
          .create({
            artistName: fields.artistName[0],
            title: fields.title[0],
            category: fields.category,
            tags: fields.tags
            //thumbnails: fields.thumbnails
          })
          .then(insertedContent => {
            //return the id for the content entry
              //console.log('content was inserted', insertedContent);
              const contentId = insertedContent.id;
              const i = 1;
              //map through the filesArray, resize the image, and save as a buffer in the thumbnail
              // TODO: how will resize work if the file is non image file
              return Promise.all(
                filesArray.map((file, x) => {
                  return new Promise(function(resolve, reject) {
                    sharp(file.path)
                      .resize(500, 500, {fit: 'cover'})
                      .toFormat('jpg')
                      .toBuffer({resolveWithObject: true})
                      .then((thumbNailBuffer) => {
                        //console.log(thumbNailBuffer);
                        //console.log(thumbNailBuffer.toString('utf8'));
                        console.log('file is', file);
                        //replace all spaces in artistName and title with _
                        const artistName = insertedContent.artistName.replace(/ /g, '_');
                        const title = insertedContent.title.replace(/ /g, '_');
                        const fileName = `${artistName}_${title}_tn${i}`;
                        console.log('fileName is a', typeof(fileName));
                        console.log('thumbNailBuffer is a', typeof(thumbNailBuffer.data));
                        Content.
                          findByIdAndUpdate(contentId,
                            {$push: {
                              thumbNails: {
                                contentId: contentId,
                                fileName: fileName,
                                data: Binary(thumbNailBuffer.data),
                                key: file.key
                                }
                              }
                            },
                            {'new': true}, (error, doc) => {
                            if (error) {
                              console.log('error is', error);
                            }
                            //console.log('modified doc is');
                            resolve(doc)
                          })
                      })
                    .catch(err => {console.log('there was an error when using sharp for this img', err)})
                  })
                  i++;
                  console.log('i++', i);
                })
              )
              .then(modified => {
                //console.log(modified, 'were modified')
                //upload all files to GridFs with the associated content id
                return Promise.all(
                 filesArray.map(function(file, i) {
                   return new Promise(function(resolve, reject) {
                     crypto.randomBytes(16, (err, buf) => {
                       if (err) {
                         return reject();
                       }
                       //const fileName = buf.toString('hex') + path.extname(file.originalFilename);
                       const fileName = `${insertedContent.artistName}_${insertedContent.title}_${i}`;
                       const fileInfo = {
                         filename: fileName,
                         metadata: {
                           contentId: contentId,
                           key: file.key
                         }
                       }
                       resolve(fileInfo);
                     })
                   })
                   .then(fileInfo => {
                     return new Promise(function(resolve,reject) {
                       const writestream = gfs.createWriteStream(fileInfo);
                       fs.createReadStream(file.path).pipe(writestream);
                       writestream.on("error",reject);
                       writestream.on("close", function(uploadedFile) {
                        //console.log(`file ${i} was uploaded`);
                        resolve(uploadedFile);
                       });
                    })
                   })
                 })
               )
             })
             .then(res.status(200).end())
             .catch(err => {
               console.error(err);
               res.status(500).json({error: 'Something went wrong'});
             })
          })
      })
   })
});

router.delete('/content/:contentId', jwtAuth, (req, res) => {
  //console.log('request reached the endpoint and the contentId is:', req.params.contentId);
  Content
  .findByIdAndRemove(req.params.contentId)
  .then((deletedContent) => {
    //console.log('the content that was deleted from Mongo is:', deletedContent);
    gfs.files
      .deleteMany({id: deletedContent.id})
      .then((deletedFiles) => {
        //console.log('the files that were deleted from Mongo are:', deletedFiles);
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

router.patch('/content/:contentId', jwtAuth, (req, res) => {
  const updateObject = req.body;
  //console.log('updateObject is', updateObject);
  const updateableFields = ['artistName', 'title', 'uploadArt', 'category', 'tags' ];
  //if user sent a field that is not in the updateable fields array, then reject the request
  Object.keys(updateObject).forEach(field => {
    if (!(updateableFields.includes(field))) {
      //console.log(`This ${util.inspect(field, {showHidden: false, depth: null})} is not an updateable field`);
      const message = `This ${field} is not an updateable field`;
      return res.status(400).send(message);
    }
  });
  Content
    .findOneAndUpdate({id : req.params.id }, updateObject, {'new': true})
    .then(response => res.status(204).end())
    .catch(err => res.status(500).json({ message: 'Something went wrong' }));
});



module.exports = {router};
