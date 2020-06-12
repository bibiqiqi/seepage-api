'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const mongoose = require('mongoose');
const { app } = require('../server');
const { tearDownDb, genFakeDataPromises, realToken, realUser} = require('./generate-fake-data');
const { Content } = require('../models/content');

const expect = chai.expect;
chai.use(chaiHttp);

let gfs;
const mongoConn = mongoose.connection;
mongoConn.once("open", () => {
  //console.log('mongoose connection is open')
  gfs = new mongoose.mongo.GridFSBucket(mongoConn.db, {
    bucketName: "fs"
  });
});

describe('Content endpoints', function () {
  this.timeout(5000);

  before(function() {
    return genFakeDataPromises(1, realToken, realUser)
    .then(function(fakeDataPromises) {
      return Promise.all(fakeDataPromises);
    })
  });

  after(function() {
    return tearDownDb()
  })

  describe('GET', function () {
    describe('/content', function () {
      it('should return all existing content', function() {
        let _res;
        return chai.request(app)
          .get('/content')
          .then(function(res) {
            _res = res;
            expect(res).to.have.status(200);
            expect(res.body).to.have.lengthOf.at.least(1);
            return Content.count();
          })
          .then(function(count) {
            expect(_res.body).to.have.lengthOf(count);
            const filesQuery = gfs.find().toArray();
            return filesQuery;
          })
          .then(function(files) {
            const count = files.length;
            let totalFiles = 0;
            _res.body.map(function(e) {
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
          })
        });
      });
      describe('/content/:contentId', function () {
        it('should return the requested content', function() {
          let filename;
          return Content
            .findOne()
            .then(function(content) {
              filename = content.files[0].fileName
              return chai.request(app)
                .get(`/content/files/${filename}`)
                .then(function(res) {
                  expect(res).to.have.status(200);
                })
            })
        });
     });
  });
});
