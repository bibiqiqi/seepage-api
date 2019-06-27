require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const passport = require('passport');
const mongoose = require('mongoose');
const Grid = require('gridfs-stream');
const ss = require('stream-stream');

const {DATABASE_URL} = require('../config');
const {upload} = require('../server');
const {Content} = require('../models/content');

const router = express.Router();
const stream = ss({
  separator: '\n',
});
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
  console.log('you sent this req', req.body);
  Content
    .find()
    .sort({category: 'asc'})
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

//mediaTypes:
//image, video, audio, text

router.get('/:contentId', (req, res) => {
  console.log('req.params.contentId is', req.params.contentId);
  gfs.files.find({'metadata.contentId' : req.params.contentId}).toArray((err, files) => {
    console.log('the files found in gfs are:', files);
    if (!files || files.length === 0) {
      return res.status(404).json({
        err: 'No files exist'
      });
    }
    //if file type === images, send them back as an array of files
    //if file type === video, send back as a stream of video
    files.forEach(function(file, i) {
      stream.write(gfs.createReadStream(file));
    });
    stream.end();
    stream.pipe(res);
    // let combinedStream = CombinedStream.create();
    //   return new Promise(function(resolve, reject) {
    //     combinedStream.append(function(next) {
    //       files.map(function(file, i) {
    //         combinedStream.append(gfs.createReadStream({id: file.id}));
    //         console.log(combineStream);
    //         // const readStream = gfs.createReadStream({id: file.id});
    //         // readStream.on('error', console.log(`there was an error with file ${i + 1}`));
    //         // readStream.on('close', console.log(`file ${i + 1} is done streaming`));
    //       })
    //     })
    //     reject(console.log(`failed to append files to combinedStream`));
    //     resolve(combinedStream);
    //   }).then(combinedStreams => {
    //     combinedStream.pipe(res);
    //   })
   //
   //  return Promise.all(
   //   files.map(function(file, i) {
   //     console.log('this file is:', file);
   //     return new Promise(function(resolve,reject) {
   //       const readstream = gfs.createReadStream({id: files[0].id});
   //       //console.log(readstream);
   //       readstream.pipe(res);
   //     })
   //   })
   // )
 })
});

module.exports = {router};
