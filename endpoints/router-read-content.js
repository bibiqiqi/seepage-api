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
    .select('-thumbNails')
    .sort({category: 'asc'})
    .then(contents => {
      res.json(contents.map(content => content.serialize()));
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ error: 'something went wrong' });
    });
});

//mediaTypes:
//image, video, audio, text
router.get('/thumbnails/:contentId', (req, res) => {
  Content
    .findById(req.params.contentId)
    .select('thumbNails')
    .then(thumbNails => {
      //console.log(thumbNails);
      res.contentType('json');
      res.send(thumbNails);
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ error: 'something went wrong' });
    });
});

router.get('/files/:contentId/:key', (req, res) => {
  const key = parseInt(req.params.key);
  console.log('req.params.contentId is', req.params.contentId);
  console.log('key is', key, 'and the type is: ', typeof key);
  gfs.files.findOne(
    {
      $and: [
        {'metadata.contentId' : req.params.contentId},
        { 'metadata.key': key }
      ]
    }, function(err, file) {
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
      console.log(file);
      console.log('id is:', file._id)
      gfs.createReadStream({_id: file._id}).pipe(res);
    }
  )
})

module.exports = {router};
