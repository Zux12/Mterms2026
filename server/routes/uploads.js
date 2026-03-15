// server/routes/uploads.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const nodemailer = require('nodemailer');
const Registration = require('../models/Registration');
const { getBucket, ObjectId } = require('../lib/gridfs');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB
});

const ALLOWED_TYPES = ['studentProof','bankReceipt','abstract','slides','poster','profilePhoto'];
const ALLOWED_MIME = {
  abstract: [
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ],
  bankReceipt: ['application/pdf', 'image/png', 'image/jpeg'],
  studentProof: ['application/pdf', 'image/png', 'image/jpeg'],
  slides: ['application/pdf'], // PDF only
  poster: ['application/pdf', 'image/png', 'image/jpeg'],
  profilePhoto: ['image/png', 'image/jpeg']
};

const MAX_BYTES_BY_TYPE = {
  // slides: 10 MB (already enforced by multer global limit)
  poster: 2 * 1024 * 1024 // 2 MB
};
function safeName(name='file') {
  return String(name).replace(/[^\w\-.]+/g, '_').slice(0, 120);
}


function siteBaseUrl() {
  return (process.env.SITE_BASE_URL || 'https://mterms2026.com').replace(/\/+$/, '');
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
    secure: port === 465,
    auth: { user, pass }
  });
}

