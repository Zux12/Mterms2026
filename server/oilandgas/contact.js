const express = require('express');
const router = express.Router();
const origins = new Set(['https://oilandgas.eu.com', 'https://www.oilandgas.eu.com']);
let transport;
let windowEnd = 0;
const attempts = new Map();
let total = 0;

router.use((req, res, next) => {
  res.vary('Origin');
  if (!origins.has(req.get('Origin'))) return res.sendStatus(403);
  res.set('Access-Control-Allow-Origin', req.get('Origin'));
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

router.post('/', express.json({ limit: '32kb' }), async (req, res) => {
  const body = req.body || {};
  const fields = {};
  for (const [key, max] of Object.entries({name: 120, email: 180, message: 4000})) {
    if (typeof body[key] !== 'string') return res.sendStatus(400);
    fields[key] = body[key].trim();
    if (!fields[key] || fields[key].length > max) return res.sendStatus(400);
  }
  if (!/^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/.test(fields.email)) return res.sendStatus(400);
  if (Date.now() >= windowEnd) {
    attempts.clear();
    total = 0;
    windowEnd = Date.now() + 15 * 60 * 1000;
  }
  const hits = attempts.get(req.ip) || 0;
  if (hits >= 4 || total >= 60) return res.sendStatus(429);
  attempts.set(req.ip, hits + 1);
  total++;
  const user = process.env.OIL_CONTACT_MAILBOX;
  const pass = process.env.OIL_CONTACT_PASSWORD;
  const host = process.env.OIL_CONTACT_SMTP_HOST;
  if (!user || !pass || !host) return res.sendStatus(503);
  try {
    if (!transport) transport = require('nodemailer').createTransport({
      host, port: 465, secure: true, auth: { user, pass },
      connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 12000
    });
    const receipt = await transport.sendMail({
      from: user, to: user, replyTo: {address: fields.email},
      subject: 'Oil & Gas website enquiry',
      text: [fields.name, fields.email, '', fields.message].join('\n')
    });
    if (!receipt.accepted.length) return res.sendStatus(503);
    res.json({sent: true});
  } catch (error) {
    console.error('Oil & Gas contact delivery failed', error.code || 'SMTP');
    res.sendStatus(503);
  }
});
router.use((err, req, res, next) => res.sendStatus(err.type === 'entity.too.large' ? 413 : 400));
module.exports = router;
