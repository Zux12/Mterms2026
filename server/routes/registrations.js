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

async function sendReviewerCommentEmail({
  to,
  cc,
  participantName,
  regCode,
  reviewerComment
}) {
  const base = siteBaseUrl();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  const safeName = String(participantName || '').trim();
  const safeCode = String(regCode || '').trim();
  const safeComment = String(reviewerComment || '').trim();

  const subject = `MTERMS 2026 Reviewer Comment – ${safeName} – ${safeCode}`;

  const text =
`Dear ${safeName},

A reviewer comment has been added to your submission for MTERMS 2026.

Registration Code: ${safeCode}

Reviewer Comment:
-----------------------------------
${safeComment}
-----------------------------------

Please visit the MTERMS 2026 website at ${base} and log in to your participant account for further action.

Important reminder:
Only after you receive the official invitation or notification from the Secretariat confirming your presentation outcome:
• If you are assigned for Oral Presentation, please upload your slides in PDF format only.
• If you are assigned for Poster Presentation, please upload your poster image only.

The invitation letter will be issued by the Secretariat upon confirmation of the presentation outcome, or may already have been issued in earlier communication.

Regards,
MTERMS 2026 Secretariat
${from}`;

  const html =
`<p>Dear ${safeName},</p>

<p>A reviewer comment has been added to your submission for <b>MTERMS 2026</b>.</p>

<p><b>Registration Code:</b> ${safeCode}</p>

<p><b>Reviewer Comment:</b></p>
<div style="border:1px solid #d0d5dd;border-radius:8px;padding:12px;background:#f9fafb;white-space:pre-wrap;">${safeComment
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')}</div>

<p style="margin-top:16px">
Please visit the <b>MTERMS 2026 website</b> at
<a href="${base}">${base}</a>
and log in to your participant account for further action.
</p>

<p><b>Important reminder:</b><br>
Only after you receive the official invitation or notification from the Secretariat confirming your presentation outcome:</p>

<ul>
  <li>If you are assigned for <b>Oral Presentation</b>, please upload your <b>slides in PDF format only</b>.</li>
  <li>If you are assigned for <b>Poster Presentation</b>, please upload your <b>poster image only</b>.</li>
</ul>

<p>
The invitation letter will be issued by the Secretariat upon confirmation of the presentation outcome,
or may already have been issued in earlier communication.
</p>

<p>Regards,<br>
MTERMS 2026 Secretariat<br>
${from}</p>`;

  const t = makeTransport();
  await t.sendMail({
    from: `"MTERMS 2026" <${from}>`,
    to,
    cc,
    subject,
    text,
    html
  });

  return { subject };
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
let tesmaMember = !!body.tesmaMember;

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

  // backward compatibility: old frontend may still send Member as subtype
  if (profType === 'Member') {
    profType = 'Standard';
    tesmaMember = true;
  }

  // TESMA member option only applies to Local Professional Standard/Symposia
  if (!['Standard', 'Symposia Speaker'].includes(profType)) {
    tesmaMember = false;
  }
}

// TESMA member option also applies to Local Student only
if (finalCategory !== 'Local Student' && finalCategory !== 'Local Professional') {
  tesmaMember = false;
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
  fee = tesmaMember
    ? pricing.fees.localStudent.member
    : pricing.fees.localStudent[phaseKey];

} else if (finalCategory === 'International Student') {
  fee = pricing.fees.internationalStudent[phaseKey];

} else if (finalCategory === 'International Professional') {
  fee = pricing.fees.internationalProfessional[phaseKey];

} else if (finalCategory === 'Industrial Booth') {
  fee = pricing.fees.industrialBooth[phaseKey];

} else if (finalCategory === 'Local Professional') {
  if (profType === 'Standard') {
    fee = tesmaMember
      ? pricing.fees.localProfessional.member.normal
      : pricing.fees.localProfessional.standard[phaseKey];

  } else if (profType === 'Committee') {
    fee = pricing.fees.localProfessional.committee.normal;

  } else if (profType === 'Symposia Speaker') {
    fee = tesmaMember
      ? pricing.fees.localProfessional.symposia.early
      : pricing.fees.localProfessional.symposia.normal;

  } else if (profType === 'Keynote') {
    fee = pricing.fees.localProfessional.keynote[phaseKey];

  } else if (profType === 'Plenary') {
    fee = pricing.fees.localProfessional.plenary[phaseKey];

  } else {
    return res.status(400).json({ error: 'Unknown professional subtype for pricing' });
  }

} else {
  return res.status(400).json({ error: 'Unknown category for pricing' });
}

// no dinner
// no dinner
if (!fee || typeof fee.amount === 'undefined') {
  return res.status(500).json({ error: 'Pricing configuration is incomplete. Please re-seed pricing.' });
}

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
tesmaMember,

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
payment: {
  method: 'manual',
  status: 'pending',
  amount: total
}
  
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
tesmaMember: !!updates.tesmaMember,

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

  if (safe.professionalSubtype === 'Member') {
    safe.professionalSubtype = 'Standard';
    safe.tesmaMember = true;
  }

  if (!['Standard', 'Symposia Speaker'].includes(safe.professionalSubtype || 'Standard')) {
    safe.tesmaMember = false;
  }
} else {
  // force Standard when not Local Professional
  safe.professionalSubtype = 'Standard';
}

if (!(safe.roleType === 'Student' && safe.nationality === 'Malaysian') &&
    !(safe.roleType === 'Professional' && safe.nationality === 'Malaysian')) {
  safe.tesmaMember = false;
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


router.post('/admin/send-review-comment', async (req, res) => {
  try {
    const { regCode, email, reviewerComment } = req.body || {};

    if (!regCode || !email) {
      return res.status(400).json({ error: 'Missing regCode or email' });
    }

    const safeComment = String(reviewerComment || '').trim();
    if (!safeComment) {
      return res.status(400).json({ error: 'Reviewer comment is required' });
    }

    const doc = await Registration.findOne({
      regCode: String(regCode).trim(),
      'personal.email': String(email).trim().toLowerCase()
    });

    if (!doc) {
      return res.status(404).json({ error: 'Participant not found' });
    }

    const participantName =
      `${doc.personal?.firstName || ''} ${doc.personal?.lastName || ''}`.trim();

    // 1) Save reviewer comment first
    doc.program = doc.program || {};
    doc.program.title = safeComment;
    await doc.save();

    // 2) Send email
    const sendResult = await sendReviewerCommentEmail({
      to: doc.personal.email,
      cc: 'admin@mterms2026.com',
      participantName,
      regCode: doc.regCode,
      reviewerComment: safeComment
    });

    // 3) Append history only after successful email send
    doc.reviewEmailHistory = Array.isArray(doc.reviewEmailHistory)
      ? doc.reviewEmailHistory
      : [];

    doc.reviewEmailHistory.push({
      sentAt: new Date(),
      sentBy: 'admin',
      subject: sendResult.subject,
      commentSnapshot: safeComment
    });

    await doc.save();

    const sentCount = doc.reviewEmailHistory.length;
    const lastSent = doc.reviewEmailHistory[sentCount - 1]?.sentAt || null;

    return res.json({
      ok: true,
      message: 'Comment saved and email sent successfully',
      sentCount,
      lastSent,
      subject: sendResult.subject
    });
  } catch (err) {
    console.error('send-review-comment failed:', err);
    return res.status(500).json({
      error: 'Comment may have been saved, but email sending failed: ' + err.message
    });
  }
});

module.exports = router;