async function sendAbstractAdminEmail({ reg, version }) {
  const base = siteBaseUrl();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const to = 'admin@mterms2026.com';

  const firstName = String(reg.personal?.firstName || '').trim();
  const lastName = String(reg.personal?.lastName || '').trim();
  const participantName = `${firstName} ${lastName}`.trim() || 'Participant';
  const regCode = String(reg.regCode || '').trim();
  const participantEmail = String(reg.personal?.email || '').trim();
const institution = String(
  reg.professional?.affiliation ||
  reg.student?.university ||
  ''
).trim();

const title = String(
  reg.submission?.title ||
  ''
).trim() || '(No abstract title provided)';
  const preference =
    String(reg.program?.preference || reg.program?.type || reg.program?.presentationType || '').trim() || 'Not specified';

  const isNew = Number(version) === 1;
  const subject = isNew
    ? `📥 New Abstract Submission – MTERMS 2026 – ${participantName} – ${regCode}`
    : `🔁 Abstract Updated – MTERMS 2026 – ${participantName} – ${regCode}`;

  const submittedAt = new Date().toLocaleString('en-MY', {
    timeZone: 'Asia/Kuala_Lumpur',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  const text =
`${isNew ? 'New Abstract Submission Received' : 'Abstract Update Received'}

A participant has submitted an abstract through the MTERMS 2026 submission system.

Participant Details
Name: ${participantName}
Registration Code: ${regCode}
Email: ${participantEmail}
Institution: ${institution || 'Not provided'}

Submission Details
Presentation Preference: ${preference}
Abstract Title: ${title}
Submission Version: ${version}
Submission Time: ${submittedAt}

You may review this submission in the MTERMS 2026 Admin Portal:
${base}/admin.html

MTERMS 2026 Secretariat
${from}`;

  const esc = (s='') => String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const html =
`<p><strong>${isNew ? 'New Abstract Submission Received' : 'Abstract Update Received'}</strong></p>

<p>A participant has submitted an abstract through the <strong>MTERMS 2026 submission system</strong>.</p>

<p><strong>Participant Details</strong><br>
Name: ${esc(participantName)}<br>
Registration Code: ${esc(regCode)}<br>
Email: ${esc(participantEmail)}<br>
Institution: ${esc(institution || 'Not provided')}</p>

<p><strong>Submission Details</strong><br>
Presentation Preference: ${esc(preference)}<br>
Abstract Title: ${esc(title)}<br>
Submission Version: ${esc(version)}<br>
Submission Time: ${esc(submittedAt)}</p>

<p>You may review this submission in the <strong>MTERMS 2026 Admin Portal</strong>:<br>
<a href="${base}/admin.html">${base}/admin.html</a></p>

<p>MTERMS 2026 Secretariat<br>
${esc(from)}</p>`;

  const t = makeTransport();
  await t.sendMail({
    from: `"MTERMS 2026" <${from}>`,
    to,
    subject,
    text,
    html
  });
}


async function sendBankReceiptAdminEmail({ reg, version }) {
  const base = siteBaseUrl();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const to = 'admin@mterms2026.com';

  const firstName = String(reg.personal?.firstName || '').trim();
  const lastName = String(reg.personal?.lastName || '').trim();
  const participantName = `${firstName} ${lastName}`.trim() || 'Participant';
  const regCode = String(reg.regCode || '').trim();
  const participantEmail = String(reg.personal?.email || '').trim();

  const affiliation = String(
    reg.professional?.affiliation ||
    reg.student?.university ||
    ''
  ).trim();

  const category = String(reg.category || '').trim() || 'Not specified';

  const amount = (
    reg.payment?.amount ??
    reg.pricingSnapshot?.total ??
    ''
  );

  const isNew = Number(version) === 1;
  const subject = isNew
    ? `💳 New Bank Receipt Upload – MTERMS 2026 – ${participantName} – ${regCode}`
    : `🔁 Bank Receipt Updated – MTERMS 2026 – ${participantName} – ${regCode}`;

  const submittedAt = new Date().toLocaleString('en-MY', {
    timeZone: 'Asia/Kuala_Lumpur',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  const text =
`${isNew ? 'New Bank Receipt Upload Received' : 'Bank Receipt Update Received'}

A participant has uploaded a bank receipt through the MTERMS 2026 payment submission system.

Participant Details
Name: ${participantName}
Registration Code: ${regCode}
Email: ${participantEmail}
Affiliation: ${affiliation || 'Not provided'}
Category: ${category}

Payment Details
Amount: ${amount !== '' ? amount : 'Not provided'}
Submission Version: ${version}
Submission Time: ${submittedAt}

You may review this submission in the MTERMS 2026 Admin Portal:
${base}/admin.html

MTERMS 2026 Secretariat
${from}`;

  const esc = (s='') => String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const html =
`<p><strong>${isNew ? 'New Bank Receipt Upload Received' : 'Bank Receipt Update Received'}</strong></p>

<p>A participant has uploaded a bank receipt through the <strong>MTERMS 2026 payment submission system</strong>.</p>

<p><strong>Participant Details</strong><br>
Name: ${esc(participantName)}<br>
Registration Code: ${esc(regCode)}<br>
Email: ${esc(participantEmail)}<br>
Affiliation: ${esc(affiliation || 'Not provided')}<br>
Category: ${esc(category)}</p>

<p><strong>Payment Details</strong><br>
Amount: ${esc(amount !== '' ? amount : 'Not provided')}<br>
Submission Version: ${esc(version)}<br>
Submission Time: ${esc(submittedAt)}</p>

<p>You may review this submission in the <strong>MTERMS 2026 Admin Portal</strong>:<br>
<a href="${base}/admin.html">${base}/admin.html</a></p>

<p>MTERMS 2026 Secretariat<br>
${esc(from)}</p>`;

  const t = makeTransport();
  await t.sendMail({
    from: `"MTERMS 2026" <${from}>`,
    to,
    subject,
    text,
    html
  });
}

async function loadReg(regCode, email) {
  return Registration.findOne({ regCode, 'personal.email': email });
}

// POST /api/uploads/gridfs (multipart)
// fields: regCode, email, type, file
router.post('/gridfs', upload.single('file'), async (req, res) => {
  try {
    const { regCode, email, type } = req.body || {};
    const file = req.file;

    if (!regCode || !email || !type || !file) {
      return res.status(400).json({ error: 'regCode, email, type & file are required' });
    }
    if (!ALLOWED_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Invalid upload type' });
    }
const allowed = ALLOWED_MIME[type] || [];
    
if (!allowed.includes(file.mimetype)) {
  const nice = (type === 'abstract')
    ? 'DOC or DOCX'
    : (type === 'profilePhoto')
      ? 'JPG or PNG'
      : (type === 'slides')
        ? 'PDF'
        : (type === 'poster')
          ? 'PDF, JPG, or PNG'
          : 'PDF, JPG, or PNG';

  return res.status(400).json({ error: `Invalid file type. Accepted: ${nice}` });
}

    // per-type size rules (poster is stricter than multer global limit)
    const maxBytes = MAX_BYTES_BY_TYPE[type];
    if (maxBytes && file.size > maxBytes) {
      const mb = (maxBytes / (1024*1024)).toFixed(0);
      return res.status(400).json({ error: `File too large. Max allowed for ${type} is ${mb} MB.` });
    }

    const reg = await loadReg(regCode.trim(), email.trim());
    if (!reg) return res.status(404).json({ error: 'Registration not found' });

    // versioning
    const existing = (reg.uploads || []).filter(u => u.type === type);
    const version = (existing.length ? Math.max(...existing.map(u => u.version)) : 0) + 1;

    const bucket = getBucket();
    const filename = `${regCode}/${type}/v${version}-${safeName(file.originalname)}`;

    // stream into GridFS
    const fileId = await new Promise((resolve, reject) => {
      const stream = bucket.openUploadStream(filename, {
        contentType: file.mimetype,
        metadata: { regCode, email, type, version }
      });
      stream.on('error', reject);
      stream.on('finish', () => resolve(stream.id));
      stream.end(file.buffer);
    });

    // record upload
    reg.uploads = reg.uploads || [];
    reg.uploads.push({
      type,
      version,
      gridFsId: fileId,
      filename: safeName(file.originalname),
      size: file.size,
      contentType: file.mimetype,
      uploadedAt: new Date()
    });

    if (type === 'studentProof') {
      reg.studentProof = reg.studentProof || {};
      reg.studentProof.provided = true;
    }

await reg.save();

let emailSent = false;

if (type === 'abstract') {
  try {
    await sendAbstractAdminEmail({ reg, version });
    emailSent = true;
  } catch (mailErr) {
    console.error('Abstract admin email failed:', mailErr);
  }
}

if (type === 'bankReceipt') {
  try {
    await sendBankReceiptAdminEmail({ reg, version });
    emailSent = true;
  } catch (mailErr) {
    console.error('Bank receipt admin email failed:', mailErr);
  }
}

res.json({
  ok: true,
  id: String(fileId),
  version,
  filename: safeName(file.originalname),
  emailSent
});
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// GET /api/uploads/history?regCode=...&email=...&type=optional
router.get('/history', async (req, res) => {
  const { regCode, email, type } = req.query || {};
  if (!regCode || !email) return res.status(400).json({ error: 'regCode & email required' });

  const reg = await loadReg(regCode.trim(), email.trim());
  if (!reg) return res.status(404).json({ error: 'Registration not found' });

  let list = reg.uploads || [];
  if (type) list = list.filter(u => u.type === type);
  list.sort((a,b) => b.version - a.version);

  const rows = list.map(u => ({
    type: u.type,
    version: u.version,
    filename: u.filename,
    uploadedAt: u.uploadedAt,
    // Direct download link guarded by regCode/email
    downloadUrl: `/api/uploads/download/${u.gridFsId}?regCode=${encodeURIComponent(regCode)}&email=${encodeURIComponent(email)}`
  }));

  res.json({ count: rows.length, rows });
});

// GET /api/uploads/download/:id?regCode=&email=
// Streams the file if the (regCode,email) owns that file id.
router.get('/download/:id', async (req, res) => {
  try {
    const { regCode, email } = req.query || {};
    const id = req.params.id;
    if (!regCode || !email || !id) return res.status(400).send('Missing parameters');

    const reg = await loadReg(regCode.trim(), email.trim());
    if (!reg) return res.status(404).send('Registration not found');

    const entry = (reg.uploads || []).find(u => String(u.gridFsId) === id);
    if (!entry) return res.status(403).send('Not authorized for this file');

    const bucket = getBucket();
    res.set('Content-Type', entry.contentType || 'application/octet-stream');
    res.set('Content-Disposition', `inline; filename="${entry.filename}"`);
    bucket.openDownloadStream(new ObjectId(id)).pipe(res);
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).send('Download failed');
  }
});

module.exports = router;
