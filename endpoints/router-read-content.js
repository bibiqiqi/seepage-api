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


router.get('/', (req, res) => {
  Content
    .find()
    .then(contents => {
      res.json({
        contents: contents.map(
          (content) => content.serialize())
      });
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ error: 'something went wrong' });
    });
});

router.get('/:contentId', (req, res) => {
  //console.log('req.params.contentId is', req.params.contentId);
  gfs.files.find({'metadata.contentId' : req.params.contentId}).toArray((err, files) => {
    if (!files || files.length === 0) {
      return res.status(404).json({
        err: 'No files exist'
      });
    }
    const readstream = gfs.createReadStream({id: files[0].id});
    readstream.pipe(res);
  })
});

module.exports = {router};
