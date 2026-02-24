// server/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const Registration = require('../models/Registration');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const PasswordReset = require('../models/PasswordReset');

const router = express.Router();

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function sha256Hex(s) {
  return crypto.createHash('sha256').update(String(s || '')).digest('hex');
}

function baseUrl() {
  // Use env var if set, fallback to your production site domain
  return (process.env.RESET_BASE_URL || 'https://www.mterms2026.com').replace(/\/+$/, '');
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
    secure: port === 465, // true for 465, false for 587
    auth: { user, pass }
  });
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // passwordHash is select:false in model, so we must explicitly select it
    const user = await Registration.findOne({ 'personal.email': email })
      .select('+auth.passwordHash regCode personal.firstName personal.lastName personal.email category payment.status')
      .lean(false);

    if (!user || !user.auth?.passwordHash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const ok = await bcrypt.compare(password, user.auth.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

    // Create session
    req.session.userId = String(user._id);
    req.session.email = user.personal.email;
    req.session.regCode = user.regCode;

 return res.json({
  ok: true,
  user: {
    regCode: user.regCode,
    category: user.category,
    personal: {
      email: user.personal.email,
      firstName: user.personal.firstName,
      lastName: user.personal.lastName
    },
    payment: {
      status: user.payment?.status || 'pending'
    }
  }
});
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('mterms.sid');
    res.json({ ok: true });
  });
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
  try {
    if (!req.session?.userId) return res.status(401).json({ error: 'Not logged in' });

    const user = await Registration.findById(req.session.userId)
      .select('regCode category personal professional address billing program student studentProof addons consents pricingSnapshot payment createdAt updatedAt')
      .lean();

    if (!user) return res.status(401).json({ error: 'Session invalid' });

    res.json({ ok: true, user });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// POST /api/auth/forgot
// Body: { email }
// Always returns ok:true to prevent email enumeration
router.post('/forgot', async (req, res) => {
  const email = normalizeEmail(req.body?.email);

  // Always respond ok:true, but still validate presence to avoid abuse
  if (!email) return res.json({ ok: true });

  try {
    const user = await Registration.findOne({ 'personal.email': email })
      .select('_id personal.email')
      .lean();

    // If no user, still return ok:true
    if (!user) return res.json({ ok: true });

    // Create reset token (sent to user); store only hash server-side
    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = sha256Hex(token);

    // Expire in 45 minutes (adjust if you want)
    const expiresAt = new Date(Date.now() + 45 * 60 * 1000);

    // Optional: invalidate existing active tokens for this user
    await PasswordReset.updateMany(
      { userId: user._id, usedAt: null, expiresAt: { $gt: new Date() } },
      { $set: { usedAt: new Date() } }
    );

    await PasswordReset.create({
      userId: user._id,
      email: user.personal.email,
      tokenHash,
      expiresAt,
      usedAt: null,
      ip: String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || ''),
      ua: String(req.headers['user-agent'] || '')
    });

    const resetLink = `${baseUrl()}/reset.html?token=${encodeURIComponent(token)}`;

    // Send email
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    const t = makeTransport();

    await t.sendMail({
      from: `"MTERMS 2026" <${from}>`,
      to: user.personal.email,
      subject: 'Reset your MTERMS 2026 password',
      text:
`You requested a password reset for your MTERMS 2026 account.

Reset link (valid for 45 minutes):
${resetLink}

If you didn’t request this, you can ignore this email.`,
      html:
`<p>You requested a password reset for your <b>MTERMS 2026</b> account.</p>
<p><a href="${resetLink}">Click here to reset your password</a> (valid for 45 minutes).</p>
<p>If you didn’t request this, you can ignore this email.</p>`
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error('Forgot password error:', err);
    // Still return ok:true (don’t leak)
    return res.json({ ok: true });
  }
});

// POST /api/auth/reset
// Body: { token, password }
router.post('/reset', async (req, res) => {
  try {
    const token = String(req.body?.token || '');
    const password = String(req.body?.password || '');

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const tokenHash = sha256Hex(token);

    const pr = await PasswordReset.findOne({
      tokenHash,
      usedAt: null,
      expiresAt: { $gt: new Date() }
    }).lean(false);

    if (!pr) {
      return res.status(400).json({ error: 'Reset link is invalid or expired' });
    }

    const newHash = await bcrypt.hash(password, 10);

    // Update user password
    await Registration.updateOne(
      { _id: pr.userId },
      { $set: { 'auth.passwordHash': newHash } }
    );

    // Mark token used
    pr.usedAt = new Date();
    await pr.save();

    return res.json({ ok: true });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
