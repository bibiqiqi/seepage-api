const _ = require('underscore');
const fs = require('fs');
const url = require('url');
const faker = require('faker');
const mongoose = require('mongoose');
const chai = require('chai');
const chaiHttp = require('chai-http');
const jwt = require('jsonwebtoken');

const { app } = require('../server');
const { Content } = require('../models/content');
const { JWT_SECRET } = require('../config');
chai.use(chaiHttp);

const email = 'EdnaEditor@aol.com';
const password = '1234567890';
const firstName = 'Edna';
const lastName = 'Editor';

const realUser = {
    email,
    firstName,
    lastName
}

function realToken(thisUser) {
  const user = thisUser;
  // console.log('user passed to realToken is', {user});
  return (
    jwt.sign(
      {user},
      JWT_SECRET,
      {
        algorithm: 'HS256',
        subject: email,
        expiresIn: '7d'
      }
    )
  )
}

//for each set of data(nodes and links), createTagPool() generates a
//pool of tags, then generateNodes() generates a random number of nodes,
//and each node has a random number and combination of tags that are
//picked from the pool of tags.
//then the links are generated based on the tags that the nodes share

function createTagPool(){
  let tagPool = [];
  let i;
  for (i = 0; i < 10; i++) {
    tagPool.push(faker.lorem.word());
  }
  _.uniq(tagPool);
  return tagPool;
}

function pickTags(tagPool){
  let tags = [];
  const randomNumber=_.random(1, 5);
  let i;
  for (i = 0; i < randomNumber; i++) {
   tags.push(tagPool[_.random(0, tagPool.length-1)]) ;
  }
  return tags;
}

function genFakeDataPromises(promiseNum, token, user){
  return new Promise(function(resolve, reject) {
    const categories = [
      "performance",
      "text",
      "media",
    ];
    const tagPool = createTagPool();
    const seedPromises = [];
    let i;
    for (i = 0; i < promiseNum; i++) {
      seedPromises.push(genPostAndSeedPromise(categories, tagPool, token, user))
    }
    resolve(seedPromises);
  })
}

function genPostAndSeedPromise(categories, tagPool, token, user) {
  return new Promise(async function(resolve, reject) {
    const category = categories[_.random(0, 2)];
    const tags = _.uniq(_.sortBy(pickTags(tagPool)), true)
    let generatedPost = await generatePost(category, tags);
    let seededPost = await seedPost(generatedPost, token, user);
    // console.log('seeded a post', seededPost)
    resolve(seededPost)
  })
}

async function genAndReturnPost() {
  const categories = [
    "performance",
    "text",
    "media",
  ];
  const category = categories[_.random(0, 2)];
  const tagPool = createTagPool();
  const tags = _.uniq(_.sortBy(pickTags(tagPool)), true)
  let generatedPost = await generatePost(category, tags);
  return generatedPost
}

function generatePost(category, tags) {
  return new Promise(function(resolve, reject) {
    const post = {
      artistName: faker.name.findName(),
      title: faker.lorem.words(),
      category: category,
      description: faker.lorem.paragraph(),
      tags: tags,
    };
    resolve(post)
  })
}

function seedPost(post, token, user){
  return new Promise(function(resolve, reject) {
    const authToken = token(user);
    return chai
      .request(app)
      .post('/protected/content')
      .set('authorization', `Bearer ${authToken}`)
      .type('multipart/form')
      .field(Object.keys(post)[0], Object.values(post)[0])
      .field(Object.keys(post)[1], Object.values(post)[1])
      .field(Object.keys(post)[2], Object.values(post)[2])
      .field(Object.keys(post)[3], Object.values(post)[3])
      .field(Object.keys(post)[4], Object.values(post)[4])
      .attach('files', fs.readFileSync('./test/dummy-file-1.jpg'), 'dummy-file-1.jpg')
      .then(res => {
        // console.log('seeded a post', res)
        resolve(res);
      })
      .catch(err => {
        // console.log('error in seeding post')
        reject(err);
      })
  })
}

function tearDownDb(){
  return new Promise((resolve, reject) => {
    mongoose.connection.dropDatabase()
      .then(result => {
        console.log('deleted database')
        resolve(result)
      })
      .catch(err => {
        console.log('error in deleting database')
        reject(err)
      })
  });
}

module.exports = {tearDownDb, genFakeDataPromises, realToken, realUser, genAndReturnPost, seedPost};
