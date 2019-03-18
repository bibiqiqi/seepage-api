'use strict';
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const EditorSchema = mongoose.Schema({
  shortId: {type: String, require: true, unique: true},
  name: {type: String, require: true},
  title: {type: String, require: true},
  category: {type: String, require: true},
  tags: {}
});

EditorSchema.methods.serialize = function() {
  return {
    shortId: this.shortId || '',
    email: this.email || '',
    firstName: this.firstName || '',
    lastName: this.lastName || ''
  }
}

EditorSchema.methods.validatePassword = function(password) {
  return bcrypt.compare(password, this.password);
};

EditorSchema.statics.hashPassword = function(password) {
  return bcrypt.hash(password, 10);
};

const Editor = mongoose.model('Editor', EditorSchema);
const Content = mongoose.model('Content', ContentSchema);

module.exports = {Editor, Content};
