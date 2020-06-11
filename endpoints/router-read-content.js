require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const passport = require('passport');
const mongoose = require('mongoose');

const {Content} = require('../models/content');

const router = express.Router();

let gfs
const mongoConn = mongoose.connection;
mongoConn.once("open", () => {
  console.log('mongoose connection is open')
  gfs = new mongoose.mongo.GridFSBucket(mongoConn.db, {
    bucketName: "fs"
  });
});

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
router.get('/files/:filename', (req, res) => {
  const filename = req.params.filename;
  const readableStream = gfs.openDownloadStreamByName(filename);
  readableStream.pipe(res);
  readableStream.on('error', () => {
    res.status(500).json({ error: 'something went wrong' });
  });
})

module.exports = {router};
