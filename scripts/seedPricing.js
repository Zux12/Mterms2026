// scripts/seedPricing.js
require('dotenv').config();
const mongoose = require('mongoose');
const Pricing = require('../server/models/Pricing');

(async () => {
  try {
    await mongoose.connect(process.env.MTERM2026_DB_URI);

    // Strict rule you confirmed
    const EARLY_BIRD_DEADLINE = new Date('2026-07-01T23:59:59.999Z');

    const payload = {
      key: 'pricing-2026',
      earlyBirdDeadline: EARLY_BIRD_DEADLINE,

fees: {
  localStudent: {
    early:  { amount: 500, currency: 'MYR' },
    normal: { amount: 550, currency: 'MYR' },
    member: { amount: 450, currency: 'MYR' }
  },
  internationalStudent: {
    early:  { amount: 140, currency: 'USD' },
    normal: { amount: 180, currency: 'USD' }
  },
  localProfessional: {
    standard:  { early: { amount: 750, currency: 'MYR' }, normal: { amount: 850, currency: 'MYR' } },
    committee: { early: { amount: 450, currency: 'MYR' }, normal: { amount: 450, currency: 'MYR' } },
    member:    { early: { amount: 650, currency: 'MYR' }, normal: { amount: 650, currency: 'MYR' } },
    symposia:  { early: { amount: 450, currency: 'MYR' }, normal: { amount: 650, currency: 'MYR' } },
    keynote:   { early: { amount:   0, currency: 'MYR' }, normal: { amount:   0, currency: 'MYR' } },
    plenary:   { early: { amount:   0, currency: 'MYR' }, normal: { amount:   0, currency: 'MYR' } }
  },
  internationalProfessional: {
    early:  { amount: 200, currency: 'USD' },
    normal: { amount: 250, currency: 'USD' }
  },
  industrialBooth: {
    early:  { amount: 1000, currency: 'MYR' },
    normal: { amount: 1500, currency: 'MYR' }
  }
},

      dinnerAddon: 0
    };

    const doc = await Pricing.findOneAndUpdate(
      { key: 'pricing-2026' },
      payload,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log('✔ Seeded pricing (official table):', {
      key: doc.key,
      earlyBirdDeadline: doc.earlyBirdDeadline.toISOString().slice(0, 10),
      dinnerAddon: doc.dinnerAddon
    });

    process.exit(0);
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
})();
