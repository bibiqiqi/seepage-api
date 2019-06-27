'use strict';

const mongoose = require('mongoose');

mongoose.Promise = global.Promise;

const ContentSchema = mongoose.Schema({
  artistName: {type: String, require: true},
  title: {type: String, require: true},
  category: {type: String, require: true},
  tags: {type: [String], require: true},
});

ContentSchema.methods.serialize = function() {
  return {
    id: this._id,
    artistName: this.artistName,
    title: this.title,
    category: this.category,
    tags: this.tags,
  }
}

const Content = mongoose.model('Content', ContentSchema);

module.exports = {Content};


//the id of each content is copied to the corresponding files in fs.files.metadata.contentId
//so that when a user wants to see the actual file, they can pass the content's id to fetch it
