'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const path = require('path');

const { app } = require('../server');
const { JWT_SECRET } = require('../config');
const { tearDownDb, genFakeDataPromises, realToken, realUser, genAndReturnPost, seedPost, seedPostWithUrl } = require('./generate-fake-data');
const { Content } = require('../models/content');
const { Editor } = require('../models/editor');

const expect = chai.expect;
const should = require('chai').should()
chai.use(chaiHttp);

//mongoose.set('debug', true);

let gfs;
const mongoConn = mongoose.connection;

  mongoConn.once("open", () => {
    //console.log('mongoose connection is open')
    gfs = new mongoose.mongo.GridFSBucket(mongoConn.db, {
      bucketName: "fs"
    });
  });

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
  this.timeout(7000);

  before(function() {
    return Editor.hashPassword(password)
      .then(function(password) {
        return Editor.create({
          email,
          password,
          firstName,
          lastName
        })
     })
  })

  afterEach(async function() {
    return await tearDownDb()
  })

  describe('/protected', function () {
    describe('POST', function () {
      it('Should reject requests with no credentials', function() {
        return genFakeDataPromises(1, realToken).then(function(promise) {
            return promise[0]
          })
          .then(function(res) {
            expect(res).to.have.status(401)
          })
        });
        it('Should reject requests with an invalid token', function() {
          const badToken = function(user) {
            return(
              jwt.sign(
                {user},
                'wrongSecret',
                {
                  algorithm: 'HS256',
                  expiresIn: '7d'
                }
              )
            )
          };
          return genFakeDataPromises(1, badToken, realUser).then(function(promise) {
              return promise[0]
            })
            .then(function(res) {
              expect(res).to.have.status(401);
            });
        });
        it('should allow editor to post multipart/form-data content with a file object, when the correct credentials are set', function() {
          let fakeData;
          return genAndReturnPost()
            .then(function(post) {
              fakeData = post;
              return seedPost(post, realToken, realUser);
            })
            .then(function(res) {
              // console.log('res.body is', res.body)
              expect(res).to.have.status(200)
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
              return gfs.find({id: content.files[0].fileId}, function (err, file) {
                should.exist(file);
              })
            })
        })
        it('should allow editor to post multipart/form-data content with a file url, when the correct credentials are set', function() {
          let fakeData;
          return genAndReturnPost()
            .then(function(post) {
              fakeData = post;
              return seedPostWithUrl(post, realToken, realUser);
            })
            .then(function(res) {
              // console.log('res.body is', res.body)
              expect(res).to.have.status(200)
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
              return gfs.find({id: content.files[0].fileId}, function (err, file) {
                should.exist(file);
              })
            })
        })
    }) //Post
    describe('DELETE', function () {
      it('Should reject requests with no credentials', function() {
        let contentId;
        return genFakeDataPromises(1, realToken, realUser).then(function(promise) {
            return promise[0]
          })
          .then(function(res) {
           let contentId = res.body.id;
            return chai
              .request(app)
              .delete(`/protected/content/${contentId}`)
              .then(function(res) {
                expect(res).to.have.status(401);
              })
           })
        });
        it('Should reject requests with an invalid token', function() {
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
          return genFakeDataPromises(1, realToken, realUser).then(function(promise) {
              return promise[0]
            })
            .then(function(res) {
              contentId = res.body.id;
              return chai
                .request(app)
                .delete(`/protected/content/${contentId}`)
                .set('Authorization', `Bearer ${token}`)
                .then(function(res) {
                  expect(res).to.have.status(401);
                })
            });
         })
        it('Should reject requests with an expired token', function() {
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
          return genFakeDataPromises(1, realToken, realUser).then(function(promise) {
              return promise[0]
            })
            .then(function(res) {
              contentId = res.body.id;
              return chai
                .request(app)
                .delete(`/protected/content/${contentId}`)
                .set('authorization', `Bearer ${token}`)
                .then(function(res) {
                   expect(res).to.have.status(401);
                 })
            });
        });
      it('should allow editor to delete content info and multipart/form-data files when the correct credentials are set', function() {
        let contentId;
        return genFakeDataPromises(1, realToken, realUser).then(function(promise) {
            return promise[0]
          })
          .then(function(res) {
            contentId = res.body.id;
            return chai.request(app)
             .delete(`/protected/content/${contentId}`)
             .set('authorization', `Bearer ${realToken(realUser)}`)
             .then(function(res) {
               expect(res).to.have.status(204);
             })
          })
       })
    }) //Delete
    describe('PATCH', function () {
      let contentId;
      describe('/content/:contentId', function () {
        const patchObject = {title: 'et facilis aut'};
        it('Should reject requests with no credentials', function() {
          return genFakeDataPromises(1, realToken, realUser).then(function(promise) {
            return promise[0]
          })
          .then(function(res) {
            contentId = res.body.id;
            return chai
              .request(app)
              .patch(`/protected/content/${contentId}`)
              .send(patchObject)
              .then(function(res) {
                expect(res).to.have.status(401);
              })
            });
          })
          it('Should reject requests with an invalid token', function() {
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
            return genFakeDataPromises(1, realToken, realUser).then(function(promise) {
              return promise[0]
            })
            .then(function(res) {
              contentId = res.body.id;
              return chai
                .request(app)
                .patch(`/protected/content/${contentId}`)
                .send(patchObject)
                .set('Authorization', `Bearer ${token}`)
                .then(function(res) {
                  expect(res).to.have.status(401);
                })
            });
          })
          it('Should reject requests with an expired token', function() {
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
            return genFakeDataPromises(1, realToken, realUser).then(function(promise) {
              return promise[0]
            })
            .then(function(res) {
              contentId = res.body.id;
              return chai
                .request(app)
                .patch(`/protected/content/${contentId}`)
                .send(patchObject)
                .set('authorization', `Bearer ${token}`)
                .then(function(res) {
                   expect(res).to.have.status(401);
                 })
              });
          });
          it('should allow editor to patch content info when the correct credentials are set', function() {
            return genFakeDataPromises(1, realToken, realUser).then(function(promise) {
              return promise[0]
            })
            .then(function(res) {
              contentId = res.body.id;
              return chai.request(app)
               .patch(`/protected/content/${contentId}`)
               .send(patchObject)
               .set('authorization', `Bearer ${realToken(realUser)}`)
               .then(function(res) {
                 expect(res).to.have.status(201);
                 return Content.findById(contentId)
               })
               .then(function(content){
                 expect(content.title).to.equal(patchObject.title);
               });
            });
         });
      });
      describe('/files/:contentId', function () {
        const file3 = path.join(__dirname, '/dummy-files/dummy-file-3.jpg');
        it('should allow editor to add a file when the correct credentials are set', function() {
          let numOfFiles;
          return genFakeDataPromises(1, realToken, realUser).then(function(promise) {
            return promise[0]
          })
          .then(function(res) {
            //console.log('res.body.files length after seeding is', res.body.files.length)
            contentId = res.body.id;
            return chai.request(app)
             .patch(`/protected/files/${contentId}`)
             .set('authorization', `Bearer ${realToken(realUser)}`)
             .type('multipart/form')
             .attach('files', file3)
             .then(function(res) {
               expect(res).to.have.status(200);
               return Content.findById(contentId)
             })
             .then(function(content){
               const newFilesArray = content.files;
               //console.log('files length after adding a file is', newFilesArray.length)
               newFilesArray.should.have.lengthOf(++res.body.files.length);
             });
          });
       });
       it('should allow editor to add and delete a file object when the correct credentials are set', function() {
         let numOfFiles;
         return genFakeDataPromises(1, realToken, realUser).then(function(promise) {
           return promise[0]
         })
         .then(function(res) {
           //console.log('res.body.files after seeding are', res.body.files)
           contentId = res.body.id;
           return chai.request(app)
            .patch(`/protected/files/${contentId}`)
            .set('authorization', `Bearer ${realToken(realUser)}`)
            .type('multipart/form')
            .field('files', res.body.files[0]._id)
            .attach('files', file3)
            .then(function(res) {
              expect(res).to.have.status(200);
              return Content.findById(contentId)
            })
            .then(function(content){
              const newFilesArray = content.files
              //console.log('newFilesArray is', newFilesArray)
              newFilesArray.should.have.lengthOf(res.body.files.length);
            });
         });
       });
       it('should allow editor to add a file url when the correct credentials are set', function() {
         let numOfFiles;
         return genFakeDataPromises(1, realToken, realUser).then(function(promise) {
           return promise[0]
         })
         .then(function(res) {
           //console.log('res.body.files after seeding is', res.body.files)
           contentId = res.body.id;
           return chai.request(app)
            .patch(`/protected/files/${contentId}`)
            .set('authorization', `Bearer ${realToken(realUser)}`)
            .type('multipart/form')
            .field('files', '//www.youtube.com/embed/UZ9SyxqYjLk')
            .then(function(res) {
              expect(res).to.have.status(200);
              return Content.findById(contentId)
            })
            .then(function(content){
              const newFilesArray = content.files;
              //console.log('newFilesArray after adding a file url is', newFilesArray)
              newFilesArray.should.have.lengthOf(res.body.files.length + 1);
            });
          });
        });
      });
    }); //patch
  });
});
