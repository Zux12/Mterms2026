// server/models/Registration.js
const mongoose = require('mongoose');

const UploadSchema = new mongoose.Schema({
  type: { type: String, enum: ['studentProof','bankReceipt','abstract','slides','poster','profilePhoto'], required: true },
  version: { type: Number, required: true },
  gridFsId: { type: mongoose.Schema.Types.ObjectId, required: true },
  filename: String,
  size: Number,
  contentType: String,
  uploadedAt: { type: Date, default: Date.now }
}, { _id: false });



const IgniteAIAssessmentSchema = new mongoose.Schema({
  assessmentId: {
    type: String,
    required: true
  },

  status: {
    type: String,
    enum: ['completed'],
    default: 'completed'
  },

  abstractVersion: {
    type: Number,
    required: true
  },

  abstractGridFsId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },

  abstractFilename: {
    type: String,
    default: ''
  },

  abstractContentType: {
    type: String,
    default: ''
  },

  abstractUploadedAt: {
    type: Date
  },

  scores: {
    introductionObjective: {
      type: Number,
      required: true,
      min: 0,
      max: 5
    },

    materialsMethods: {
      type: Number,
      required: true,
      min: 0,
      max: 5
    },

    results: {
      type: Number,
      required: true,
      enum: [0, 2, 4, 6, 8, 10]
    },

    conclusion: {
      type: Number,
      required: true,
      min: 0,
      max: 5
    },

    significanceImplication: {
      type: Number,
      required: true,
      enum: [0, 2, 4, 6, 8, 10]
    },

    total: {
      type: Number,
      required: true,
      min: 0,
      max: 35
    }
  },

  scoreJustifications: {
    introductionObjective: {
      type: String,
      default: ''
    },

    materialsMethods: {
      type: String,
      default: ''
    },

    results: {
      type: String,
      default: ''
    },

    conclusion: {
      type: String,
      default: ''
    },

    significanceImplication: {
      type: String,
      default: ''
    }
  },

  requireCorrection: {
    type: String,
    enum: ['yes', 'no'],
    required: true
  },

  correctionReasons: {
    tooLong: {
      type: Boolean,
      default: false
    },

    poorlyWritten: {
      type: Boolean,
      default: false
    },

    weakHypothesis: {
      type: Boolean,
      default: false
    },

    vagueExperimentalPlan: {
      type: Boolean,
      default: false
    },

    insufficientData: {
      type: Boolean,
      default: false
    },

    others: {
      type: Boolean,
      default: false
    },

    othersText: {
      type: String,
      default: ''
    }
  },

  recommendedCategory: {
    type: String,
    enum: ['Oral presentation', 'Poster presentation'],
    required: true
  },

  model: {
    type: String,
    default: ''
  },

  rubricVersion: {
    type: String,
    default: 'MTERMS-2026-v1'
  },

  assessedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });



const RegistrationSchema = new mongoose.Schema({
  regCode: { type: String, unique: true },

category: {
  type: String,
  enum: [
    'Local Student',
    'International Student',
    'Local Professional',
    'International Professional',
    'Industrial Booth'
  ],
  required: true
},

// New fields to support Option B UI
nationality: { type: String, enum: ['Malaysian','Non-Malaysian'], required: true },
roleType: { type: String, enum: ['Student','Professional','Industrial Booth'], required: true },

// Only relevant when roleType === 'Professional' and nationality === 'Malaysian'
professionalSubtype: {
  type: String,
  enum: ['Standard','Committee','Member','Symposia Speaker','Keynote','Plenary'],
  default: 'Standard'
},

tesmaMember: { type: Boolean, default: false },
  
  personal: {
    firstName: { type: String, required: true },
    lastName:  { type: String, required: true },
email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    phone:     { type: String },
    country:   { type: String }
  },

  auth: {
    passwordHash: { type: String, select: false }, // bcrypt hash only (never plain password)
    passwordSetAt: { type: Date },

    // for "Forgot password" later
    resetTokenHash: { type: String, select: false },
    resetTokenExpiresAt: { type: Date }
  },
  
  professional: {
    affiliation: { type: String, required: true },
    department:  { type: String },
    roleTitle:   { type: String }
  },

  address: {
    line1:   { type: String },
    line2:   { type: String },
    city:    { type: String },
    state:   { type: String },
    postcode:{ type: String },
    country: { type: String }
  },

  billing: {
    billTo:   { type: String },
    taxNo:    { type: String },
    poNumber: { type: String }
  },

  program: {
    presenting: { type: Boolean, default: false },
    type:       { type: String, enum: ['talk','poster','workshop','none'], default: 'none' },
    title:      { type: String },
    topicArea:  { type: String }
  },

  submission: {
  theme: { type: String },
  field: { type: String },
  title: { type: String },
  authors: [
    {
      firstName: { type: String },
      lastName: { type: String },
      email: { type: String },
      affiliation: { type: String },
      country: { type: String },
      isCorresponding: { type: Boolean, default: false }
    }
  ],
  updatedAt: { type: Date }
},

  student: {
    university: { type: String },
    level:      { type: String, enum: ['UG','MSc','PhD','Other'], default: 'Other' },
    expectedGradYear: { type: Number }
  },

  studentProof: {
    required:  { type: Boolean, default: false },
    deferred:  { type: Boolean, default: false },
    provided:  { type: Boolean, default: false },
    status:    { type: String, enum: ['unverified','verified','rejected'], default: 'unverified' },
    notes:     { type: String }
  },

  addons: {
    dinner: { type: Boolean, default: false }
  },

  consents: {
    pdpa:           { type: Boolean, required: true },
    codeOfConduct:  { type: Boolean, required: true },
    marketingOptIn: { type: Boolean, default: false }
  },

  pricingSnapshot: {
    currency: { type: String, default: 'MYR' },
    phase:    { type: String },
    base:     { type: Number },
    addons:   { type: Number, default: 0 },
    total:    { type: Number }
  },

payment: {
  method: { type: String, default: 'manual' },
  status: { type: String, default: 'pending' },
  amount: { type: Number }
},

reviewEmailHistory: [{
  sentAt: { type: Date, default: Date.now },
  sentBy: { type: String, default: 'admin' },
  subject: { type: String },
  commentSnapshot: { type: String }
}],

igniteAIAssessments: {
  type: [IgniteAIAssessmentSchema],
  default: []
},

uploads: [UploadSchema]
  
}, { timestamps: true });

module.exports = mongoose.model('Registration', RegistrationSchema);
