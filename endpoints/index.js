'use strict';
const {router: registerRouter} = require('./router-register');
const {router: protectedRouter} = require('./router-protected');
const {router: authRouter} = require('./router-auth');
const {router: contentRouter} = require('./router-read-content');
const {localStrategy, jwtStrategy} = require('./strategies');

module.exports = {registerRouter, authRouter, contentRouter, protectedRouter, localStrategy, jwtStrategy};
