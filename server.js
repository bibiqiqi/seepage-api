require('dotenv').config();

const express = require('express');
const passport = require('passport');
const mongoose = require('mongoose');
const morgan = require('morgan');
const cors = require('cors');
const methodOverride = require('method-override');

const { registerRouter, authRouter, contentRouter, protectedRouter, localStrategy, jwtStrategy } = require('./endpoints');

mongoose.Promise = global.Promise;

const {CLIENT_ORIGIN, DATABASE_URL, PORT} = require('./config');

const app = express();

app.use(
   cors({
       origin: CLIENT_ORIGIN,
       credentials: true
   })
);

passport.use(localStrategy);
passport.use(jwtStrategy);
app.use(methodOverride('_method'));
app.use('/register', registerRouter);
app.use('/auth', authRouter);
app.use('/protected', protectedRouter);
app.use('/content', contentRouter);


app.use('*', function (req, res) {
  res.status(404).json({ message: 'Not Found' });
});

let server;

function runServer(databaseUrl, port = PORT) {
  return new Promise((resolve, reject) => {
    mongoose.connect(encodeURI(databaseUrl), err => {
      if (err) {
        return reject(err);
      } else {
        console.log('connected to mongoose', databaseUrl);
      }
      server = app.listen(port, () => {
        console.log(`Your app is listening on port ${port}`);
        resolve();
      })
        .on('error', err => {
          mongoose.disconnect();
          reject(err);
        });
    });
  });
}

function closeServer() {
  return mongoose.disconnect().then(() => {
    return new Promise((resolve, reject) => {
      console.log('Closing server');
      server.close(err => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  });
}

if (require.main === module) {
  runServer(DATABASE_URL).catch(err => console.error(err));
}

module.exports = { runServer, app, closeServer };
