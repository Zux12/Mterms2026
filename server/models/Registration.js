// server/models/Registration.js
const mongoose = require('mongoose');

const RegistrationSchema = new mongoose.Schema({
  regCode: { type: String, unique: true },

  category: { type: String, enum: ['student', 'academia', 'industry'], required: true },

  personal: {
    firstName: { type: String, required: true },
    lastName:  { type: String, required: true },
    email:     { type: String, required: true, index: true },
    phone:     { type: String }
  },

  professional: {
    affiliation: { type: String, required: true },
    department:  { type: String },
    roleTitle:   { type: String }
  },

  addons: {
    dinner: { type: Boolean, default: false }
  },

  pricingSnapshot: {
    currency: { type: String, default: 'MYR' },
    phase: { type: String },          // Early-bird / Regular / Late/On-site
    base: { type: Number },           // base price for category
    addons: { type: Number, default: 0 },
    total: { type: Number }           // base + addons
  },

  payment: {
    method: { type: String, default: 'manual' }, // placeholder
    status: { type: String, default: 'pending' } // pending|paid|failed|refunded
  }
}, { timestamps: true });

module.exports = mongoose.model('Registration', RegistrationSchema);
