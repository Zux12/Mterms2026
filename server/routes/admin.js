// server/routes/admin.js
const express = require('express');
const router = express.Router();
// ✅ Allow CORS preflight to pass through admin routes
router.options('*', (req, res) => res.sendStatus(204));
const Registration = require('../models/Registration');
const nodemailer = require('nodemailer');

// super-basic Basic-Auth (dev only). Change later to real auth/JWT.
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin';
function adminAuth(req, res, next){
  // ✅ Allow preflight OPTIONS requests through without Basic Auth
  if (req.method === 'OPTIONS') return next();

  const h = req.headers.authorization || '';
  if (!h.startsWith('Basic ')) return res.status(401).json({ error: 'Auth required' });
  const [user, pass] = Buffer.from(h.slice(6), 'base64').toString('utf8').split(':');
  if (user === ADMIN_USER && pass === ADMIN_PASS) return next();
  return res.status(401).json({ error: 'Invalid credentials' });
}

// GET /api/admin/registrations?q=&page=&limit=
router.get('/registrations', adminAuth, async (req,res)=>{
  const { q = '', page = 1, limit = 20 } = req.query;
  const p = Math.max(1, parseInt(page,10));
  const l = Math.min(100, Math.max(1, parseInt(limit,10)));

  const query = q ? {
    $or: [
      { regCode: new RegExp(q, 'i') },
      { 'personal.email': new RegExp(q, 'i') },
      { 'personal.firstName': new RegExp(q, 'i') },
      { 'personal.lastName': new RegExp(q, 'i') },
      { 'professional.affiliation': new RegExp(q, 'i') },
    ]
  } : {};

  const [rows, total] = await Promise.all([
    Registration.find(query).sort({ createdAt: -1 }).skip((p-1)*l).limit(l),
    Registration.countDocuments(query)
  ]);

  res.json({ rows, total, page: p, limit: l });
});

// GET /api/admin/registrations/:id
router.get('/registrations/:id', adminAuth, async (req,res)=>{
  const doc = await Registration.findById(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  res.json({ doc });
});

// PUT /api/admin/registrations/:id
router.put('/registrations/:id', adminAuth, async (req,res)=>{
  const { updates = {} } = req.body || {};
  // sanitize: avoid overwriting regCode by mistake
  delete updates._id; delete updates.regCode; delete updates.createdAt; delete updates.updatedAt;

  const doc = await Registration.findByIdAndUpdate(
    req.params.id,
    { $set: updates },
    { new: true }
  );
  if (!doc) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true, doc });
});


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
    secure: port === 465,
    auth: { user, pass }
  });
}

// POST /api/admin/acceptance-letter/send
router.post('/acceptance-letter/send', adminAuth, async (req, res) => {
  try {
    const { registrationId, filename, pdfBase64 } = req.body || {};

    if (!registrationId) return res.status(400).json({ error: 'registrationId is required' });
    if (!filename) return res.status(400).json({ error: 'filename is required' });
    if (!pdfBase64) return res.status(400).json({ error: 'pdfBase64 is required' });

    const doc = await Registration.findById(registrationId);
    if (!doc) return res.status(404).json({ error: 'Registration not found' });

    // Strict eligibility rule
    const presenting = !!doc?.program?.presenting;
    const ptype = doc?.program?.type || 'none';
    if (!presenting) return res.status(400).json({ error: 'Participant Only (not a presenter)' });
    if (ptype !== 'talk' && ptype !== 'poster') {
      return res.status(400).json({ error: 'Set Oral/Poster in Admin first' });
    }

    const to = doc?.personal?.email;
    const firstName = doc?.personal?.firstName || '';
    const lastName = doc?.personal?.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();

    if (!to) return res.status(400).json({ error: 'Missing participant email' });

    const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
    const subject = `MTERMS 2026 Acceptance Letter – ${fullName || 'Participant'}`;

    const kind = (ptype === 'talk') ? 'Oral' : 'Poster';

    const text =
`Dear ${fullName},

Please find attached your official Letter of Acceptance for your ${kind} presentation at
Malaysian Tissue Engineering and Regenerative Medicine Society Conference 2026 (MTERMS 2026),
held on August 6–7, 2026.

For inquiries, please contact admin@mterms2026.com.

Sincerely,
MTERMS 2026 Secretariat`;

    const html =
`<p>Dear ${escapeHtml(fullName)},</p>
<p>Please find attached your official <b>Letter of Acceptance</b> for your <b>${kind}</b> presentation at
<b>Malaysian Tissue Engineering and Regenerative Medicine Society Conference 2026 (MTERMS 2026)</b>,
held on <b>August 6–7, 2026</b>.</p>
<p>For inquiries, please contact <b>admin@mterms2026.com</b>.</p>
<p>Sincerely,<br><b>MTERMS 2026 Secretariat</b></p>`;

    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    const t = makeTransport();
    await t.sendMail({
      from: `"MTERMS 2026 Secretariat" <${fromEmail}>`,
      to,
      subject,
      text,
      html,
      attachments: [
        {
          filename,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    });

    res.json({ ok: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to send email' });
  }
});

function escapeHtml(str){
  return String(str || '').replace(/[&<>"']/g, (m) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[m]));
}
module.exports = router;
