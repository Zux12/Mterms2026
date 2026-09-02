const mongoose = require('mongoose');

const ReplySchema = new mongoose.Schema({
  author: {
    type: String,
    trim: true,
    maxlength: 50,
    required: true
  },

  title: {
    type: String,
    trim: true,
    maxlength: 30,
    default: ''
  },

  affiliation: {
    type: String,
    trim: true,
    maxlength: 80,
    default: ''
  },

  message: {
    type: String,
    trim: true,
    maxlength: 1000,
    required: true
  },

  participantId: {
    type: String,
    trim: true,
    maxlength: 200,
    default: ''
  },

  createdAt: {
    type: Date,
    default: Date.now
  }

}, {
  _id: true
});

const MtermsLiveMessageSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120,
    index: true
  },

  author: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },

  title: {
    type: String,
    trim: true,
    maxlength: 30,
    default: ''
  },

  affiliation: {
    type: String,
    trim: true,
    maxlength: 80,
    default: ''
  },

  messageType: {
    type: String,
    enum: ['Discussion', 'Question'],
    default: 'Discussion',
    index: true
  },

  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },

  likes: {
    type: Number,
    default: 0,
    min: 0
  },

  participantId: {
    type: String,
    trim: true,
    maxlength: 200,
    default: '',
    index: true
  },

  replies: {
    type: [ReplySchema],
    default: []
  },

  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  }

}, {
  timestamps: true,
  collection: 'mtermslive_messages'
});

MtermsLiveMessageSchema.index({
  sessionId: 1,
  createdAt: -1
});

module.exports =
  mongoose.models.MtermsLiveMessage ||
  mongoose.model(
    'MtermsLiveMessage',
    MtermsLiveMessageSchema
  );
