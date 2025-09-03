// server/models/Pricing.js
const mongoose = require('mongoose');

const PricingSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: 'pricing-2026' },
  currency: { type: String, default: 'MYR' },
  eventStartDate: { type: Date, required: true },
  base: {
    student: { type: Number, required: true },
    academia: { type: Number, required: true },
    industry: { type: Number, required: true }
  },
  adjustments: {
    early: {
      student: { type: Number, default: -50 },
      academia: { type: Number, default: -50 },
      industry: { type: Number, default: -50 }
    },
    late: {
      student: { type: Number, default: 50 },
      academia: { type: Number, default: 50 },
      industry: { type: Number, default: 100 }
    }
  },
  dinnerAddon: { type: Number, default: 150 }
}, { timestamps: true });

module.exports = mongoose.model('Pricing', PricingSchema);
