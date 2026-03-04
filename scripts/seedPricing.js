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

      // 🔵 KEEP EXISTING STRUCTURE (so no HTML breaks)
      base: { student: 250, academia: 350, industry: 500 },
      adjustments: {
        early: { student: -50, academia: -50, industry: -50 },
        late:  { student:  50, academia:  50, industry: 100 }
      },
      dinnerAddon: 0, // you removed gala dinner earlier

      // 🟢 NEW: Detailed official fee table (from your image)
      officialTable: [
        {
          category: 'Local Student',
          earlyBird: 'RM 450',
          normal: 'RM 550'
        },
        {
          category: 'International Student',
          earlyBird: 'USD 140',
          normal: 'USD 180'
        },
        {
          category: 'Local Professional',
          earlyBird: 'RM 750',
          normal: 'RM 850',
          notes: [
            'Follow student rate: RM 450 (TESMA/MTERM Comm)',
            'Member: RM 650',
            'Symposia Speaker: RM 650',
            'Keynote: Free / Preliminary: Free'
          ]
        },
        {
          category: 'International Professional',
          earlyBird: 'USD 200',
          normal: 'USD 250'
        },
        {
          category: 'Industrial Booth',
          earlyBird: 'RM 1,000',
          normal: 'RM 1,500'
        }
      ]
    };

    const doc = await Pricing.findOneAndUpdate(
      { key: 'pricing-2026' },
      payload,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log('✔ Seeded pricing safely:', {
      eventStartDate: doc.eventStartDate.toISOString().slice(0,10),
      base: doc.base,
      officialTableRows: doc.officialTable?.length || 0
    });

    process.exit(0);
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
})();
