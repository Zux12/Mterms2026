// scripts/seedPricing.js
require('dotenv').config();
const mongoose = require('mongoose');
const Pricing = require('../server/models/Pricing');

(async () => {
  try {
    await mongoose.connect(process.env.MTERM2026_DB_URI);

    const EVENT_START_DATE = process.env.EVENT_START_DATE || '2026-08-01';

    const payload = {
      key: 'pricing-2026',
      currency: 'MYR',
      eventStartDate: new Date(EVENT_START_DATE),
      base: { student: 250, academia: 350, industry: 500 },
      adjustments: {
        early: { student: -50, academia: -50, industry: -50 },
        late:  { student:  50, academia:  50, industry: 100 }
      },
      dinnerAddon: 150
    };

    const doc = await Pricing.findOneAndUpdate(
      { key: 'pricing-2026' },
      payload,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log('✔ Seeded pricing:', {
      eventStartDate: doc.eventStartDate.toISOString().slice(0,10),
      base: doc.base,
      dinnerAddon: doc.dinnerAddon
    });
    process.exit(0);
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
})();
