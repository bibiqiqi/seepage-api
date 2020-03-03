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

//get endpoint for all content in mongo (doesn't return files stored in gridFS)
router.get('/', (req, res) => {
  Content
    .find()
    .sort({category: 'asc'})
    .then(contents => {
      res.json(contents.map(content => content.serialize()));
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ error: 'something went wrong' });
    });
});

//get endpoint for 1 file in gridFS
router.get('/files/:fileId', (req, res) => {
  //console.log('req.params.fileId is', req.params.fileId);
  gfs.files.find({id: req.params.fileId}, function(err, file) {
      if (err) {
        return;
      }
      if (!file) {
        return res.status(404).json({
          error: 'file doesnt exist'
        });
      }
      //console.log('file was found', file);
      const readStream = gfs.createReadStream({_id: req.params.fileId});
      readStream.pipe(res);
    }
  )
})

module.exports = {router};
