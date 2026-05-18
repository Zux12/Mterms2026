// server/models/AbstractReview.js
const mongoose = require('mongoose');

const AbstractReviewSchema = new mongoose.Schema({
  registrationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Registration',
    required: true,
    index: true
  },

  regCode: {
    type: String,
    required: true,
    index: true
  },

  assignedReviewerUsername: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },

  assignedBy: {
    type: String,
    default: 'admin'
  },

  assignedAt: {
    type: Date,
    default: Date.now
  },

  status: {
    type: String,
    enum: ['assigned', 'draft', 'submitted'],
    default: 'assigned',
    index: true
  },

  scores: {
    introductionObjective: { type: Number, default: 0, min: 0, max: 5 },
    materialsMethods: { type: Number, default: 0, min: 0, max: 5 },
    results: { type: Number, default: 0, min: 0, max: 10 },
    conclusion: { type: Number, default: 0, min: 0, max: 5 },
    significanceImplication: { type: Number, default: 0, min: 0, max: 10 },
    total: { type: Number, default: 0, min: 0, max: 35 }
  },

  requireCorrection: {
    type: String,
    enum: ['yes', 'no', ''],
    default: ''
  },

  correctionReasons: {
    tooLong: { type: Boolean, default: false },
    poorlyWritten: { type: Boolean, default: false },
    weakHypothesis: { type: Boolean, default: false },
    vagueExperimentalPlan: { type: Boolean, default: false },
    insufficientData: { type: Boolean, default: false },
    others: { type: Boolean, default: false },
    othersText: { type: String, default: '' }
  },

  recommendedCategory: {
    type: String,
    enum: ['Oral presentation', 'Poster presentation', ''],
    default: ''
  },

  reviewerFile: {
    gridFsId: mongoose.Schema.Types.ObjectId,
    filename: String,
    size: Number,
    contentType: String,
    uploadedAt: Date
  },

  submittedAt: Date
}, { timestamps: true });

AbstractReviewSchema.index({ registrationId: 1, assignedReviewerUsername: 1 }, { unique: true });

module.exports = mongoose.model('AbstractReview', AbstractReviewSchema);
