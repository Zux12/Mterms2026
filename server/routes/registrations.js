// server/routes/registrations.js
const express = require('express');
const router = express.Router();
const Pricing = require('../models/Pricing');
const Registration = require('../models/Registration');
const Counter = require('../models/Counter');

function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate()+days); return d; }
function pad(n, size=6) { return String(n).padStart(size, '0'); }

async function nextRegCode() {
  const c = await Counter.findOneAndUpdate(
    { key: 'reg2026' },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return `MTERM2026-${pad(c.seq)}`;
}

function phaseFor(date, start) {
  const earlyEnd   = addDays(start, -90);
  const regularBeg = addDays(start, -89);
  const regularEnd = addDays(start, -14);
  const lateBeg    = addDays(start, -13);
  const lateEnd    = addDays(start, 0);

  if (date <= earlyEnd) return 'Early-bird';
  if (date >= regularBeg && date <= regularEnd) return 'Regular';
  if (date >= lateBeg && date <= lateEnd) return 'Late/On-site';
  return 'Closed';
}

router.post('/', async (req, res) => {
  // Minimal required fields for now
  const { category, firstName, lastName, email, affiliation, phone, dinner } = req.body || {};
  if (!category || !firstName || !lastName || !email || !affiliation) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const pricing = await Pricing.findOne({ key: 'pricing-2026' }).lean();
  if (!pricing) return res.status(500).json({ error: 'Pricing not configured' });

  const start = new Date(pricing.eventStartDate);
  const now = new Date();
  const phase = phaseFor(now, start);

  // Authoritative price calculation (server-side)
  const baseMap = {
    student:  pricing.base.student,
    academia: pricing.base.academia,
    industry: pricing.base.industry
  };
  let base = baseMap[category];

  if (phase === 'Early-bird') base += pricing.adjustments.early[category];
  else if (phase === 'Late/On-site') base += pricing.adjustments.late[category];

  const addons = dinner ? (pricing.dinnerAddon || 0) : 0;
  const total = base + addons;

  const regCode = await nextRegCode();

  const doc = await Registration.create({
    regCode,
    category,
    personal: { firstName, lastName, email, phone },
    professional: { affiliation },
    addons: { dinner: !!dinner },
    pricingSnapshot: {
      currency: pricing.currency || 'MYR',
      phase, base, addons, total
    },
    payment: { method: 'manual', status: 'pending' }
  });

  res.json({
    ok: true,
    regCode: doc.regCode,
    amount: doc.pricingSnapshot.total,
    currency: doc.pricingSnapshot.currency,
    phase: doc.pricingSnapshot.phase,
    message: 'Registration saved (payment pending).'
  });
});

// Simple lookup endpoint (temporary)
router.get('/lookup', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'email required' });
  const rows = await Registration.find({ 'personal.email': email })
    .sort({ createdAt: -1 })
    .select('regCode category pricingSnapshot createdAt')
    .lean();
  res.json({ count: rows.length, rows });
});

module.exports = router;
