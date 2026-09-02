const mongoose = require('mongoose');

const MtermsLiveInformationSchema = new mongoose.Schema({
  key: {
    type: String,
    default: 'main',
    unique: true,
    index: true
  },

  venue: {
    type: String,
    trim: true,
    maxlength: 3000,
    default: ''
  },

  wifi: {
    type: String,
    trim: true,
    maxlength: 3000,
    default: ''
  },

  help: {
    type: String,
    trim: true,
    maxlength: 3000,
    default: ''
  },

  other: {
    type: String,
    trim: true,
    maxlength: 3000,
    default: ''
  }

}, {
  timestamps: true,
  collection: 'mtermslive_information'
});

module.exports =
  mongoose.models.MtermsLiveInformation ||
  mongoose.model(
    'MtermsLiveInformation',
    MtermsLiveInformationSchema
  );
