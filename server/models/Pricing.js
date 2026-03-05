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
      normal: { type: FeeSchema, required: true }
    },
    internationalStudent: {
      early:  { type: FeeSchema, required: true },
      normal: { type: FeeSchema, required: true }
    },
    localProfessional: {
      standard:  { early: { type: FeeSchema, required:true }, normal: { type: FeeSchema, required:true } },
      committee:{ early: FeeSchema, normal: FeeSchema },
      member:   { early: FeeSchema, normal: FeeSchema },
      symposia: { early: FeeSchema, normal: FeeSchema },
      keynote:  { early: FeeSchema, normal: FeeSchema },
      plenary:  { early: FeeSchema, normal: FeeSchema }
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
