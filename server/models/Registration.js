// server/models/Registration.js
const mongoose = require('mongoose');

const RegistrationSchema = new mongoose.Schema({
  regCode: { type: String, unique: true },

  category: { type: String, enum: ['student', 'academia', 'industry'], required: true },

  personal: {
    firstName: { type: String, required: true },
    lastName:  { type: String, required: true },
    email:     { type: String, required: true, index: true },
    phone:     { type: String },
    country:   { type: String }
  },

  professional: {
    affiliation: { type: String, required: true }, // uni/company
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
    billTo:   { type: String },       // for invoices/receipts
    taxNo:    { type: String },       // GST/VAT/Tax ID (optional)
    poNumber: { type: String }
  },

  program: {
    presenting: { type: Boolean, default: false },
    type:       { type: String, enum: ['talk', 'poster', 'workshop', 'none'], default: 'none' },
    title:      { type: String },
    topicArea:  { type: String }
  },

  student: {
    university: { type: String },
    level:      { type: String, enum: ['UG','MSc','PhD','Other'], default: 'Other' },
    expectedGradYear: { type: Number }
  },

  studentProof: {
    required:  { type: Boolean, default: false },     // true if category = student
    deferred:  { type: Boolean, default: false },     // user chose "upload later"
    provided:  { type: Boolean, default: false },     // will flip true when file is uploaded (Step 4)
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
    phase:    { type: String },     // Early-bird / Regular / Late/On-site
    base:     { type: Number },
    addons:   { type: Number, default: 0 },
    total:    { type: Number }
  },

  payment: {
    method: { type: String, default: 'manual' }, // placeholder until we wire Stripe
    status: { type: String, default: 'pending' } // pending|paid|failed|refunded
  }
}, { timestamps: true });

module.exports = mongoose.model('Registration', RegistrationSchema);
