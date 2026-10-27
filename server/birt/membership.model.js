
'use strict';

const mongoose = require('mongoose');

const membershipSchema = new mongoose.Schema({

  memberId: {
    type: String,
    unique: true,
    sparse: true
  },

  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 160
  },

  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    maxlength: 254
  },

  title: {
    type: String,
    trim: true,
    maxlength: 100
  },

  organisation: {
    type: String,
    trim: true,
    maxlength: 200
  },

  designation: {
    type: String,
    trim: true,
    maxlength: 150
  },

  country: {
    type: String,
    trim: true,
    maxlength: 100
  },

  membershipCategory: {
    type: String,
    enum: [
      'Academic',
      'Researcher',
      'Student',
      'Clinician',
      'Industry Professional',
      'Other'
    ],
    required: true
  },

  expertise: {
    type: String,
    trim: true,
    maxlength: 3000
  },

  profile: {
    type: String,
    trim: true,
    maxlength: 500
  },

  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },

  membershipFee: {
    type: Number,
    default: 0,
    immutable: true
  },

  joinedAt: {
    type: Date,
    default: Date.now
  },

  source: {
    type: String,
    default: 'birtlab.com/membership.html'
  },

  researchUpdatesConsent: {
    type: Boolean,
    default: false
  },

  consent: {
    type: Boolean,
    required: true
  }

}, {
  timestamps: true,
  collection: 'birt_members',
  versionKey: false
});

// Prevent duplicate membership by email
membershipSchema.index(
  { email: 1 },
  {
    unique: true,
    name: 'unique_birt_member_email'
  }
);

module.exports =
  mongoose.models.BirtMember ||
  mongoose.model('BirtMember', membershipSchema);
