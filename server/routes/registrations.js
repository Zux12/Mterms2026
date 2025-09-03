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

  const doc = await Registration.create({
    regCode,
    category,
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

  res.json({
    ok: true,
    regCode: doc.regCode,
    amount: doc.pricingSnapshot.total,
    currency: doc.pricingSnapshot.currency,
    phase: doc.pricingSnapshot.phase,
    studentProof: doc.studentProof, // shows required/deferred flags
    message: 'Registration saved (payment pending).'
  });
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

module.exports = router;
