'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const mongoose = require('mongoose');
const gfs = require('gridfs-stream');

const { app, runServer, closeServer } = require('../server');
const { JWT_SECRET, TEST_DATABASE_URL } = require('../config');
const { generateContent } = require('./generate_content');
const { Content } = require('../models/content');
const { Editor } = require('../models/editor');

const expect = chai.expect;

chai.use(chaiHttp);

describe('Protected endpoint', function () {
  const email = 'EddieEditor@aol.com';
  const password = '1234567891';
  const firstName = 'Eddie';
  const lastName = 'Editor';

  before(function () {
    return runServer(TEST_DATABASE_URL);
  });

  after(function () {
    return closeServer();
  });

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

  // beforeEach(function () {
  //   //console.log('generateContent is:', generateContent());
  //   const dummyData = generateContent();
  //   //console.log(dummyData);
  //     return Content.insertMany(dummyData);
  // });

  afterEach(function () {
    return new Promise((resolve, reject) => {
      console.warn('Deleting database');
      mongoose.connection.dropDatabase()
        .then(result => resolve(result))
        .catch(err => reject(err));
    });
  });

  describe('/protected/content', function () {
    const user = {
        email,
        firstName,
        lastName
    }

    describe('POST', function () {
      const fakeContent = {
        artistName: 'Lisa Vanderpump',
        title: 'Vanderpump Rules',
        category: 'media',
        tags: ['hyper-real', 'reality tv', 'new media', 'conceptual art']
      }

      // it('Should reject requests with no credentials', function () {
      //   return chai
      //     .request(app)
      //     .post('/protected/content')
      //     .send(fakeContent)
      //     .then((res) => {
      //       expect(res).to.have.status(401);
      //     })
      //   });
        // it('Should reject requests with an invalid token', function () {
        //   const token = jwt.sign(
        //     {
        //       email,
        //       firstName,
        //       lastName
        //     },
        //     'wrongSecret',
        //     {
        //       algorithm: 'HS256',
        //       expiresIn: '7d'
        //     }
        //   );
        //   return chai
        //     .request(app)
        //     .post('/protected/content')
        //     .send(fakeContent)
        //     .set('Authorization', `Bearer ${token}`)
        //     .then((res) => {
        //       expect(res).to.have.status(401);
        //     });
        // });
        // it('Should reject requests with an expired token', function () {
        //   const token = jwt.sign(
        //     {
        //       user,
        //       exp: Math.floor(Date.now() / 1000) - 10 // Expired ten seconds ago
        //     },
        //     JWT_SECRET,
        //     {
        //       algorithm: 'HS256',
        //       subject: email
        //     }
        //   );
        //   return chai
        //     .request(app)
        //     .post('/protected/content')
        //     .send(fakeContent)
        //     .set('authorization', `Bearer ${token}`)
        //     .then((res) => {
        //        expect(res).to.have.status(401);
        //      });
        // });
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
  });
});

//code that was testing and working, but written for GET:
//   it('Should send protected data when the search query has a match', function () {
//     const token = jwt.sign(
//       {user},
//       JWT_SECRET,
//       {
//         algorithm: 'HS256',
//         subject: email,
//         expiresIn: '7d'
//       }
//     );
//     return Content
//       .findOne()
//       .then(content => {
//         const artistName = content.name;
//         console.log('found this artist name:', artistName)
//         return chai
//           .request(app)
//           .post('/protected/content')
//           .set('authorization', `Bearer ${token}`)
//           .send(artistName)
//           .then(res => {
//             expect(res).to.have.status(200);
//             expect(res).to.be.json;
//             expect(res.body.contents).to.be.a('array');
//             res.body.contents.forEach(function(content) {
//               expect(content).to.be.a('object');
//               expect(content).to.include.keys(
//                 'name', 'title', 'category', 'tags', 'content');
//             });
//          });
//       });
//   });
//   it('Should return a message when the search query does not have a match', function () {
//     const token = jwt.sign(
//       {user},
//       JWT_SECRET,
//       {
//         algorithm: 'HS256',
//         subject: email,
//         expiresIn: '7d'
//       }
//     );
//     const artistName = "Lisa Vanderpump";
//     return chai
//       .request(app)
//       .post('/protected/content')
//       .set('authorization', `Bearer ${token}`)
//       .send(artistName)
//       .then(res => {
//         expect(res).to.have.status(204);
//       })
//   });
// });
