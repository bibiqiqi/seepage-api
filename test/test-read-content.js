'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const mongoose = require('mongoose');
const Grid = require('gridfs-stream');
const fs = require('fs');

const { app, runServer, closeServer, upload } = require('../server');
const { TEST_DATABASE_URL } = require('../config');
const { generateContent } = require('./generate_content');
const { Content } = require('../models/content');

const expect = chai.expect;
chai.use(chaiHttp);

//for gfs
const mongoConn = mongoose.connection;
let gfs;

//define gfs stream
mongoConn.once('open', () => {
  gfs = Grid(mongoConn.db, mongoose.mongo);
  gfs.collection('fs');
})

let contentId;

function seedFakeContent() {
  return new Promise((resolve, reject) => {
    const dummyData = generateContent();
    Content
      .insertMany(dummyData)
      .then(function(insertedContent){
        //console.log('the insertedContent is', insertedContent);
        contentId = insertedContent[0].id;
        //console.log(contentId);
        resolve(insertedContent);
    })
  });
};

function seedGfsFiles(insertedContent) {
  return Promise.all(
   insertedContent.map(function(content, i) {
     return new Promise(function(resolve,reject) {
       const writestream = gfs.createWriteStream({
         metadata: {contentId: content.id}
       });
       fs.createReadStream('./dummyArt.jpg').pipe(writestream);

       writestream.on("error",reject);
       writestream.on("close", function(uploadedFile) {
        //console.log(`file ${i} was uploaded`);
        resolve(uploadedFile);
       });
     })
   })
 )
}

describe('Content endpoints', function () {

  beforeEach(function () {
    return seedFakeContent();
  });

  afterEach(function () {
    return new Promise((resolve, reject) => {
      console.warn('Deleting database');
      mongoose.connection.dropDatabase()
        .then(result => resolve(result))
        .catch(err => reject(err));
    });
  });

  describe('GET', function () {
    describe('/content', function () {
      it('should return all existing content', function() {
        let _res;
        return chai.request(app)
          .get('/content')
          .then(res => {
            _res = res;
            //console.log(_res.body.contents);
            expect(res).to.have.status(200);
            expect(res.body.contents).to.have.lengthOf.at.least(1);
            return Content.count();
          })
          .then(count => {
              expect(_res.body.contents).to.have.lengthOf(count);
          });
      });
      it('should return contents with right fields', function() {
        let resContent;
        return chai.request(app)
          .get('/content')
          .then(function(res) {
            //console.log(res.body.contents);
            expect(res).to.have.status(200);
            expect(res).to.be.json;
            expect(res.body.contents).to.be.a('array');
            expect(res.body.contents).to.have.lengthOf.at.least(1);

            res.body.contents.forEach(function(content) {
              expect(content).to.be.a('object');
              expect(content).to.include.keys(
                'artistName', 'title', 'category', 'tags');
            });
            resContent = res.body.contents[0];
            return Content.findById(resContent.id);
          })
          .then(function(content) {
            //console.log(content);
            expect(resContent.artistName).to.equal(content.artistName);
            expect(resContent.title).to.equal(content.title);
            expect(resContent.category).to.contain(content.category);
            expect(resContent.tags[1]).to.equal(content.tags[1]);
          });
        });
      });
      describe('/content/:contentId', function () {
        it('should return the requested content', function() {
          return seedFakeContent()
            .then(function(insertedContent) {
              //console.log('seeded fake content and this is what was inserted:', insertedContent);
              return seedGfsFiles(insertedContent)
            }).then(function(uploadedFiles) {
              //console.log('uploaded corresponding files and this is what was inserted:', uploadedFiles);
              //console.log('gfs is:', gfs);
            return gfs.files
            .findOne()
            .then(function(file) {
            //console.log('the file i found was', file);
             const contentId = file.metadata.contentId;
             return chai.request(app)
               .get(`/content/${contentId}`)
               .then(res => {
                 //console.log(res);
                 expect(res).to.have.status(200);
                 //expect(res.files).to.have.lengthOf.at.least(1);
               })
            })
          })
        });
     });
  });
});
