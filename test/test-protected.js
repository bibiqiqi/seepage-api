'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const jwt = require('jsonwebtoken');

const { app, runServer, closeServer } = require('../server');
const { JWT_SECRET, TEST_DATABASE_URL } = require('../config');
const { generateContent } = require('./generate_content');

const expect = chai.expect;

chai.use(chaiHttp);

describe('Protected endpoint', function () {
  const shortId = 1234;
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
    console.log('generateContent is:', generateContent());
    //return generateContent;
    // return User.hashPassword(password).then(password =>
    //   User.create({
    //     shortId,
    //     email,
    //     password,
    //     firstName,
    //     lastName
    //   })
    // );
  });

  afterEach(function () {
    return User.remove({});
  });

  describe('/api/protected', function () {
    const user = {
      email: email,
      firstName: firstName,
      lastName: lastName
    };
    console.log({user}, user);
    it('Should reject requests with no credentials', function () {
      return chai
        .request(app)
        .get('/api/protected')
        .then(() =>
          expect.fail(null, null, 'Request should not succeed')
        )
        .catch(err => {
          if (err instanceof chai.AssertionError) {
            throw err;
          }

          const res = err.response;
          expect(res).to.have.status(401);
        });
    });
    //
    // it('Should reject requests with an invalid token', function () {
    //   const token = jwt.sign(
    //     { user },
    //     'wrongSecret',
    //     {
    //       algorithm: 'HS256',
    //       expiresIn: '7d'
    //     }
    //   );
    //
    //   return chai
    //     .request(app)
    //     .get('/api/protected')
    //     .set('Authorization', `Bearer ${token}`)
    //     .then(() =>
    //       expect.fail(null, null, 'Request should not succeed')
    //     )
    //     .catch(err => {
    //       if (err instanceof chai.AssertionError) {
    //         throw err;
    //       }
    //
    //       const res = err.response;
    //       expect(res).to.have.status(401);
    //     });
    // });
    // it('Should reject requests with an expired token', function () {
    //   const token = jwt.sign(
    //     { user },
    //       exp: Math.floor(Date.now() / 1000) - 10 // Expired ten seconds ago
    //     },
    //     JWT_SECRET,
    //     {
    //       algorithm: 'HS256',
    //       subject: email
    //     }
    //   );
    //
    //   return chai
    //     .request(app)
    //     .get('/api/protected')
    //     .set('authorization', `Bearer ${token}`)
    //     .then(() =>
    //       expect.fail(null, null, 'Request should not succeed')
    //     )
    //     .catch(err => {
    //       if (err instanceof chai.AssertionError) {
    //         throw err;
    //       }
    //
    //       const res = err.response;
    //       expect(res).to.have.status(401);
    //     });
    // });
    // it('Should send protected data', function () {
    //   const token = jwt.sign(
    //     { user },
    //     JWT_SECRET,
    //     {
    //       algorithm: 'HS256',
    //       subject: email,
    //       expiresIn: '7d'
    //     }
    //   );
    //
    //   return chai
    //     .request(app)
    //     .get('/api/protected')
    //     .set('authorization', `Bearer ${token}`)
    //     .then(res => {
    //       expect(res).to.have.status(200);
    //       expect(res.body).to.be.an('object');
    //       expect(res.body.data).to.equal('rosebud');
    //     });
    //});
  });
});
