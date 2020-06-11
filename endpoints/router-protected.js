const express = require('express');
const bodyParser = require('body-parser');
const passport = require('passport');
const mongoose = require('mongoose');
const fs = require('fs');
const multer = require("multer");
const GridFsStorage = require("multer-gridfs-storage");
const crypto = require("crypto");
const path = require("path");
const util = require('util');
const async = require('async');
const {DATABASE_URL, TEST_DATABASE_URL} = require('../config');

const {Content, File} = require('../models/content');
const {validateFields} = require('./validators');

const router = express.Router();
const jwtAuth = passport.authenticate('jwt', { session: false });

router.use(bodyParser.json({limit: '50mb', extended: true}));

let gfs
const mongoConn = mongoose.connection;

mongoConn.once("open", () => {
  gfs = new mongoose.mongo.GridFSBucket(mongoConn.db, {
    bucketName: "fs"
  });

  const storage = new GridFsStorage({
    url: mongoConn.client.s.url,
    file: (req, file) => {
      return new Promise((resolve, reject) => {
        crypto.randomBytes(16, (err, buf) => {
          if (err) {
            return reject(err);
          }
          const filename = buf.toString("hex") + path.extname(file.originalname);
          const fileInfo = {
            filename: filename,
            bucketName: 'fs'
          };
          resolve(fileInfo);
        });
      });
    }
  });

  const upload = multer({storage});

  //uploads only the text-based fields for a content entry
  //returns a promise that resolves with the inserted document
   function insertContent(fieldsObject) {
     return new Promise(function(resolve, reject) {
       Content
         .create({
           artistName: fieldsObject.artistName,
           title: fieldsObject.title,
           description: fieldsObject.description,
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

  function insertUrlSubDoc(contentId, file) {
    //console.log('****file passed to insertUrlSubDoc is', file);
    return new Promise(function(resolve, reject) {
      Content.
      findByIdAndUpdate(
        contentId,
        {$push:
          {files: {
            fileType: 'video',
            fileUrl: file
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

  //inserts file subDoc into mongo and returns the parent doc
  function insertFileSubDoc(contentId, uploadedFile) {
    return new Promise(function(resolve, reject) {
      // console.log('uploadedfile passed to insertFileSubDoc is', uploadedFile)
      Content.
      findByIdAndUpdate(
        contentId,
        {$push:
          {files: {
            fileType: uploadedFile.mimetype,
            fileName: uploadedFile.filename,
            fileId: uploadedFile.id
          }}
        },
        {'new': true})
      .then(updatedDoc => {
        // console.log('inserted subDoc and this is the updated doc', updatedDoc);
        resolve(updatedDoc);
      })
      .catch(err => reject(err));
    })
  }

  function uploadSubDoc(file, contentId) {
    //console.log('file passed to uploadSubdoc is', file);
    return new Promise(async function(resolve, reject) {
      try {
        let modifiedDoc
        if(file.originalname) {
          modifiedDoc = await insertFileSubDoc(contentId, file);
        } else {
          // console.log('there is no file.originalFilename')
          modifiedDoc = await insertUrlSubDoc(contentId, file);
        }
        // console.log('subDoc was inserted', modifiedDoc);
        resolve(modifiedDoc);
      } catch(err) {
        // console.log('there was an error in uploading subDoc', err);
        reject(err);
      }
    })
  }

  function uploadSubDocs(files, contentId) {
    //console.log('files passed to uploadSubDocs is', files)
    return Promise.all(files.map(file => {
      return uploadSubDoc(file, contentId)
    }))
  }

  router.post('/content', jwtAuth, upload.array('files'), (req, res) => {
    //console.log('req.body is', req.body)
    //console.log('req.files is', req.files)
    const content = req.body;
    let files = [];
    if(req.files.length) {
      files.push(...req.files)
    }
    if(req.body.files) {
      if (Array.isArray(req.body.files)) {
        files.push(...req.body.files)
      } else {
        files.push(req.body.files)
      }
      delete req.body.files;
    }
    //console.log('files is', files)
    insertContent(content)
      .then(insertedContent => {
        //console.log('insertedContent is', insertedContent)
        return uploadSubDocs(files, insertedContent.id) //resolves with the complete doc
          .then(completedDocArray => {
            //console.log('completedDocArray[completedDocArray.length-1] is', completedDocArray[completedDocArray.length-1])
            res.status(201).json(completedDocArray[completedDocArray.length-1].serialize())
          })
          .catch((err) => {
            //console.log('sending an error back 1')
            res.status(500).json({error: err});
          })
      })
      .catch((err) => {
        // console.log('sending an error back 2')
        res.status(500).json({error: err});
      })
  })

  //queries mongo for parent Content doc of files that need to be removed
  //finds which of those files have corresponding gridFs files and makes array of the gridFs ids
  //callsremoveSubDocs and if need be, called removeFiles and passes on array of gridFs ids
  //returns a promise which resolves to the parent Content doc, after subdocs were removed
  function remSubDocsAndFiles(subDocIdsArray, contentId) {
    return new Promise(function(resolve, reject) {
      Content.findById(contentId, function (err, contentDoc) {
        if(err) {
          res.status(500).json({error: err});
        }
        let removeFromGfs = [];
        contentDoc.files.forEach(e => {
          if(e.fileId) {
            removeFromGfs.push(e.fileId);
          }
        });
        //console.log('removeFromGfs array is', removeFromGfs)
        removeSubDocs(subDocIdsArray, contentId)
          .then(modifiedDoc => {
            // console.log('removed subDocs and modifiedDoc is', modifiedDoc);
            if(removeFromGfs.length) {
              //console.log('calling removeFiles')
              removeFiles(removeFromGfs)
                .then(() => {
                  resolve(modifiedDoc)
                })
             } else {
               resolve(modifiedDoc)
             }
          })
       })
    })
  }

  //takes array of file ids and the parent id as argument, removes all fils subdocs that
  //match the file id and returns the post-edited parent doc of
  function removeSubDocs(subDocIdsArray, contentId){
    //console.log('doing removeSubDocs');
    return new Promise(function(resolve, reject) {
      Content.findByIdAndUpdate( //first delete the file from the Content collection
        contentId,
        {$pull: {files: {_id: {$in: (subDocIdsArray)}}}},
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

  // accepts an array of file ids, deletes the associated files from
  // grid fs and returns an array of the files deleted
  function removeFiles(gfsIdsArray){
    return Promise.all(gfsIdsArray.map(id => {
      gfs.delete(new mongoose.Types.ObjectId(id), (err, data) => {
        if (err) {
          //console.log('there was an err in deleting files', err)
          return err;
        } else {
          //console.log('success in deleting file', data)
          return data
        }
      })
    }))
  }

  // patch endpoint for a text-based field. replaces the field with the new
  // entry and returns the full parent doc
  router.patch('/content/:contentId', jwtAuth, (req, res) => {
    const contentId = req.params.contentId;
    Content
      .findByIdAndUpdate(
        contentId,
        req.body,
        {new: true}
      )
      .then(edited => {
        res.status(201).json(edited.serialize())
      })
      .catch(err => {
      console.error(err);
      res.status(500).json({error: 'Something went wrong'});
      })
  })

  //patch endpoint for a file. accepts file removal and additions
  //and returns the parent doc that was edited
  router.patch('/files/:contentId', jwtAuth, upload.array('files'), async (req, res) => {
    // //for editing the files (subdocs in mongod and files in gridFs)
    const contentId = req.params.contentId;
    // //console.log('you reached patch endpoint and contendId is', contentId);
    // console.log(
    // 'server:',
    //   'req.files is', req.files,
    // )
    const addFiles = req.files ? req.files : [];
    const deleteFiles = [];

    console.log('req.body.files is', req.body.files)
    if(req.body.files) {
      const files = Array.isArray(req.body.files) ? req.body.files : [req.body.files];
      files.forEach(e => {
        if(e.charAt(0) === '/') { //that means that it's a url (starts with '//'), so you're adding a video url
          addFiles.push(e)
        } else {
          deleteFiles.push(e)
        }
      })
    }

    console.log('addFiles is', addFiles);
    console.log('deleteFiles is', deleteFiles);
    //
    function successResponse(results) {
      //console.log('sending result from edited doc to the client', results);
      return res.status(200).json(results.serialize())
    }
    //
    try {
      if(addFiles.length && deleteFiles.length){ //user wants to remove and add files
        console.log('you want to add and delete files')
        let doc = await Content.findById(contentId);
        return remSubDocsAndFiles(deleteFiles, contentId)
        .then(modifiedParentDoc => {
          return uploadSubDocs(addFiles, contentId)
            .then(modifiedDocArray => {
              // console.log('sending back this modified parent doc', modifiedDocArray[modifiedDocArray.length-1])
              successResponse(modifiedDocArray[modifiedDocArray.length-1]);
            })
        })
          ////queries Content collection and returns an array of GFS ids of files that needs to
          //be removed from GridFs
          ////calls RemoveSubDocs to actually remove the necessary file subDocs with array of subDoc Ids
          ////passes the array of GFS ids from first query on to removeFiles(array of GFS ids)
          //removeFiles() doesn't need to return anything
          //calls uploadSubDocs(addFiles, contentId) and returns the corrected Content doc to send back to client
      } else if(!addFiles.length && deleteFiles.length) {//user just wants to remove files
          //console.log('you want to just delete files')
          return remSubDocsAndFiles(deleteFiles, contentId)
            ////queries Content collection and returns an array of GFS ids of files that needs to
            //be removed from GridFs
            ////calls removeSubDocs to actually remove the necessary file subDocs with array of subDoc Ids
            ////passes the array of GFS ids from first query on to removeFiles(array of GFS ids)
            ////removeSubDocs needs to return the completed Content doc back to the client
            //removeFiles() doesn't need to return anything
            .then(modifiedParentDoc => {
              //console.log('modifiedDocArray is', modifiedParentDoc)
              successResponse(modifiedParentDoc);
            })
        } else if(addFiles.length && !deleteFiles.length) {//user just wants to add files
          console.log('you want to just add files')
          return uploadSubDocs(addFiles, contentId)
            .then(modifiedDocArray => {
              //console.log('modifiedDoc sending back is',
              // modifiedDocArray
               // modifiedDocArray[modifiedDocArray.length-1])
              successResponse(modifiedDocArray[modifiedDocArray.length-1]);
            })
        }
      } catch(err) {
        res.status(500).json({error: err});
      }
  });


  // delete endpoint for full document
  router.delete('/content/:contentId', jwtAuth, (req, res) => {
    //console.log('request reached the endpoint and the contentId is:', req.params.contentId);
    Content
      .findByIdAndRemove(req.params.contentId)
      .then((deletedContent) => {
        // console.log('the content that was deleted from Mongo is:', deletedContent);
        const deleteFiles = deletedContent.files.map(e => {
          if(e.fileId) {
            return e.fileId
          }
        });
        // console.log('deleteFiles are:', deleteFiles);
        return Promise.all(deleteFiles.map(fileId => {
          gfs.delete(new mongoose.Types.ObjectId(fileId), (err, data) => {
            if (err) {
              // console.log('there was an error when deleting content', err)
              return res.status(500).json({error: 'Something went wrong'});
            }
          })
        })).then(() => res.status(204).end())
      })
      .catch(err => {
        console.error(err);
        res.status(500).json({error: 'Something went wrong'});
      })
  });

});





module.exports = {router};
