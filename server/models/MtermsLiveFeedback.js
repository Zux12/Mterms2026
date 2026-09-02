const mongoose = require('mongoose');

const MtermsLiveFeedbackSchema = new mongoose.Schema({
  feedbackType: {
    type: String,
    enum: ['session', 'conference'],
    required: true,
    index: true
  },

  sessionId: {
    type: String,
    trim: true,
    maxlength: 120,
    default: '',
    index: true
  },

  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },

  comment: {
    type: String,
    trim: true,
    maxlength: 1000,
    default: ''
  },

  participantId: {
    type: String,
    trim: true,
    maxlength: 200,
    default: '',
    index: true
  }

}, {
  timestamps: true,
  collection: 'mtermslive_feedback'
});

MtermsLiveFeedbackSchema.index({
  feedbackType: 1,
  sessionId: 1,
  createdAt: -1
});

module.exports =
  mongoose.models.MtermsLiveFeedback ||
  mongoose.model(
    'MtermsLiveFeedback',
    MtermsLiveFeedbackSchema
  );
