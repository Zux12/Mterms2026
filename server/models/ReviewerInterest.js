// server/models/ReviewerInterest.js
const mongoose = require('mongoose');

const ReviewerInterestSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    trim: true
  },

  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    unique: true,
    index: true
  },

  phone: {
    type: String,
    default: '',
    trim: true
  },

  institution: {
    type: String,
    required: true,
    trim: true
  },

  position: {
    type: String,
    required: true,
    trim: true
  },

  country: {
    type: String,
    required: true,
    trim: true
  },

  expertise: {
    type: String,
    required: true,
    trim: true
  },

  highestQualification: {
    type: String,
    default: '',
    trim: true
  },

  scholarProfile: {
    type: String,
    default: '',
    trim: true
  },

  professionalProfileText: {
    type: String,
    default: '',
    trim: true
  },

  profileFile: {
    gridFsId: mongoose.Schema.Types.ObjectId,
    filename: String,
    size: Number,
    contentType: String,
    uploadedAt: Date
  },

  consentContact: {
    type: Boolean,
    required: true,
    default: false
  },

  source: {
    type: String,
    default: 'MTERMS2026 Reviewer Network'
  },

  status: {
    type: String,
    enum: ['new', 'contacted', 'shortlisted', 'archived'],
    default: 'new',
    index: true
  },

  notes: {
    type: String,
    default: ''
  }

}, { timestamps: true });

module.exports = mongoose.model('ReviewerInterest', ReviewerInterestSchema);
