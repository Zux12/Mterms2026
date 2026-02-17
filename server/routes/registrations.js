// server/routes/registrations.js
const express = require('express');
const router = express.Router();
const Pricing = require('../models/Pricing');
const Registration = require('../models/Registration');
const Counter = require('../models/Counter');
const bcrypt = require('bcryptjs');

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

// Friendly GET message so /api/registrations isn't a 404
router.get('/', (req, res) => {
  res.type('text/plain').send('POST /api/registrations to create; GET /api/registrations/lookup?email=you@domain.com to search.');
});

router.post('/', async (req, res) => {
  const body = req.body || {};

  // ---- 1) Basic required fields
  const category = body.category;
  const personal = body.personal || {};
  const professional = body.professional || {};
  const consents = body.consents || {};
  const addons = body.addons || {};
  const billing = body.billing || {};
  const address = body.address || {};
  const program = body.program || {};
  const student = body.student || {};
  const studentProof = body.studentProof || {};

  if (!category || !['student','academia','industry'].includes(category)) {
    return res.status(400).json({ error: 'Valid category required' });
  }
  if (!personal.firstName || !personal.lastName || !personal.email) {
    return res.status(400).json({ error: 'firstName, lastName, email are required' });
  }

  // ---- 1b) Password required (new login flow)
const password = String(body.password || '');
if (password.length < 8) {
  return res.status(400).json({ error: 'Password must be at least 8 characters' });
}

// Normalize email to match schema (lowercase + trim)
personal.email = String(personal.email).trim().toLowerCase();

// Hash password (store hash only)
const passwordHash = await bcrypt.hash(password, 12);
  
  if (!professional.affiliation) {
    return res.status(400).json({ error: 'affiliation is required' });
  }
  if (!consents.pdpa || !consents.codeOfConduct) {
    return res.status(400).json({ error: 'You must accept PDPA & Code of Conduct' });
  }

  // ---- 2) Category-specific checks
  let studentBlock = {};
  let studentProofBlock = {};
  if (category === 'student') {
    if (!student.university) {
      return res.status(400).json({ error: 'university is required for student category' });
    }
    const deferred = !!studentProof.deferred; // chosen "upload later"
    studentBlock = {
      university: student.university,
      level: student.level || 'Other',
      expectedGradYear: student.expectedGradYear || undefined
    };
    studentProofBlock = {
      required: true,
      deferred,
      provided: false,
      status: 'unverified'
    };
  }

  // ---- 3) Price calc snapshot
  const pricing = await Pricing.findOne({ key: 'pricing-2026' }).lean();
  if (!pricing) return res.status(500).json({ error: 'Pricing not configured' });

  const start = new Date(pricing.eventStartDate);
  const now = new Date();
  const phase = phaseFor(now, start);

  const baseMap = {
    student:  pricing.base.student,
    academia: pricing.base.academia,
    industry: pricing.base.industry
  };
  let base = baseMap[category];

  if (phase === 'Early-bird') base += pricing.adjustments.early[category];
  else if (phase === 'Late/On-site') base += pricing.adjustments.late[category];

  const addonsTotal = addons.dinner ? (pricing.dinnerAddon || 0) : 0;
  const total = base + addonsTotal;

  // ---- 4) Persist
  const regCode = await nextRegCode();

  let doc;
try {
  doc = await Registration.create({
    regCode,
    category,

    auth: {
      passwordHash,
      passwordSetAt: new Date()
    },

    personal: {
      firstName: personal.firstName,
      lastName: personal.lastName,
      email: personal.email,
      phone: personal.phone,
      country: personal.country
    },
    professional: {
      affiliation: professional.affiliation,
      department: professional.department,
      roleTitle: professional.roleTitle
    },
    address: {
      line1: address.line1,
      line2: address.line2,
      city: address.city,
      state: address.state,
      postcode: address.postcode,
      country: address.country
    },
    billing: {
      billTo: billing.billTo,
      taxNo: billing.taxNo,
      poNumber: billing.poNumber
    },
    program: {
      presenting: !!program.presenting,
      type: program.type || (program.presenting ? 'talk' : 'none'),
      title: program.title,
      topicArea: program.topicArea
    },
    student: studentBlock,
    studentProof: studentProofBlock,
    addons: { dinner: !!addons.dinner },
    consents: {
      pdpa: !!consents.pdpa,
      codeOfConduct: !!consents.codeOfConduct,
      marketingOptIn: !!consents.marketingOptIn
    },
    pricingSnapshot: {
      currency: pricing.currency || 'MYR',
      phase, base, addons: addonsTotal, total
    },
    payment: { method: 'manual', status: 'pending' }
  });
} catch (err) {
  // Duplicate email (unique index)
  if (err && err.code === 11000) {
    return res.status(409).json({ error: 'This email is already registered. Please log in instead.' });
  }
  console.error('Registration create failed:', err);
  return res.status(500).json({ error: 'Server error: ' + (err.message || 'Unknown error') });
}

return res.json({
  ok: true,
  regCode: doc.regCode,
  amount: doc.pricingSnapshot.total,
  currency: doc.pricingSnapshot.currency,
  phase: doc.pricingSnapshot.phase,
  studentProof: doc.studentProof,
  message: 'Registration saved (payment pending).'
});

// Lookup by email (unchanged)
router.get('/lookup', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'email required' });
  const rows = await Registration.find({ 'personal.email': email })
    .sort({ createdAt: -1 })
    .select('regCode category pricingSnapshot createdAt')
    .lean();
  res.json({ count: rows.length, rows });
});

router.get('/check', async (req, res) => {
  try {
    const { regCode, email } = req.query;
    if (!regCode || !email) return res.status(400).json({ error: 'Missing regCode or email' });
    const doc = await Registration.findOne({
      regCode: regCode.trim(),
      'personal.email': email.trim()
    });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ===== Participant update (by regCode + email) =====
router.put('/update', async (req, res) => {
  try {
    const { regCode, email, updates } = req.body || {};
    if (!regCode || !email || !updates) {
      return res.status(400).json({ error: 'Missing regCode, email or updates' });
    }

    // Only allow fields we expect
    const allow = (obj, keys) =>
      Object.fromEntries(Object.entries(obj || {}).filter(([k]) => keys.includes(k)));

    const safe = {
      category: updates.category, // optional if you want to allow category change; remove if not
      addons: allow(updates.addons, ['dinner']),
      personal: allow(updates.personal, ['firstName','lastName','email','phone','country']),
      professional: allow(updates.professional, ['affiliation','department','roleTitle']),
      address: allow(updates.address, ['line1','line2','city','state','postcode','country']),
      billing: allow(updates.billing, ['billTo','taxNo','poNumber']),
      program: allow(updates.program, ['presenting','type','title','topicArea']),
      student: allow(updates.student, ['university','level','expectedGradYear']),
      consents: allow(updates.consents, ['pdpa','codeOfConduct','marketingOptIn'])
    };

    // remove empty sub-objects to keep $set clean
    Object.keys(safe).forEach(k => {
      if (safe[k] && typeof safe[k] === 'object' && !Object.keys(safe[k]).length) delete safe[k];
      if (typeof safe[k] === 'undefined') delete safe[k];
    });

    const doc = await Registration.findOneAndUpdate(
      { regCode: regCode.trim(), 'personal.email': email.trim() },
      { $set: safe },
      { new: true }
    );

    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true, regCode: doc.regCode, updatedAt: doc.updatedAt, doc });
  } catch (err) {
    console.error('Update failed:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

module.exports = router;
