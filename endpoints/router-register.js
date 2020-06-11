'use strict';

const express = require('express');
const bodyParser = require('express');

const {Editor} = require('../models/editor');

const router = express.Router();
const jsonParser = bodyParser.json();

router.post('/', jsonParser, (req, res) => {
  // console.log('-req.body sent to /register is:', req.body);
//verify that all required fields are there
  const requiredFields = ['email', 'password', 'firstName', 'lastName']
  const missingField = requiredFields.find(field => !(field in req.body));

  if (missingField){
    // console.log('you are missing the following field in your form:', missingField);
    return res.status(422).json({
      code: 422,
      // status 422 = "unprocessable entity"
      reason: 'ValidationError',
      message: 'Missing Field',
      location: missingField
    })
  }

//verify that all field inputs are of the right type
  const stringFields = ['email', 'password', 'firstName', 'lastName'];
  const nonStringField = stringFields.find(
    field => field in req.body && typeof req.body[field] !== 'string'
  );

  if (nonStringField) {
    return res.status(422).json({
      code: 422,
      reason: 'ValidationError',
      message: 'Incorrect field type: expected string',
      location: nonStringField
    });
  }

//verify that none of the fields that need to be explicitly trimmed
//were left untrimmed
  const explicitlyTrimmedFields = ['password'];
  const nonTrimmedField = explicitlyTrimmedFields.find(
    field => req.body[field].trim() !== req.body[field]
  );

  if (nonTrimmedField) {
    return res.status(422).json({
      code: 422,
      reason: 'ValidationError',
      message: 'Cannot start or end with whitespace',
      location: nonTrimmedField
    })
  }

  //verify that fields with size requirements fit within those requirements
  const sizedFields = {
    password: {
      min: 10,
      max: 72
    }
  };
  const tooSmallField = Object.keys(sizedFields).find(
    field =>
      'min' in sizedFields[field] &&
      req.body[field].trim().length < sizedFields[field].min
  );
  const tooLargeField = Object.keys(sizedFields).find(
    field =>
      'max' in sizedFields[field] &&
      req.body[field].trim().length > sizedFields[field].max
  );

  if (tooSmallField || tooLargeField) {
    return res.status(422).json({
      code: 422,
      reason: 'ValidationError',
      message: tooSmallField
      ? `Must be at least ${sizedFields[tooSmallField].min} characters long`
      : `Must be no larger than ${sizedFields[tooLargeField].max} characters long`,
      location: tooSmallField || tooLargeField
    })
  }

//trim the trimmable fields
let {email, password, firstName, lastName} = req.body;
email = email.trim().toLowerCase();
// console.log('email that you tried to register is', email);
firstName = firstName.trim().toLowerCase();
lastName = lastName.trim().toLowerCase();
return Editor.find({email})
  .count()
  .then(count => {
    // console.log('found', count);
    if (count > 0) {
     // console.log('there is already an editor in the DB with that email');
      //then there is an existing editor in the DB with this Email
      return res.status(422).json({
        code: 422,
        reason: 'ValidationError',
        message: 'Email is already associated with an editor account',
        location: 'email'
      });
    }
    //if there is no existing user, hash the password
    return Editor.hashPassword(password);
  })
  .then(hash => {
    return Editor.create({
      email,
      password: hash,
      firstName,
      lastName
    });
  })
  .then(editor => {
    return res.status(201).json(editor.serialize());
  })
  .catch(err => {
    // console.log('sending err back')
    return err
  });
});

module.exports = {router};
