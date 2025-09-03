// server/routes/pricing.js
const express = require('express');
const router = express.Router();
const Pricing = require('../models/Pricing');

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

router.get('/table', async (req, res) => {
  const doc = await Pricing.findOne({ key: 'pricing-2026' }).lean();
  if (!doc) return res.status(404).json({ error: 'Pricing not seeded yet' });

  const start = new Date(doc.eventStartDate);
  const earlyEnd   = addDays(start, -90);
  const regularBeg = addDays(start, -89);
  const regularEnd = addDays(start, -14);
  const lateBeg    = addDays(start, -13);
  const lateEnd    = addDays(start, 0);

  const base = doc.base;
  const adj  = doc.adjustments;

  const rows = [
    {
      phase: 'Early-bird',
      window: { start: null, end: earlyEnd },
      prices: {
        student: base.student + adj.early.student,
        academia: base.academia + adj.early.academia,
        industry: base.industry + adj.early.industry
      }
    },
    {
      phase: 'Regular',
      window: { start: regularBeg, end: regularEnd },
      prices: { ...base }
    },
    {
      phase: 'Late/On-site',
      window: { start: lateBeg, end: lateEnd },
      prices: {
        student: base.student + adj.late.student,
        academia: base.academia + adj.late.academia,
        industry: base.industry + adj.late.industry
      }
    }
  ];

  const today = new Date();
  let nowPhase = 'Pre-registration';
  if (today <= earlyEnd) nowPhase = 'Early-bird';
  else if (today >= regularBeg && today <= regularEnd) nowPhase = 'Regular';
  else if (today >= lateBeg && today <= lateEnd) nowPhase = 'Late/On-site';
  else if (today > lateEnd) nowPhase = 'Closed';

  res.json({
    currency: doc.currency,
    dinnerAddon: doc.dinnerAddon,
    eventStartDate: doc.eventStartDate,
    nowPhase,
    rows
  });
});

module.exports = router;
