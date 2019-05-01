'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const mongoose = require('mongoose');
const Grid = require('gridfs-stream');

const { app, runServer, closeServer } = require('../server');
const { JWT_SECRET, TEST_DATABASE_URL } = require('../config');
const { generateContent } = require('./generate_content');
const { Content } = require('../models/content');
const { Editor } = require('../models/editor');

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

describe('Protected endpoint', function () {
//fake data for editor account
  const email = 'EddieEditor@aol.com';
  const password = '1234567891';
  const firstName = 'Eddie';
  const lastName = 'Editor';

  const user = {
      email,
      firstName,
      lastName
  }

//fake data for content
  const fakeContent = {
    artistName: 'Lisa Vanderpump',
    title: 'Vanderpump Rules',
    category: 'media',
    tags: ['hyper-real', 'reality tv', 'new media', 'conceptual art']
  }

  beforeEach(function () {
    return Editor.hashPassword(password).then(password => {
      Editor.create({
        email,
        password,
        firstName,
        lastName
      })
    });
  });

  beforeEach(function () {
    return seedFakeContent()
      .then(function(insertedContent) {
        contentId = insertedContent[0].id;
        //console.log('seeded fake content and this is what was inserted:', insertedContent);
        return seedGfsFiles(insertedContent);
      // }).then(function(uploadedFiles) {
      //   //console.log('uploaded corresponding files and this is what was inserted:', uploadedFiles);
      //   //console.log('gfs is:', gfs);
      //   return gfs.files
      });
  });

  afterEach(function () {
    return new Promise((resolve, reject) => {
      console.warn('Deleting database');
      mongoose.connection.dropDatabase()
        .then(result => resolve(result))
        .catch(err => reject(err));
    });
  });

  describe('/protected/content', function () {
    describe('POST', function () {
      it('Should reject requests with no credentials', function () {
        return chai
          .request(app)
          .post('/protected/content')
          .send(fakeContent)
          .then((res) => {
            expect(res).to.have.status(401);
          })
        });
        it('Should reject requests with an invalid token', function () {
          const token = jwt.sign(
            {
              email,
              firstName,
              lastName
            },
            'wrongSecret',
            {
              algorithm: 'HS256',
              expiresIn: '7d'
            }
          );
          return chai
            .request(app)
            .post('/protected/content')
            .send(fakeContent)
            .set('Authorization', `Bearer ${token}`)
            .then((res) => {
              expect(res).to.have.status(401);
            });
        });
        it('Should reject requests with an expired token', function () {
          const token = jwt.sign(
            {
              user,
              exp: Math.floor(Date.now() / 1000) - 10 // Expired ten seconds ago
            },
            JWT_SECRET,
            {
              algorithm: 'HS256',
              subject: email
            }
          );
          return chai
            .request(app)
            .post('/protected/content')
            .send(fakeContent)
            .set('authorization', `Bearer ${token}`)
            .then((res) => {
               expect(res).to.have.status(401);
             });
        });
        it('should allow editor to post multipart/form-data content when the correct credentials are set', function() {
          const token = jwt.sign(
            {user},
            JWT_SECRET,
            {
              algorithm: 'HS256',
              subject: email,
              expiresIn: '7d'
            }
          );
          return chai.request(app)
          .post('/protected/content')
          .set('authorization', `Bearer ${token}`)
          .send(fakeContent)
          .then(function(res) {
            expect(res).to.have.status(201)
            expect(res).to.be.json;
            expect(res.body).to.be.a('object');
            expect(res.body).to.include.keys(
              'artistName', 'title', 'category', 'tags');
            expect(res.body.id).to.not.be.null;
            expect(res.body.artistName).to.equal(fakeContent.artistName);
            expect(res.body.title).to.equal(fakeContent.title);
            expect(res.body.category).to.equal(fakeContent.category);
            return Content.findById(res.body.id);
          })
          .then(function(content) {
            expect(content.artistName).to.equal(fakeContent.artistName);
            expect(content.title).to.equal(fakeContent.title);
            expect(content.category).to.equal(fakeContent.category);
            return chai.request(app)
            .post('/protected/files')
            .set('authorization', `Bearer ${token}`)
            .field({contentId: content.id})
            .attach('files', './dummyArt.jpg')
            .then(function(res) {
              expect(res).to.have.status(201)
              expect(res.body.ops[0].metadata.contentId).to.equal(content.id)
            })
        })
      })
    });
    describe('DELETE', function () {
      const token = jwt.sign(
        {user},
        JWT_SECRET,
        {
          algorithm: 'HS256',
          subject: email,
          expiresIn: '7d'
        }
      );
      it('Should reject requests with no credentials', function () {
        return chai
          .request(app)
          .delete(`/protected/content/${contentId}`)
          .then((res) => {
            expect(res).to.have.status(401);
          })
        });
        it('Should reject requests with an invalid token', function () {
          const token = jwt.sign(
            {
              email,
              firstName,
              lastName
            },
            'wrongSecret',
            {
              algorithm: 'HS256',
              expiresIn: '7d'
            }
          );
          return chai
            .request(app)
            .delete(`/protected/content/${contentId}`)
            .set('Authorization', `Bearer ${token}`)
            .then((res) => {
              expect(res).to.have.status(401);
            });
        });
        it('Should reject requests with an expired token', function () {
          const token = jwt.sign(
            {
              user,
              exp: Math.floor(Date.now() / 1000) - 10 // Expired ten seconds ago
            },
            JWT_SECRET,
            {
              algorithm: 'HS256',
              subject: email
            }
          );
          return chai
            .request(app)
            .delete(`/protected/content/${contentId}`)
            .set('authorization', `Bearer ${token}`)
            .then((res) => {
               expect(res).to.have.status(401);
             });
        });
      it('should allow editor to delete content info and multipart/form-data files when the correct credentials are set', function() {
        return chai.request(app)
         .delete(`/protected/content/${contentId}`)
         .set('authorization', `Bearer ${token}`)
         .then(function(res) {
           expect(res).to.have.status(204);
         })
       });
    });
    describe('PATCH', function () {
      const token = jwt.sign(
        {user},
        JWT_SECRET,
        {
          algorithm: 'HS256',
          subject: email,
          expiresIn: '7d'
        }
      );
      const patchObject = {title: 'Real Housewives of Beverly Hills'};

      it('Should reject requests with no credentials', function () {
        return chai
          .request(app)
          .patch(`/protected/content/${contentId}`)
          .send(patchObject)
          .then((res) => {
            expect(res).to.have.status(401);
          })
        });
        it('Should reject requests with an invalid token', function () {
          const token = jwt.sign(
            {
              email,
              firstName,
              lastName
            },
            'wrongSecret',
            {
              algorithm: 'HS256',
              expiresIn: '7d'
            }
          );
          return chai
            .request(app)
            .patch(`/protected/content/${contentId}`)
            .send(patchObject)
            .set('Authorization', `Bearer ${token}`)
            .then((res) => {
              expect(res).to.have.status(401);
            });
        });
        it('Should reject requests with an expired token', function () {
          const token = jwt.sign(
            {
              user,
              exp: Math.floor(Date.now() / 1000) - 10 // Expired ten seconds ago
            },
            JWT_SECRET,
            {
              algorithm: 'HS256',
              subject: email
            }
          );
          return chai
            .request(app)
            .patch(`/protected/content/${contentId}`)
            .send(patchObject)
            .set('authorization', `Bearer ${token}`)
            .then((res) => {
               expect(res).to.have.status(401);
             });
        });
      it('should allow editor to patch content info when the correct credentials are set', function() {
        return chai.request(app)
         .patch(`/protected/content/${contentId}`)
         .send(patchObject)
         .set('authorization', `Bearer ${token}`)
         .then(function(res) {
           expect(res).to.have.status(204);
           return Content.findById(contentId)
         })
         .then(function(content){
           expect(content.title).to.equal(patchObject.title);
         })
      });
    });
  });
});
