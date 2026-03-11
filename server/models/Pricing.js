// server/models/Pricing.js
const mongoose = require('mongoose');

const FeeSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  currency: { type: String, enum: ['MYR','USD'], required: true }
}, { _id: false });

const PricingSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: 'pricing-2026' },

  // Date used to determine Early Bird vs Normal
  earlyBirdDeadline: { type: Date, required: true }, // 2026-07-01

  // Official fee table (strictly from image + your confirmations)
  fees: {
localStudent: {
  early:  { type: FeeSchema, required: true },
  normal: { type: FeeSchema, required: true },
  member: { type: FeeSchema, required: true }
},
    internationalStudent: {
      early:  { type: FeeSchema, required: true },
      normal: { type: FeeSchema, required: true }
    },

    localProfessional: {
      standard:  { early: { type: FeeSchema, required:true }, normal: { type: FeeSchema, required:true } },
      committee: { early: { type: FeeSchema, required:true }, normal: { type: FeeSchema, required:true } },
      member:    { early: { type: FeeSchema, required:true }, normal: { type: FeeSchema, required:true } },
      symposia:  { early: { type: FeeSchema, required:true }, normal: { type: FeeSchema, required:true } },
      keynote:   { early: { type: FeeSchema, required:true }, normal: { type: FeeSchema, required:true } },
      plenary:   { early: { type: FeeSchema, required:true }, normal: { type: FeeSchema, required:true } }
    },

    internationalProfessional: {
      early:  { type: FeeSchema, required: true },
      normal: { type: FeeSchema, required: true }
    },
    industrialBooth: {
      early:  { type: FeeSchema, required: true },
      normal: { type: FeeSchema, required: true }
    }
  },

  // Keep dinnerAddon for backward-compat, but locked to 0 (you removed dinner)
  dinnerAddon: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Pricing', PricingSchema);
