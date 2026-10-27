
'use strict';

const express = require('express');
const crypto = require('crypto');
const Expert = require('./experts.model');
const { sendExpertEmails } = require('./experts-email');

const router = express.Router();

const ALLOWED_ORIGINS = new Set([
  'https://birtlab.com',
  'https://www.birtlab.com'
]);

const ALLOWED_ROLES = new Set([
  'Scientific Speaker',
  'Scientific Reviewer',
  'Panel Member',
  'Session Chair / Moderator',
  'Workshop Facilitator',
  'Research Collaborator',
  'Industry / Technology Partner',
  'Other'
]);

const MAX_LENGTHS = {
  name: 160,
  title: 100,
  email: 254,
  phone: 50,
  organisation: 200,
  designation: 150,
  department: 200,
  country: 100,
  otherRole: 200,
  expertise: 3000,
  profile: 500,
  availability: 100,
  notes: 3000
};

function clean(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function createReference() {
  const date = new Date();
  const stamp = [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0')
  ].join('');

  const suffix = crypto.randomBytes(5)
    .toString('hex')
    .toUpperCase();

  return `BIRT-2028-${stamp}-${suffix}`;
}

// Basic per-process rate limiting.
// For multiple Heroku dynos, use a shared rate limiter later.
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function rateLimit(req, res, next) {
  const now = Date.now();
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  if (attempts.size > 5000) {
    for (const [key, value] of attempts) {
      if (value.resetAt <= now) attempts.delete(key);
    }
  }

  let record = attempts.get(ip);

  if (!record || record.resetAt <= now) {
    record = {
      count: 0,
      resetAt: now + WINDOW_MS
    };
  }

  record.count++;
  attempts.set(ip, record);

  if (record.count > MAX_ATTEMPTS) {
    return res.status(429).json({
      status: 'error',
      message: 'Too many submissions. Please try again later.'
    });
  }

  next();
}

// Public registration endpoint
router.post('/', rateLimit, async (req, res) => {
  try {
    const origin = req.get('Origin');

    if (!origin || !ALLOWED_ORIGINS.has(origin)) {
      return res.status(403).json({
        status: 'error',
        message: 'Origin not permitted.'
      });
    }

    const body = req.body || {};

    const data = {};

    for (const [field, limit] of Object.entries(MAX_LENGTHS)) {
      data[field] = clean(body[field], limit);
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (
      !data.name ||
      !data.email ||
      !data.organisation ||
      !data.designation ||
      !data.country ||
      !data.expertise
    ) {
      return res.status(400).json({
        status: 'error',
        message: 'Please complete all required fields.'
      });
    }

    if (!emailPattern.test(data.email)) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide a valid email address.'
      });
    }

    let roles = body.roles;

    if (typeof roles === 'string') {
      roles = roles.split(',').map(x => x.trim());
    }

    if (!Array.isArray(roles)) {
      roles = [];
    }

    roles = [...new Set(
      roles.filter(role =>
        typeof role === 'string' &&
        ALLOWED_ROLES.has(role)
      )
    )];

    if (!roles.length) {
      return res.status(400).json({
        status: 'error',
        message: 'Select at least one participation role.'
      });
    }

    if (roles.includes('Other') && !data.otherRole) {
      return res.status(400).json({
        status: 'error',
        message: 'Please specify your other participation interest.'
      });
    }

    if (body.consent !== true) {
      return res.status(400).json({
        status: 'error',
        message: 'Consent is required.'
      });
    }

    if (data.profile) {
      try {
        const url = new URL(data.profile);

        if (!['https:', 'http:'].includes(url.protocol)) {
          throw new Error('Invalid protocol');
        }
      } catch {
        return res.status(400).json({
          status: 'error',
          message: 'Please provide a valid professional profile URL.'
        });
      }
    }
const email = data.email.toLowerCase().trim();
const event = 'TERMIS-AP 2028';

// Check for an existing registration
const existing = await Expert.findOne({
  email,
  event
});

if (existing) {
  return res.status(409).json({
    status: 'duplicate',
    message:
      'An expression of interest has already been registered ' +
      'using this email address. Please contact BIRT Lab ' +
      'if you need to update your information.'
  });
}

// Create a new registration
const reference = createReference();
// Save registration in MongoDB first
const expert = await Expert.create({
  ...data,
  email,
  reference,
  roles,
  consent: true,
  event,
  registrationType: 'Expression of Interest',
  status: 'New'
});

// Send acknowledgement and admin notification.
// Email failures must never undo a saved registration.
try {
  const emailResult = await sendExpertEmails(expert);

  console.log('BIRT registration emails:', {
    reference,
    applicantSent: emailResult.applicantSent,
    adminSent: emailResult.adminSent
  });

} catch (emailError) {
  console.error(
    'BIRT email error for registration:',
    reference,
    emailError
  );
}

// Return success because MongoDB saved the registration
return res.status(201).json({
  status: 'success',
  message: 'Your expression of interest has been received.',
  reference
});

} catch (error) {

  if (error.code === 11000) {
    return res.status(409).json({
      status: 'duplicate',
      message:
        'An expression of interest already exists for this email address.'
    });
  }

  console.error('BIRT registration error:', error);

    return res.status(500).json({
      status: 'error',
      message: 'Unable to process registration at this time.'
    });
  }
});

// Non-sensitive endpoint for checking the module
router.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'BIRT Expert Registration'
  });
});

module.exports = router;
