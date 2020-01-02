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
const async = require('async');
const Binary = require('mongodb').Binary;

const {DATABASE_URL} = require('../config');
const {Content, File} = require('../models/content');
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

//uses multiparty to parse incoming multipart/form data
//saves to tmp dir and returns an object with fields and files key/value pairs
function parseForm(request) {
  return new Promise(function(resolve, reject) {
    let resolveObject = {};
    const form = new multiparty.Form();
    form.parse(request, function(err, fields, files) {
      if(err){
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

//uploads only the text-based fields for a content entry
//returns a promise that resolves with the inserted document
 function insertContent(fieldsObject) {
   return new Promise(function(resolve, reject) {
     Content
       .create({
         artistName: fieldsObject.artistName[0],
         title: fieldsObject.title[0],
         category: fieldsObject.category,
         tags: fieldsObject.tags,
       }, function(err, insertedContent) {
         if(err) {
           //console.log('returning promise reject from insertContent in mongo');
           reject(err)
         } else {
           //console.log('returning promise resolve from insertContent in mongo');
           resolve(insertedContent)
         }
      })
   })
}

//generates fileName and returns it. called by uploadFilesAndSubDocs
function makeFileName(doc, file, index) {
  const ext = file.originalFilename.split('.').slice(-1).join('.');
  const _artistName = doc.artistName.replace(/ /g, '_');
  const _title = doc.title.replace(/ /g, '_');
  const fileName = `${_artistName}_${_title}_${index}.${ext}`;
  return fileName
}

//inserts file subDoc into mongo and returns the parent doc
function insertSubDoc(contentId, uploadedFile, fileName) {
  return new Promise(function(resolve, reject) {
    Content.
    findByIdAndUpdate(
      contentId,
      {$push:
        {files: {
          fileType: uploadedFile.metadata.fileType,
          fileName: fileName,
          fileId: uploadedFile._id
        }}
      },
      {'new': true})
    .then(updatedDoc => {
      //console.log('inserted subDoc and this is the updated doc', updatedDoc);
      resolve(updatedDoc);
    })
    .catch(err => reject(err));
  })
}

//takes array of file ids and the parent id as argument, removes all fils subdocs that
//match the file id and returns the post-edited parent doc of
function removeSubDocs(filesIdsArray, contentId){
  //console.log('doing removeSubDocs');
  return new Promise(function(resolve, reject) {
    Content.findByIdAndUpdate( //first delete the file from the Content collection
      contentId,
      {$pull: {files: {fileId: {$in: (filesIdsArray)}}}},
      {'new': true},
      (error, modified) => {
        if (error) {
          //console.log('returning a promise reject from trying to remove fileSubdocs in mongo')
          reject(error)
        } else {
          //console.log('returning a promise resolve from trying to remove fileSubdocs in mongo:', modified)
          resolve(modified)
        }
      }
    )
  })
}

//uses grid-fs stream to write file to GridFS, and promise resolves with the uploaded file
function uploadFile(file, fileName){
  return new Promise(function(resolve, reject) {
    const fileType = file.headers["content-type"];
    const writestream = gfs.createWriteStream(
      {
        filename: fileName,
        metadata: {
          fileType: fileType
        }
      }
    );
    fs.createReadStream(file.path).pipe(writestream);
    writestream.on("error", (error) => {
      //console.log('returning a promise reject from trying to write files to gridfs');
      reject(error)
    });
    writestream.on("close", (uploadedFile) => {
      resolve(uploadedFile);
    })
  });
}

//called after uploadFile to delete the files that multiparty writes to disk,
//once the file has been uploaded to gridFS
function deleteTempFile(file) {
  return new Promise(function(resolve, reject) {
    var filePath = file.path;
    fs.unlink(filePath, function(err){
      if(err) {
        reject(err)
      } else {
        resolve();
      }
    });
  })
}

//accepts the array of files that need to be uploaded, and maps all the necessary
//functions to upload the file subdocs to mongo and files to gridFS
function uploadFilesAndSubDocs(files, doc){
  return Promise.all(files.map((file, index) => {
    //console.log('doing uploadFilesAndSubDocs');
    return new Promise(async function(resolve, reject) {
      let fileName = makeFileName(doc, file, index);
      let uploadedFile = await uploadFile(file, fileName);
      //console.log('file was uploaded', uploadedFile);
      let deletedTempFiles = await deleteTempFile(file);
      //console.log('subDoc was prepared', preparedSubDoc);
      let modifiedDoc = await insertSubDoc(doc.id, uploadedFile, fileName);
      //console.log('subDoc was inserted', modifiedDoc);
      resolve(modifiedDoc);
    })
  }))
}

//accepts an array of file ids, deletes the associated files from
//grid fs and returns an array of the files deleted
function removeFiles(filesArray){
  //console.log('doing removeFiles with ');
  return new Promise(function(resolve, reject) {
     gfs.files
       .deleteMany(
         {_id : {$in: filesArray}},
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

//post endpoint for new content entry - uploads parent and child doc at once
router.post('/content', jwtAuth, (req, res ) => {
  const form = new multiparty.Form();
  const content = {};
  try {
    parseForm(req)
      .then(parseObject => {
        return new Promise(async function(resolve, reject) {
          const {fields, files} = parseObject
          let insertedContent = await insertContent(fields);
          let uploadedDoc = await uploadFilesAndSubDocs(files, insertedContent)
          resolve(uploadedDoc)
        }).then(insertedSubDocs => {
          console.log('sending this inserted doc to the client', insertedSubDocs[0]);
          res.json(insertedSubDocs[0].serialize())
        })
      })
  } catch(err) {
    res.status(500).json({error: err});
  }
});

//patch endpoint for a text-based field. replaces the field with the new
//entry and returns the full parent doc
router.patch('/content/:contentId', jwtAuth, (req, res) => {
  const contentId = req.params.contentId;
  Content
    .findByIdAndUpdate(
      contentId,
      req.body,
      {new: true}
    )
    .then(edited => {
      res.json(edited.serialize())
    })
    .catch(err => {
    console.error(err);
    res.status(500).json({error: 'Something went wrong'});
    })
})

//patch endpoint for a file. accepts file removal and additions
//and returns the parent doc that was edited
router.patch('/files/:contentId', jwtAuth, (req, res) => {
  //for editing the files (subdocs in mongod and files in gridFs)
  const contentId = req.params.contentId;
  const form = new multiparty.Form();

  try {
    parseForm(req)
      .then(async parsedObject => {

        const {files: addFiles, fields} = parsedObject;
        const deleteFiles = fields.files;

        function successResponse(results) {
          //console.log('sending result from edited doc to the client', results);
          res.json(results.serialize())
        }

        if(addFiles && deleteFiles){ //user wants to remove and add files
          let doc = await Content.findById(contentId);
          return Promise.all([
            removeSubDocs(deleteFiles, contentId),
            removeFiles(deleteFiles),
            uploadFilesAndSubDocs(addFiles, doc)
          ]).then(modifiedDocArray => {
              // successResponse(modifiedDocArray[2][0].files);
              successResponse(modifiedDocArray[2][0]);
            })
        } else if(!addFiles && deleteFiles) {//user just wants to remove files
          return Promise.all([
            removeSubDocs(deleteFiles, contentId),
            removeFiles(deleteFiles)
          ]).then(modifiedDocArray => {
              //console.log('success!');
              successResponse(modifiedDocArray[0]);
            })
        } else if(addFiles && !deleteFiles) {//user just wants to add files
          Content.findById(contentId)
            .then(doc => {
              uploadFilesAndSubDocs(addFiles, doc)
                .then(modifiedDocArray => {
                  successResponse(modifiedDocArray[0]);
                })
            })
        }
     })
  } catch(err) {
    res.status(500).json({error: err});
  }
});

//delete endpoint for full document
router.delete('/content/:contentId', jwtAuth, (req, res) => {
  //console.log('request reached the endpoint and the contentId is:', req.params.contentId);
  Content
  .findByIdAndRemove(req.params.contentId)
  .then((res) => {
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
