const express = require('express');
const bodyParser = require('body-parser');
const passport = require('passport');
const mongoose = require('mongoose');
const fs = require('fs');
const multer = require('multer');
const GridFsStorage = require('multer-gridfs-storage');
const path = require('path');
const crypto = require('crypto');
const Grid = require('gridfs-stream');

const {DATABASE_URL} = require('../config');
const {Content} = require('../models/content');

//create storage engine
const storage = new GridFsStorage({
    url: DATABASE_URL,
    file: (req, file) => {
      return new Promise((resolve, reject) => {
        crypto.randomBytes(16, (err, buf) => {
          if (err) {
            return reject(err);
          }
          const fileName = buf.toString('hex') + path.extname(file.originalname);
          const fileInfo = {
            filename: fileName,
            bucketName: 'files',
            metadata: {contentId: req.body.contentId}
          }
          resolve(fileInfo);
        });
      });
    }
});

//for gfs
const mongoConn = mongoose.connection;
let gfs;

//define gfs stream
mongoConn.once('open', () => {
  gfs = Grid(mongoConn.db, mongoose.mongo);
  gfs.collection('fs');
})

const upload = multer({storage});
const arrUpload = upload.array('files');
const router = express.Router();

router.use(bodyParser.json({limit: '50mb', extended: true}));

const jwtAuth = passport.authenticate('jwt', { session: false });

router.post('/content', jwtAuth, (req, res) => {
  //console.log('-req.body is', req.body);
  const requiredFields = ['artistName', 'title', 'category', 'tags'];
  for (let i = 0; i < requiredFields.length; i++) {
    const field = requiredFields[i];
    if (!(field in req.body)) {
      const message = `Missing \`${field}\` in request body`;
      console.error(message);
      return res.status(400).send(message);
    }
  }
  Content
    .create({
      artistName: req.body.artistName,
      title: req.body.title,
      category: req.body.category,
      tags: req.body.tags
    })
    .then(content => res.status(201).json(content.serialize()))
    .catch(err => {
      console.error(err);
      res.status(500).json({error: 'Something went wrong'});
    })
});

router.post('/files', jwtAuth, arrUpload, (req, res, next) => {
  //console.log(req.files);
  const files = req.files;
    if (!files) {
      const error = new Error('Please upload files');
      error.httpStatusCode = 400;
      return next(error)
    }
  gfs.files
    .insertMany(req.files)
    .then(inserted => res.status(201).json(inserted))
    .catch(err => {
      console.error(err);
      res.status(500).json({ error: 'Something went wrong' });
    });
});

router.patch('/content/:shortId', jwtAuth, (req, res) => {
  const updateObject = req.body;
  console.log('req.body is:', req.body);
  const updateableFields = ['artistName', 'title', 'uploadArt', 'category', 'tags' ];
  //if user sent a field that is not in the updateable fields array, then reject the request
  req.body.forEach(field => {
    if (!(field in updateableFields)) {
      const message = `This ${field} is not an updateable field`;
      return res.status(400).send(message);
    }
 });
 Content
   .findOneAndUpdate({shortId : req.params.shortId }, updateObject, {'new': true})
    .then(response => res.status(204).end())
    .catch(err => res.status(500).json({ message: 'Something went wrong' }));
});

router.delete('/', jwtAuth, (req, res) => {
  return res.json({
  });
});

module.exports = {router};
