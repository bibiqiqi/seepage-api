const { app, closeServer, runServer } = require('../server');
const { TEST_DATABASE_URL } = require('../config');

describe('all tests', function() {
  before(function() {
    return runServer(TEST_DATABASE_URL)
  });

  after(function() {
    return closeServer();
  });

  describe('auth suite', function() {
    require('./test-auth.js');
  })

  describe('protected endpoints suite', function() {
    require('./test-protected.js');
  })

  describe('non-protected endpoints suite', function() {
    require('./test-read-content.js');
  })

  describe('register endpoint suite', function() {
    require('./test-register.js');
  })
})
