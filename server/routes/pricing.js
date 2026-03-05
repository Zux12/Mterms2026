// server/routes/pricing.js
const express = require('express');
const router = express.Router();
const Pricing = require('../models/Pricing');

function phaseFor(now, earlyBirdDeadline) {
  return now <= earlyBirdDeadline ? 'Early Bird' : 'Normal';
}

router.get('/table', async (req, res) => {
  try {
    const doc = await Pricing.findOne({ key: 'pricing-2026' }).lean();
    if (!doc) {
      return res.status(404).json({ error: 'Pricing not seeded yet' });
    }

    if (!doc.earlyBirdDeadline || !doc.fees) {
      return res.status(500).json({ error: 'Pricing document is in old/invalid format. Please re-seed pricing.' });
    }

    if (
      !doc.fees.localStudent ||
      !doc.fees.internationalStudent ||
      !doc.fees.localProfessional ||
      !doc.fees.internationalProfessional ||
      !doc.fees.industrialBooth
    ) {
      return res.status(500).json({ error: 'Pricing document is incomplete. Please re-seed pricing.' });
    }

    const now = new Date();
    const nowPhase = phaseFor(now, new Date(doc.earlyBirdDeadline));

    const rows = [
      {
        category: 'Local Student',
        earlyBird: doc.fees.localStudent.early,
        normal: doc.fees.localStudent.normal
      },
      {
        category: 'International Student',
        earlyBird: doc.fees.internationalStudent.early,
        normal: doc.fees.internationalStudent.normal
      },
      {
        category: 'Local Professional',
        earlyBird: doc.fees.localProfessional.standard.early,
        normal: doc.fees.localProfessional.standard.normal,
        notes: {
          committeeEarly: doc.fees.localProfessional.committee.early,
          memberEarly: doc.fees.localProfessional.member.early,
          symposiaEarly: doc.fees.localProfessional.symposia.early,
          keynote: doc.fees.localProfessional.keynote.early,
          plenary: doc.fees.localProfessional.plenary.early
        }
      },
      {
        category: 'International Professional',
        earlyBird: doc.fees.internationalProfessional.early,
        normal: doc.fees.internationalProfessional.normal
      },
      {
        category: 'Industrial Booth',
        earlyBird: doc.fees.industrialBooth.early,
        normal: doc.fees.industrialBooth.normal
      }
    ];

    return res.json({
      ok: true,
      earlyBirdDeadline: doc.earlyBirdDeadline,
      nowPhase,
      rows
    });
  } catch (err) {
    console.error('GET /api/pricing/table failed:', err);
    return res.status(500).json({ error: err.message || 'Failed to load pricing table' });
  }
});

module.exports = router;
