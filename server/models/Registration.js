// server/models/Registration.js
const mongoose = require('mongoose');

const UploadSchema = new mongoose.Schema({
  type: { type: String, enum: ['studentProof','bankReceipt','abstract','slides','profilePhoto'], required: true },
  version: { type: Number, required: true },
  gridFsId: { type: mongoose.Schema.Types.ObjectId, required: true },
  filename: String,
  size: Number,
  contentType: String,
  uploadedAt: { type: Date, default: Date.now }
}, { _id: false });

const RegistrationSchema = new mongoose.Schema({
  regCode: { type: String, unique: true },

  category: { type: String, enum: ['student', 'academia', 'industry'], required: true },

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
    status: { type: String, default: 'pending' }
  },

  uploads: [UploadSchema]
}, { timestamps: true });

module.exports = mongoose.model('Registration', RegistrationSchema);
