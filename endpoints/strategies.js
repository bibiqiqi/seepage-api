'use strict';
const { Strategy: LocalStrategy } = require('passport-local');
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');

const { Editor } = require('../models/editor');
const { JWT_SECRET } = require('../config');

const localStrategy = new LocalStrategy({
  usernameField: 'email',
},
(email, password, callback) => {
    console.log('-reached localStrategy! email and password received are:', email, password);
  let editor;
  Editor.findOne({email: email})
    .then(_editor => {
        console.log('-matching editor in DB is:', _editor);
      editor = _editor;
      if(!editor) {
          console.log('-editor doesnt exist');
        return Promise.reject({
          reason: 'LoginError',
          message: 'Incorrect email or password'
        });
      }
        console.log('-editor exists. validating password...')
      return editor.validatePassword(password)
    })
    .then(isValid => {
      if (!isValid) {
          console.log('-password isnt valid', isValid);
        return Promise.reject({
          reason: 'LoginError',
          message: 'Incorrect email or password'
        });
      }
        console.log('-password is valid');
      return callback(null, editor);
    })
    .catch(err => {
      if (err.reason === 'LoginError') {
        return callback(null, false, err);
      }
      return callback(err, false);
    });
});

const jwtStrategy = new JwtStrategy(
  {
    secretOrKey: JWT_SECRET,
    jwtFromRequest: ExtractJwt.fromAuthHeaderWithScheme('Bearer'),
    algorithms: ['HS256']
  },
  (payload, done) => {
      console.log('-reached JWTStrategy! payload is: ', payload);
    done(null, payload.user);
  }
);

module.exports = { localStrategy, jwtStrategy }
