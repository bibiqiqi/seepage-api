'use strict';
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const EditorSchema = mongoose.Schema({
  email: {type: String, required: true, unique: true},
  password: {type: String, required: true},
  firstName: {type: String, default: ''},
  lastName: {type: String, default: ''}
});

EditorSchema.methods.serialize = function() {
  return {
    id: this._id,
    email: this.email,
    firstName: this.firstName,
    lastName: this.lastName
  }
}

EditorSchema.methods.validatePassword = function(password) {
  return bcrypt.compare(password, this.password);
};

EditorSchema.statics.hashPassword = function(password) {
  return bcrypt.hash(password, 10);
};

const Editor = mongoose.model('Editor', EditorSchema);

module.exports = {Editor};
