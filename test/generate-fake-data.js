const mongoose = require('mongoose');
const _ = require('underscore');
const casual = require('casual-browserify');
//const fs = require('fs');


function tearDownDb(){
  return new Promise((resolve, reject) => {
    console.warn('Deleting database');
    mongoose.connection.dropDatabase()
      .then(result => resolve(result))
      .catch(err => reject(err));
  });
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
    tagPool.push(casual.word);
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

function generateContent(){
  const categories = [
    "performance",
    "text",
    "media",
  ];
  const tagPool = createTagPool();
  const nodes = [];
  const randomNumber= _.random(4, 10);
  let uniqKey = 100;
  let i;
  for (i = 0; i < randomNumber; i++) {
    const type = categories[_.random(0, 2)];
    //const imgData = (imgGen.generateImage(800, 600, 80, function(err, image) {
      //console.log(image);
      //return image;
      //fs.writeFileSync('dummy.jpg', image.data);
    //});

    nodes[i] = {
      artistName: casual.full_name,
      title: casual.title,
      category: type.category,
      description: casual.description,
      tags: _.uniq(_.sortBy(pickTags(tagPool)), true),
      files: []
    };
 }
 //console.log('nodes', nodes);
 return nodes;
}



module.exports = {tearDownDb, generateContent};
