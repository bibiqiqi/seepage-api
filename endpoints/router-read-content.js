require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const passport = require('passport');
const mongoose = require('mongoose');
const Grid = require('gridfs-stream');

const {DATABASE_URL} = require('../config');
const {upload} = require('../server');
const {Content} = require('../models/content');

const router = express.Router();

//for gfs
const mongoConn = mongoose.connection;
let gfs;

//define gfs stream
mongoConn.once('open', () => {
  gfs = Grid(mongoConn.db, mongoose.mongo);
  gfs.collection('fs');
})

router.use(bodyParser.json());

//queries mongo for all content, minus the fileIds
router.get('/', (req, res) => {
  Content
    .find()
    .select('-fileIds')
    .sort({category: 'asc'})
    .then(contents => {
      res.json(contents.map(content => content.serialize()));
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ error: 'something went wrong' });
    });
});

router.get('/fileIds/:contentId', (req, res) => {
  //queries mongo for array of fileIds for specific content
  //console.log('contentId sent to this endpoint is', req.params.contentId)
  Content
    .findById(req.params.contentId)
    .select('files')
    .then(fileObjects => {
      console.log('sending back these fileObjects', fileObjects.files);
      res.contentType('json');
      res.send(fileObjects.files);
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ error: 'something went wrong' });
    });
});

router.get('/files/:fileId', (req, res) => {
  //queries GridFS for file associated with thumbnail id in request
  console.log('req.params.fileId is', req.params.fileId);
  gfs.files.find({id: req.params.fileId}, function(err, file) {
      if (err) {
        console.log(err);
        //handleError(err);
        return;
      }
      if (!file) {
        console.log('no file found!')
        return res.status(404).json({
          err: 'file doesnt exist'
        });
      }
      console.log('file was found', file);
      const readStream = gfs.createReadStream({_id: req.params.fileId});
      readStream.pipe(res);
    }
  )
})

module.exports = {router};
