'use strict';
require('dotenv').config()
//process.env.DATABASE_URL ||
exports.DATABASE_URL = 'mongodb://localhost/seepage';
//process.env.TEST_DATABASE_URL ||
exports.TEST_DATABASE_URL =  'mongodb://localhost/test-seepage';
exports.PORT = process.env.PORT || 8080;
exports.JWT_SECRET = process.env.JWT_SECRET;
exports.JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';
//add heroku domain
exports.CLIENT_ORIGIN = "http://localhost:3000";
