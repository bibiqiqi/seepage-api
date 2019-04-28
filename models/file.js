'use strict';

const mongoose = require('mongoose');

mongoose.Promise = global.Promise;

const FileSchema = gridfs.schema({
  contentId: {type: String, require: true},
  artistName: {type: String, require: true},
  title: {type: String, require: true},
  content: {type: mongoose.Schema.Types.Mixed, require: true}
});

FileSchema.methods.serialize = function() {
  return {
    id: this._id,
    contentId: this.contentId,
    artistName: this.artistName,
    title: this.title,
    content: this.content
  }
}

module.export = mongoose.model('File', FileSchema );
