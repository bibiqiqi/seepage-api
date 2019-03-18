'use strict';
const {router: registerRouter} = require('./router-editors');
const {router: protectedRouter} = require('./router-protected');
const {router: authRouter} = require('./router-auth');
const {localStrategy, jwtStrategy} = require('./strategies');

module.exports = {Editor, authRouter, registerRouter, protectedRouter, localStrategy, jwtStrategy};
