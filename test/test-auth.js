'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const jwt = require('jsonwebtoken');

const { app, runServer, closeServer } = require('../server');
const { Editor } = require('../models/editor')
const { JWT_SECRET, TEST_DATABASE_URL, PORT } = require('../config');
const { tearDownDb } = require('./generate-fake-data');

const expect = chai.expect;

chai.use(chaiHttp);

const email = 'EddieEditor@aol.com';
const password = '1234567891';
const firstName = 'Eddie';
const lastName = 'Editor';

describe('/auth/login', function() {

  before(function() {
    // console.log('running runServer');
    return runServer(TEST_DATABASE_URL);
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

  afterEach(function () {
    return tearDownDb();
  });

  describe('/auth/login', function(){
    it('Should reject requests with no credentials', function () {
      return chai
        .request(app)
        .post('/auth/login')
        .then(res => {
          expect(res).to.have.status(400);
        });
    });
    it('Should reject requests with incorrect emails', function(){
      return chai
        .request(app)
        .post('/auth/login')
        .send({ email: 'wrongEmail', password })
        .then(res => {
          expect(res).to.have.status(401);
        })
    });
    it('Should reject requests with incorrect passwords', function(){
      return chai
        .request(app)
        .post('/auth/login')
        .send({ email: email, password: 'wrongPassword' })
        .then(res => {
          expect(res).to.have.status(401);
        });
    });
    it ('Should return a valid auth token', function() {
      return chai
        .request(app)
        .post('/auth/login')
        .send({ email: email, password: password })
        .then(res => {
          expect(res).to.have.status(200);
          expect(res.body).to.be.an('object');
          const token = res.body.authToken;
          expect(token).to.be.a('string');
          const payload = jwt.verify(token, JWT_SECRET, {
            algorithm: ['HS256']
          });
          //console.log('-payload is:', payload);
          expect(payload.user.email).to.equal(
            email
          );
        });
    });

  describe('auth/refresh', function () {
    const user = {
      email,
      firstName,
      lastName
    }
    it('Should reject requests with no credentials', function () {
      return chai
        .request(app)
        .post('/auth/refresh')
        .then(res => {
          expect(res).to.have.status(401);
      })
    });
    it('Should reject requests with an invalid token', function() {
      const token = jwt.sign(
        user,
        'wrongSecret',
        {
          algorithm: 'HS256',
          expiresIn: '7d'
        }
      );
      return chai
        .request(app)
        .post('/auth/refresh')
        .set('authorization', `Bearer ${token}`)
        .then((res) => {
          //console.log('res sent back to client is:', res);
          expect(res).to.have.status(401);
        });
    });
    it('Should reject requests with an expired token', function () {
      const token = jwt.sign(
        {
          user,
          exp: Math.floor(Date.now() / 1000) - 10
        }, // Expired ten seconds ago,
        JWT_SECRET,
        {
          algorithm: 'HS256',
          subject: email
        }
      );
      return chai
        .request(app)
        .post('/auth/refresh')
        .set('authorization', `Bearer ${token}`)
        .then((res) => {
          expect(res).to.have.status(401);
        });
    });
    it('Should return a valid auth token with a newer expiration date', function() {
      const token = jwt.sign(
        {user},
        JWT_SECRET,
        {
          algorithm: 'HS256',
          subject: email,
          expiresIn: '7d'
        }
      );
      const decoded = jwt.decode(token);

      return chai
        .request(app)
        .post('/auth/refresh')
        .set('authorization', `Bearer ${token}`)
        .then(res => {
          expect(res).to.have.status(200);
          expect(res.body).to.be.an('object');
          const token = res.body.authToken;
          expect(token).to.be.a('string');
          const payload = jwt.verify(token, JWT_SECRET, {
            algorithm: ['HS256']
          });
          //console.log('paylod is:', payload);
          expect(payload.user).to.deep.equal(user);
          expect(payload.exp).to.be.at.least(decoded.exp);
        });
      });
    });
  });
})
