
'use strict';

const mongoose = require('mongoose');

const expertSchema = new mongoose.Schema({
  reference: {
    type: String,
    unique: true,
    sparse: true
  },

  event: {
    type: String,
    default: 'TERMIS-AP 2028',
    immutable: true
  },

  registrationType: {
    type: String,
    default: 'Expression of Interest',
    immutable: true
  },

  // Professional details
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 160
  },

  title: {
    type: String,
    trim: true,
    maxlength: 100
  },

  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    maxlength: 254
  },

  phone: {
    type: String,
    trim: true,
    maxlength: 50
  },

  organisation: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },

  designation: {
    type: String,
    required: true,
    trim: true,
    maxlength: 150
  },

  department: {
    type: String,
    trim: true,
    maxlength: 200
  },

  country: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },

  // Participation interests
  roles: {
    type: [String],
    required: true,
    validate: {
      validator: value =>
        Array.isArray(value) && value.length > 0,
      message: 'Select at least one participation role.'
    }
  },

  otherRole: {
    type: String,
    trim: true,
    maxlength: 200
  },

  expertise: {
    type: String,
    required: true,
    trim: true,
    maxlength: 3000
  },

  profile: {
    type: String,
    trim: true,
    maxlength: 500
  },

  availability: {
    type: String,
    trim: true,
    maxlength: 100,
    default: 'To be discussed'
  },

  notes: {
    type: String,
    trim: true,
    maxlength: 3000
  },

  // Consent
  consent: {
    type: Boolean,
    required: true,
    validate: {
      validator: value => value === true,
      message: 'Consent is required.'
    }
  },

  consentVersion: {
    type: String,
    default: 'TERMIS-AP-2028-v1'
  },

  // Administration
  status: {
    type: String,
    enum: [
      'New',
      'Under Review',
      'Shortlisted',
      'Contacted',
      'Confirmed',
      'Declined'
    ],
    default: 'New'
  },

  source: {
    type: String,
    default: 'birtlab.com/expert-form.html'
  }

}, {
  timestamps: true,
  collection: 'birt_experts',
  versionKey: false
});

// Useful for future administrative searches
expertSchema.index({
  event: 1,
  createdAt: -1
});

expertSchema.index(
  {
    email: 1,
    event: 1
  },
  {
    unique: true,
    name: 'unique_birt_email_event'
  }
);

module.exports =
  mongoose.models.BirtExpert ||
  mongoose.model('BirtExpert', expertSchema);
