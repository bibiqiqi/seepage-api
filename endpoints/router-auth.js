const express = require('express');
const passport = require('passport');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');


const config = require('../config');
const router = express.Router();

const createAuthToken = user => {
  console.log('-user passed to createAuthToken() is:', user);
  return jwt.sign({user}, config.JWT_SECRET, {
    subject: user.email,
    expiresIn: config.JWT_EXPIRY,
    algorithm:'HS256'
  })
};

const localAuth = passport.authenticate('local', {session: false});

router.use(bodyParser.json());

router.post('/login', localAuth, (req, res) => {
  try {
    console.log('-req.body sent to /auth/login is', req.body);
    const authToken = createAuthToken(req.user.serialize());
    console.log('-server is sending this authToken back to client:', authToken);
    res.json({authToken});
  } catch(err) {
    res.status(500).json({error: err});
  }
});

const jwtAuth = passport.authenticate('jwt', {session: false});

router.post('/refresh', jwtAuth, (req, res) => {
  try {
    console.log('-req.user is', req.user);
    const authToken = createAuthToken(req.user);
    res.json({authToken});
  } catch(err) {
    res.status(500).json({error: err});
  }
});


module.exports = {router};
