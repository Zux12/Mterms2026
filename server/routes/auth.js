// server/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const Registration = require('../models/Registration');

const router = express.Router();

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
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

module.exports = router;
