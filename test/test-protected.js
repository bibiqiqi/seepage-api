'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const mongoose = require('mongoose');
const Grid = require('gridfs-stream');

const { app, runServer, closeServer } = require('../server');
const { JWT_SECRET, TEST_DATABASE_URL } = require('../config');
const { tearDownDb, genFakeDataPromises, realToken, realUser, genAndReturnPost, seedPost } = require('./generate-fake-data');
const { Content } = require('../models/content');
const { Editor } = require('../models/editor');

const expect = chai.expect;
var should = require('chai').should()

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

const email = 'EdnaEditor@aol.com';
const password = '1234567890';
const firstName = 'Edna';
const lastName = 'Editor';

const badUser = {
  email: 'eddieEditor@aol.com',
  password: '0987654321',
  firstName: 'Eddie',
  lastName: 'Editor'
}

describe('Protected endpoint', function () {

  beforeEach(function() {
    return Editor.hashPassword(password).then(password => {
      return Editor.create({
        email,
        password,
        firstName,
        lastName
      })
      // .then(res => console.log('creating new editor was a success!'))
      // .catch(err => console.log('error in creating new editor', err))
    });
  })

  afterEach(function() {
    return tearDownDb();
  });

  describe('/protected', function () {
    describe('POST', function () {
      it('Should reject requests with no credentials', function () {
        return genFakeDataPromises(1, realToken).then(promise => {
            return promise[0]
          })
          .then((res) => {
            expect(res).to.have.status(401)
          })
        });
        it('Should reject requests with an invalid token', function () {
          const badToken = (user) => jwt.sign(
            {user},
            'wrongSecret',
            {
              algorithm: 'HS256',
              expiresIn: '7d'
            }
          );
          return genFakeDataPromises(1, badToken, realUser).then(promise => {
              return promise[0]
            })
            .then((res) => {
              expect(res).to.have.status(401);
            });
        });
        it('should allow editor to post multipart/form-data content when the correct credentials are set', function() {
          let fakeData;
          return genAndReturnPost()
            .then(post => {
              fakeData = post;
              return seedPost(post, realToken, realUser);
            })
            .then(res => {
              expect(res).to.have.status(201)
              expect(res).to.be.json;
              expect(res.body).to.be.a('object');
              expect(res.body).to.include.keys(
                'artistName', 'title', 'category', 'tags', 'description');
              expect(res.body.id).to.not.be.null;
              expect(res.body.artistName).to.equal(fakeData.artistName);
              expect(res.body.title).to.equal(fakeData.title);
              expect(res.body.category[0]).to.equal(fakeData.category);
              expect(res.body.description).to.equal(fakeData.description);
              return Content.findById(res.body.id);
            })
            .then(function(content) {
              expect(content.artistName).to.equal(fakeData.artistName);
              expect(content.title).to.equal(fakeData.title);
              expect(content.category[0]).to.equal(fakeData.category);
              expect(content.description).to.equal(fakeData.description);
              return gfs.files.find({id: content.files[0].fileId}, function (err, file) {
                should.exist(file);
              })
            })
          })
       })
    });
    describe('DELETE', function () {
      it('Should reject requests with no credentials', function () {
        let contentId;
        return genFakeDataPromises(1, realToken, realUser).then(promise => {
            return promise[0]
          })
          .then(res => {
           let contentId = res.body.id;
            return chai
              .request(app)
              .delete(`/protected/content/${contentId}`)
              .then((res) => {
                expect(res).to.have.status(401);
              })
           })
        });
        it('Should reject requests with an invalid token', function () {
          let contentId;
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
          return genFakeDataPromises(1, realToken, realUser).then(promise => {
              return promise[0]
            })
            .then(res => {
              contentId = res.body.id;
              return chai
                .request(app)
                .delete(`/protected/content/${contentId}`)
                .set('Authorization', `Bearer ${token}`)
                .then((res) => {
                  expect(res).to.have.status(401);
                });
            });
        it('Should reject requests with an expired token', function () {
          let contentId;
          const token = jwt.sign(
            {
              realUser,
              exp: Math.floor(Date.now() / 1000) - 10 // Expired ten seconds ago
            },
            JWT_SECRET,
            {
              algorithm: 'HS256',
              subject: email
            }
          );
          return genFakeDataPromises(1, realToken, realUser).then(promise => {
              return promise[0]
            })
            .then(res => {
              contentId = res.body.id;
              return chai
                .request(app)
                .delete(`/protected/content/${contentId}`)
                .set('authorization', `Bearer ${token}`)
                .then((res) => {
                   expect(res).to.have.status(401);
                 });
            });
        });
      it('should allow editor to delete content info and multipart/form-data files when the correct credentials are set', function() {
        let contentId;
        return genFakeDataPromises(1, realToken, realUser).then(promise => {
            return promise[0]
          })
          .then(res => {
            contentId = res.body.id;
            return chai.request(app)
             .delete(`/protected/content/${contentId}`)
             .set('authorization', `Bearer ${realToken(realUser)}`)
             .then(function(res) {
               expect(res).to.have.status(204);
             })
          })
       })
    });
    describe('PATCH', function () {
      let contentId;
      describe('/content/:contentId', function () {
        const patchObject = {title: 'et facilis aut'};
        it('Should reject requests with no credentials', function () {
          return genFakeDataPromises(1, realToken, realUser).then(promise => {
            return promise[0]
          })
          .then(res => {
            contentId = res.body.id;
            return chai
              .request(app)
              .patch(`/protected/content/${contentId}`)
              .send(patchObject)
              .then((res) => {
                expect(res).to.have.status(401);
              })
            });
          })
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
            return genFakeDataPromises(1, realToken, realUser).then(promise => {
              return promise[0]
            })
            .then(res => {
              contentId = res.body.id;
              return chai
                .request(app)
                .patch(`/protected/content/${contentId}`)
                .send(patchObject)
                .set('Authorization', `Bearer ${token}`)
                .then((res) => {
                  expect(res).to.have.status(401);
                });
            });
          })
          it('Should reject requests with an expired token', function () {
            const token = jwt.sign(
              {
                realUser,
                exp: Math.floor(Date.now() / 1000) - 10 // Expired ten seconds ago
              },
              JWT_SECRET,
              {
                algorithm: 'HS256',
                subject: email
              }
            );
            return genFakeDataPromises(1, realToken, realUser).then(promise => {
              return promise[0]
            })
            .then(res => {
              contentId = res.body.id;
              return chai
                .request(app)
                .patch(`/protected/content/${contentId}`)
                .send(patchObject)
                .set('authorization', `Bearer ${token}`)
                .then((res) => {
                   expect(res).to.have.status(401);
                 });
              });
          });
          it('should allow editor to patch content info when the correct credentials are set', function() {
            return genFakeDataPromises(1, realToken, realUser).then(promise => {
              return promise[0]
            })
            .then(res => {
              contentId = res.body.id;
              return chai.request(app)
               .patch(`/protected/content/${contentId}`)
               .send(patchObject)
               .set('authorization', `Bearer ${realToken(realUser)}`)
               .then(function(res) {
                 expect(res).to.have.status(204);
                 return Content.findById(contentId)
               })
               .then(function(content){
                 expect(content.title).to.equal(patchObject.title);
               });
            });
         });
      })
      describe('/files/:contentId', function () {
        it('should allow editor to add a file when the correct credentials are set', function() {
          let numOfFiles;
          return genFakeDataPromises(1, realToken, realUser).then(promise => {
            return promise[0]
          })
          .then(res => {
            contentId = res.body.id;
            return chai.request(app)
             .patch(`/protected/files/${contentId}`)
             .set('authorization', `Bearer ${realToken(realUser)}`)
             .type('multipart/form')
             .attach('files', fs.readFileSync('./test/dummy-files/dummy-file-2.jpg'), 'dummy-file-2.jpg')
             .then(function(res) {
               expect(res).to.have.status(200);
               return Content.findById(contentId)
             })
             .then(function(content){
               const newFilesArray = content.files;
               newFilesArray.should.have.lengthOf(res.body.files.length + 1);
             });
          });
        });
      });
       it('should allow editor to add and delete a file when the correct credentials are set', function() {
         let numOfFiles;
         return genFakeDataPromises(1, realToken, realUser).then(promise => {
           return promise[0]
         })
         .then(res => {
           contentId = res.body.id;
           return chai.request(app)
            .patch(`/protected/files/${contentId}`)
            .set('authorization', `Bearer ${realToken(realUser)}`)
            .type('multipart/form')
            .field('files', res.body.files[0].fileId)
            .attach('files', fs.readFileSync('./test/dummy-files/dummy-file-2.jpg'), 'dummy-file-2.jpg')
            .then(function(res) {
              expect(res).to.have.status(200);
              return Content.findById(contentId)
            })
            .then(function(content){
              const newFilesArray = content.files;
              newFilesArray.should.have.lengthOf(res.body.files.length);
            });
         });
      });
    });
  });
});
