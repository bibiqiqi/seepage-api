'use strict';

const mongoose = require('mongoose');

mongoose.Promise = global.Promise;

const ThumbNailSchema = mongoose.Schema({
  contentId: {type: String, require: true},
  fileName: {type: String, require: true},
  key: {type: Number, require: true},
  data: {type: Buffer, require: true}
});

const ContentSchema = mongoose.Schema({
  artistName: {type: String, require: true},
  title: {type: String, require: true},
  category: {type: [String], require: true},
  tags: {type: [String], require: true},
  thumbNails: [ThumbNailSchema]
});

ThumbNailSchema.methods.serialize = function() {
  return {
    id: this._id,
    contentId: this.contentId,
    fileName: this.fileName,
    key: this.key,
    data: this.data,
  }
}

ContentSchema.methods.serialize = function() {
  return {
    id: this._id,
    artistName: this.artistName,
    title: this.title,
    category: this.category,
    tags: this.tags,
    thumbNails: this.thumbNails
  }
}

const Content = mongoose.model('Content', ContentSchema);

module.exports = {Content};
