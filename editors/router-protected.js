const express = require('express');
const bodyParser = require('body-parser');
const passport = require('passport');
const mongoose = require('mongoose');

const config = require('../config');
const {Editor} = require('../..models/editor');

const router = express.Router();

router.use(bodyParser.json());

const jwtAuth = passport.authenticate('jwt', { session: false });

//get request from an editor to find specific content
router.get('/', jwtAuth, (req, res) => {
  console.log(req.body);
  Editor
    .find()
    .then()
  return res.json({
  });
});

router.post('/', jwtAuth, (req, res) => {
  console.log('-req.body is', req.body);
  res.json({authToken});
});

router.put('/', jwtAuth, (req, res) => {
  return res.json({
  });
});

router.delete('/', jwtAuth, (req, res) => {
  return res.json({
  });
});

module.exports = {router};
