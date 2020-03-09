'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
 const mongoose = require('mongoose');
 const Grid = require('gridfs-stream');
 const fs = require('fs');
const { app, runServer, closeServer} = require('../server');
const { tearDownDb, genFakeDataPromises, realToken, realUser} = require('./generate-fake-data');
const { Content } = require('../models/content');

const expect = chai.expect;
chai.use(chaiHttp);

//for gfs
const mongoConn = mongoose.connection;
let gfs;
//
//define gfs stream
mongoConn.once('open', () => {
  gfs = Grid(mongoConn.db, mongoose.mongo);
  gfs.collection('fs');
})

describe('Content endpoints', function () {

  beforeEach(function() {
    return genFakeDataPromises(4, realToken, realUser).then(promises => {
      return Promise.all(promises).then(res => {
        // console.log('promise.all is done')
      })
    })
  });

  afterEach(function () {
    return tearDownDb();
  });

  describe('GET', function () {
    describe('/content', function () {
      it('should return all existing content', function() {
        let _res;
        return chai.request(app)
          .get('/content')
          .then(res => {
            _res = res;
            // console.log('***** the response sent back from GET request is:', _res.body);
            expect(res).to.have.status(200);
            expect(res.body).to.have.lengthOf.at.least(1);
            return Content.count();
          })
          .then(count => {
              expect(_res.body).to.have.lengthOf(count);
              return gfs.files.count();
          })
          .then(count => {
            // console.log('count returned is', count);
            let totalFiles = 0;
            _res.body.map(e => {
              totalFiles += e.files.length
            })
            expect(totalFiles).to.equal(count);
          })
      });
      it('should return contents with right fields', function() {
        let resContent;
        return chai.request(app)
          .get('/content')
          .then(function(res) {
            //console.log(res.body.contents);
            expect(res).to.have.status(200);
            expect(res).to.be.json;
            expect(res.body).to.be.a('array');
            expect(res.body).to.have.lengthOf.at.least(1);

            res.body.forEach(function(content) {
              expect(content).to.be.a('object');
              expect(content).to.include.keys(
                'artistName', 'title', 'category', 'tags', 'description', 'files');
            });
            resContent = res.body[0];
            return Content.findById(resContent.id);
          })
          .then(function(content) {
            //console.log(content);
            expect(resContent.artistName).to.equal(content.artistName);
            expect(resContent.title).to.equal(content.title);
            expect(resContent.description).to.equal(content.description);
            expect(resContent.category[0]).to.equal(content.category[0]);
            expect(resContent.tags[0]).to.equal(content.tags[0]);
          });
        });
      });
      describe('/content/:contentId', function () {
        it('should return the requested content', function() {
          let fileId;
          return Content
            .findOne()
            .then(function(content) {
              fileId = content.files[0].fileId
              return chai.request(app)
                .get(`/content/files/${fileId}`)
                .then(res => {
                  expect(res).to.have.status(200);
                })
            })
        });
     });
  });
});
