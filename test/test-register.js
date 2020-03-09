'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const mongoose = require('mongoose');

const { app, runServer, closeServer } = require('../server');
const { Editor } = require('../models/editor');
const { TEST_DATABASE_URL } = require('../config');
const { tearDownDb } = require('./generate-fake-data');

const expect = chai.expect;

chai.use(chaiHttp);

const email = 'EddieEditor@aol.com';
const firstName = 'Eddie';
const lastName = 'Editor';
const password = '1234567891';

const emailB = 'EdnaEditor@aol.com';
const firstNameB = 'Edna';
const lastNameB = 'Editor';
const passwordB = '1987654321';

function seedEditorData() {
  // console.log('Seeding editor data');
  const seedData = [
    {
      email,
      firstName,
      lastName,
      password
    },
    {
      email: emailB,
      firstName: firstNameB,
      lastName: lastNameB,
      password: passwordB,
    }
  ];
  return Editor.insertMany(seedData);
}
describe('/editors', function(){

  afterEach(function () {
    return tearDownDb();
  });

   after(function() {
     return closeServer();
   });

  describe('/editors', function() {
    describe('POST', function(){
      it('Should reject submissions that dont include an email address', function() {
        return chai
          .request(app)
          .post('/register')
          .send({
            firstName,
            lastName,
            password
          })
          .then((res) => {
            expect(res).to.have.status(422);
            expect(res.body.reason).to.equal('ValidationError');
            expect(res.body.message).to.equal('Missing Field');
            expect(res.body.location).to.equal('email');
          });
      });
      it('Should reject submissions that dont include a password', function() {
        return chai
          .request(app)
          .post('/register')
          .send({
            firstName,
            lastName,
            email
          })
          .then(res => {
            expect(res).to.have.status(422);
            expect(res.body.reason).to.equal('ValidationError');
            expect(res.body.message).to.equal('Missing Field');
            expect(res.body.location).to.equal('password');
          });
      });
      it('Should reject submissions that include a firstName field of the wrong type', function() {
        return chai
          .request(app)
          .post('/register')
          .send({
            firstName : 3741,
            lastName,
            email,
            password
          })
          .then(res => {
            expect(res).to.have.status(422);
            expect(res.body.reason).to.equal('ValidationError');
            expect(res.body.message).to.equal('Incorrect field type: expected string');
            expect(res.body.location).to.equal('firstName');
          })
      });
      it('Should reject submissions with a password that includes whitespace at the beginning or end', function() {
        return chai
          .request(app)
          .post('/register')
          .send({
            firstName,
            lastName,
            password: ` ${password} `,
            email
          })
          .then(res => {
            expect(res).to.have.status(422);
            expect(res.body.reason).to.equal('ValidationError');
            expect(res.body.message).to.equal('Cannot start or end with whitespace');
            expect(res.body.location).to.equal('password');
          })
      });
      it('Should reject submissions with a password that doesnt meet the minimum requirement', function() {
        return chai
        .request(app)
        .post('/register')
        .send({
          firstName,
          lastName,
          password: "23231",
          email
        })
        .then(res => {
          expect(res).to.have.status(422);
          expect(res.body.reason).to.equal('ValidationError');
          expect(res.body.message).to.equal('Must be at least 10 characters long')
          expect(res.body.location).to.equal('password');
        })
      });
      it('Should reject submissions that include an email address that already exists in the database', function() {
          return seedEditorData()
            .then(() =>
              chai.request(app)
              .post('/register')
              .send({
                email,
                firstName,
                lastName,
                password
              })
            )
            .then(res => {
              expect(res).to.have.status(422);
              expect(res.body.reason).to.equal('ValidationError');
              expect(res.body.message).to.equal('Email is already associated with an editor account');
              expect(res.body.location).to.equal('email');
            })
        });
      it('Should create a new Editor', function () {
        return chai
          .request(app)
          .post('/register')
          .send({
            email,
            firstName,
            lastName,
            password
          })
          .then(res => {
            // console.log(res.body);
            expect(res).to.have.status(201);
            expect(res.body).to.be.an('object');
            expect(res.body).to.include.keys(
              'email', 'firstName','lastName');
            expect(res.body.email).to.equal(email);
            expect(res.body.firstName).to.equal(firstName);
            expect(res.body.lastName).to.equal(lastName);
            return Editor.findOne({
              email
            });
          })
          .then(editor => {
            expect(editor).to.not.be.null;
            expect(editor.firstName).to.equal(firstName);
            expect(editor.lastName).to.equal(lastName);
            return editor.validatePassword(password)
          })
          .then(passwordIsCorrect => {
            expect(passwordIsCorrect).to.be.true;
          });
      });
      it('Should trim firstName and lastName', function() {
        return chai
          .request(app)
          .post('/register')
          .send({
            email,
            password,
            firstName: ` ${firstName}`,
            lastName: ` ${lastName}`
          })
          .then(res => {
            expect(res).to.have.status(201);
            expect(res.body).to.be.an('object');
            expect(res.body).to.include.keys('email', 'firstName', 'lastName');
            expect(res.body.email).to.equal(email);
            expect(res.body.firstName).to.equal(firstName);
            expect(res.body.lastName).to.equal(lastName);
            return Editor.findOne({
              email
            });
          })
          .then(editor => {
            expect(editor).to.not.be.null;
            expect(editor.firstName).to.equal(firstName);
            expect(editor.lastName).to.equal(lastName);
          });
        });
    });
  })
})
