'use strict';

const mongoose = require('mongoose');

mongoose.Promise = global.Promise;

const FileSchema = mongoose.Schema({
  fileType: {type: String, require: true},
  fileName: {type: String, require: true},
  fileId: {type: String, require: true}
});

const ContentSchema = mongoose.Schema({
  artistName: {type: String, require: true},
  title: {type: String, require: true},
  description: {type: String, require: false},
  category: {type: [String], require: true},
  tags: {type: [String], require: true},
  files: [FileSchema]
});

FileSchema.methods.serialize = function() {
  return {
    id: this._id,
    fileType: this.fileType,
    fileName: this.fileName,
    fileId: this.fileId,
  }
}

ContentSchema.methods.serialize = function() {
  return {
    id: this._id,
    artistName: this.artistName,
    title: this.title,
    description: this.description,
    category: this.category,
    tags: this.tags,
    files: this.files
  }
}

const Content = mongoose.model('Content', ContentSchema);
const File = mongoose.model('File', FileSchema);


module.exports = {Content, File};
