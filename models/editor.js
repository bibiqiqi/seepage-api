'use strict';
const mongoose = require('mongoose');

const ContentSchema = mongoose.Schema({
  shortId: {type: String, require: true, unique: true},
  email: {type: String, required: true, unique: true},
  password: {type: String, required: true},
  firstName: {type: String, default: ''},
  lastName: {type: String, default: ''}
});

ContentSchema.methods.serialize = function() {
  return {
    shortId: this.shortId || '',
    email: this.email || '',
    firstName: this.firstName || '',
    lastName: this.lastName || ''
  }
}

ContentSchema.methods.validatePassword = function(password) {
  return bcrypt.compare(password, this.password);
};

ContentSchema.statics.hashPassword = function(password) {
  return bcrypt.hash(password, 10);
};

const Content = mongoose.model('Content', ContentSchema);

module.exports = {Content};
