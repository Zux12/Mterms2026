// server/routes/registrations.js
const express = require('express');
const router = express.Router();
const Pricing = require('../models/Pricing');
const Registration = require('../models/Registration');
const Counter = require('../models/Counter');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

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

function phaseFor(date, earlyBirdDeadline) {
  return date <= earlyBirdDeadline ? 'Early Bird' : 'Normal';
}

function siteBaseUrl() {
  return (process.env.SITE_BASE_URL || 'https://www.mterms2026.com').replace(/\/+$/, '');
}

function makeTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) {
    throw new Error('SMTP env vars missing (SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS)');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465 = SSL, 587 = STARTTLS
    auth: { user, pass }
  });
}

async function sendRegistrationEmail({ to, firstName, lastName, regCode }) {
  const base = siteBaseUrl();
  const loginUrl = `${base}/login.html`;
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  const subject = `MTERMS 2026 Registration Confirmed — Your Code: ${regCode}`;

  const text =
`Hi ${firstName} ${lastName},

Thank you for registering for MTERMS 2026.

Your Registration Code: ${regCode}

Useful links:
• Website: ${base}
• Participant Login: ${loginUrl}

You can view your registration details in the participant portal after logging in (use your email and the password you created during registration).

If you need help, reply to this email.

Regards,
MTERMS 2026 Secretariat
${from}`;

  const html =
`<p>Hi ${firstName} ${lastName},</p>
<p>Thank you for registering for <b>MTERMS 2026</b>.</p>
<p style="font-size:16px;margin:14px 0;">
  <b>Your Registration Code:</b><br>
  <span style="font-size:20px">${regCode}</span>
</p>
<p><b>Useful links:</b><br>
• <a href="${base}">${base}</a><br>
• <a href="${loginUrl}">Participant Login</a>
</p>
<p>You can view your registration details in the participant portal after logging in (use your email and the password you created during registration).</p>
<p>If you need help, reply to this email.</p>
<p>Regards,<br>MTERMS 2026 Secretariat<br>${from}</p>`;

  const t = makeTransport();
  await t.sendMail({ from: `"MTERMS 2026" <${from}>`, to, subject, text, html });
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

const roleType = body.roleType;
const nationality = body.nationality;
const professionalSubtype = body.professionalSubtype;

if (!roleType || !['Student','Professional','Industrial Booth'].includes(roleType)) {
  return res.status(400).json({ error: 'Valid roleType required' });
}
if (!nationality || !['Malaysian','Non-Malaysian'].includes(nationality)) {
  return res.status(400).json({ error: 'Valid nationality required' });
}


let finalCategory = '';
if (roleType === 'Student' && nationality === 'Malaysian') finalCategory = 'Local Student';
if (roleType === 'Student' && nationality === 'Non-Malaysian') finalCategory = 'International Student';
if (roleType === 'Professional' && nationality === 'Malaysian') finalCategory = 'Local Professional';
if (roleType === 'Professional' && nationality === 'Non-Malaysian') finalCategory = 'International Professional';
if (roleType === 'Industrial Booth') finalCategory = 'Industrial Booth';

if (!finalCategory) {
  return res.status(400).json({ error: 'Unable to map category from roleType/nationality' });
}

// subtype required only for Local Professional
let profType = 'Standard';
if (finalCategory === 'Local Professional') {
  profType = professionalSubtype || 'Standard';
  const allowed = ['Standard','Committee','Member','Symposia Speaker','Keynote','Plenary'];
  if (!allowed.includes(profType)) {
    return res.status(400).json({ error: 'Valid professionalSubtype required for Local Professional' });
  }
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
if (finalCategory === 'Local Student' || finalCategory === 'International Student') {
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

// ---- 3) Price calc snapshot (official table)
const pricing = await Pricing.findOne({ key: 'pricing-2026' }).lean();
if (!pricing) return res.status(500).json({ error: 'Pricing not configured' });

const now = new Date();
const phase = phaseFor(now, new Date(pricing.earlyBirdDeadline));
const phaseKey = (phase === 'Early Bird') ? 'early' : 'normal';

let fee;
if (finalCategory === 'Local Student') {
  fee = pricing.fees.localStudent[phaseKey];
} else if (finalCategory === 'International Student') {
  fee = pricing.fees.internationalStudent[phaseKey];
} else if (finalCategory === 'International Professional') {
  fee = pricing.fees.internationalProfessional[phaseKey];
} else if (finalCategory === 'Industrial Booth') {
  fee = pricing.fees.industrialBooth[phaseKey];
} else if (finalCategory === 'Local Professional') {
  const map = {
    'Standard': 'standard',
    'Committee': 'committee',
    'Member': 'member',
    'Symposia Speaker': 'symposia',
    'Keynote': 'keynote',
    'Plenary': 'plenary'
  };
  const key = map[profType];
  fee = pricing.fees.localProfessional[key][phaseKey];
} else {
  return res.status(400).json({ error: 'Unknown category for pricing' });
}

// no dinner
const addonsTotal = 0;
const total = Number(fee.amount) + addonsTotal;

  // ---- 4) Persist
  const regCode = await nextRegCode();

  let doc;
try {
  doc = await Registration.create({
    regCode,
category: finalCategory,
nationality,
roleType,
professionalSubtype: (finalCategory === 'Local Professional') ? profType : 'Standard',

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


    submission: {
      theme: '',
      field: '',
      title: '',
      authors: [],
      updatedAt: null
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
  currency: fee.currency,
  phase,
  base: Number(fee.amount),
  addons: addonsTotal,
  total
},
    payment: { method: 'manual', status: 'pending' }
  });

// Fire registration confirmation email (do NOT block registration if email fails)
try {
  await sendRegistrationEmail({
    to: doc.personal.email,
    firstName: doc.personal.firstName,
    lastName: doc.personal.lastName,
    regCode: doc.regCode
  });
} catch (mailErr) {
  console.error('Registration email failed:', mailErr.message || mailErr);
}

  
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

  }); // ✅ closes router.post('/', async (req, res) => { ... })
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
  // ✅ Option B fields (participant may update)
  roleType: updates.roleType,
  nationality: updates.nationality,
  professionalSubtype: updates.professionalSubtype,

  // ❌ Do NOT allow direct category editing by participants anymore
  // category: updates.category,

  // Dinner is removed; keep addons only if you still want to store it (otherwise comment out)
  addons: allow(updates.addons, ['dinner']),

  personal: allow(updates.personal, ['firstName','lastName','email','phone','country']),
  professional: allow(updates.professional, ['affiliation','department','roleTitle']),
  address: allow(updates.address, ['line1','line2','city','state','postcode','country']),
  billing: allow(updates.billing, ['billTo','taxNo','poNumber']),
  program: allow(updates.program, ['presenting','type','title','topicArea']),

  submission: {
    theme: updates.submission?.theme,
    field: updates.submission?.field,
    title: updates.submission?.title,
    authors: Array.isArray(updates.submission?.authors)
      ? updates.submission.authors.slice(0, 10).map(a => ({
          firstName: a?.firstName,
          lastName: a?.lastName,
          email: a?.email,
          affiliation: a?.affiliation,
          country: a?.country,
          isCorresponding: !!a?.isCorresponding
        }))
      : [],
    updatedAt: new Date()
  },

  student: allow(updates.student, ['university','level','expectedGradYear']),
  consents: allow(updates.consents, ['pdpa','codeOfConduct','marketingOptIn'])
};


// ---- Validate Option B fields on participant update (prevents inconsistent states)
const roleOk = ['Student','Professional','Industrial Booth'].includes(safe.roleType);
const natOk  = ['Malaysian','Non-Malaysian'].includes(safe.nationality);
const subOk  = ['Standard','Committee','Member','Symposia Speaker','Keynote','Plenary'].includes(safe.professionalSubtype || 'Standard');

if (safe.roleType && !roleOk) return res.status(400).json({ error: 'Invalid roleType' });
if (safe.nationality && !natOk) return res.status(400).json({ error: 'Invalid nationality' });

// subtype only meaningful for Malaysian + Professional
if (safe.roleType === 'Professional' && safe.nationality === 'Malaysian') {
  if (!subOk) return res.status(400).json({ error: 'Invalid professionalSubtype' });
} else {
  // force Standard when not Local Professional
  safe.professionalSubtype = 'Standard';
}


    // ---- Derive finalCategory and keep `category` consistent
let finalCategory = '';
if (safe.roleType === 'Student' && safe.nationality === 'Malaysian') finalCategory = 'Local Student';
if (safe.roleType === 'Student' && safe.nationality === 'Non-Malaysian') finalCategory = 'International Student';
if (safe.roleType === 'Professional' && safe.nationality === 'Malaysian') finalCategory = 'Local Professional';
if (safe.roleType === 'Professional' && safe.nationality === 'Non-Malaysian') finalCategory = 'International Professional';
if (safe.roleType === 'Industrial Booth') finalCategory = 'Industrial Booth';

if (finalCategory) safe.category = finalCategory;
    
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
