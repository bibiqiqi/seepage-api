const _ = require('underscore');
const casual = require('casual-browserify');
//const fs = require('fs');

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
  //console.log('tag pool', tagPool);
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

const generateContent = () => {
  const categories = [
    {
      color: "red",
      category: "performance"
    },
    {
      color: "blue",
      category: "text"
    },
    {
      color: "yellow",
      category: "media"
    }
  ];
  const tagPool = createTagPool();
  const nodes = [];
  const randomNumber= _.random(4, 10);
  //console.log('number of nodes', randomNumber);
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
      //index: i,
      //key: uniqKey++,
      artistName: casual.full_name,
      title: casual.title,
      //color: type.color,
      category: type.category,
      tags: _.uniq(_.sortBy(pickTags(tagPool)), true),
      //content: fs.readFileSync('./dummyArt.jpg')
    };
 }
 //console.log('nodes', nodes);
 return nodes;
}

module.exports = {generateContent};
