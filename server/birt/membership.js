
'use strict';

const express = require('express');
const crypto = require('crypto');

const Member = require('./membership.model');
const Expert = require('./experts.model');

const router = express.Router();

const ALLOWED_ORIGINS = new Set([
  'https://birtlab.com',
  'https://www.birtlab.com'
]);

const CATEGORIES = new Set([
  'Academic',
  'Researcher',
  'Student',
  'Clinician',
  'Industry Professional',
  'Other'
]);

const attempts = new Map();

function clean(value, max = 200) {
  return typeof value === 'string'
    ? value.trim().slice(0, max)
    : '';
}

function createMemberId() {
  const year = new Date().getUTCFullYear();
  const random = crypto.randomBytes(5)
    .toString('hex')
    .toUpperCase();

  return `BIRT-M-${year}-${random}`;
}

function rateLimit(req, res, next) {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;

  for (const [key, value] of attempts) {
    if (value.resetAt <= now) attempts.delete(key);
  }

  let record = attempts.get(ip);

  if (!record) {
    record = {
      count: 0,
      resetAt: now + windowMs
    };
  }

  record.count++;
  attempts.set(ip, record);

  if (record.count > 8) {
    return res.status(429).json({
      status: 'error',
      message: 'Too many attempts. Please try again later.'
    });
  }

  next();
}

// Public membership registration
router.post('/', rateLimit, async (req, res) => {
  try {
    const origin = req.get('Origin');

    if (!ALLOWED_ORIGINS.has(origin)) {
      return res.status(403).json({
        status: 'error',
        message: 'Origin not permitted.'
      });
    }

    const body = req.body || {};

    const data = {
      name: clean(body.name, 160),
      email: clean(body.email, 254).toLowerCase(),
      title: clean(body.title, 100),
      organisation: clean(body.organisation, 200),
      designation: clean(body.designation, 150),
      country: clean(body.country, 100),
      membershipCategory: clean(body.membershipCategory, 100),
      expertise: clean(body.expertise, 3000),
      profile: clean(body.profile, 500)
    };

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (
      !data.name ||
      !data.email ||
      !data.country ||
      !data.membershipCategory
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

    if (!CATEGORIES.has(data.membershipCategory)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid membership category.'
      });
    }

    if (body.consent !== true) {
      return res.status(400).json({
        status: 'error',
        message: 'Privacy consent is required.'
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
          message: 'Invalid professional profile URL.'
        });
      }
    }

    // Check standalone membership records first
    const existing = await Member.findOne({
      email: data.email
    });

    if (existing) {
      return res.status(409).json({
        status: 'duplicate',
        message:
          'A BIRT Lab membership already exists using this email address.'
      });
    }

    // Check members who joined through earlier registration forms
    const previousExpert = await Expert.findOne({
      email: data.email,
      membershipStatus: 'Active'
    });

    if (previousExpert) {
      return res.status(409).json({
        status: 'duplicate',
        message:
          'You are already registered as a BIRT Lab member. ' +
          'Please contact research@birtlab.com for assistance.'
      });
    }

    const member = await Member.create({
      ...data,
      memberId: createMemberId(),
      status: 'Active',
      membershipFee: 0,
      joinedAt: new Date(),
      source: 'birtlab.com/membership.html',
      researchUpdatesConsent:
        body.researchUpdatesConsent === true,
      consent: true
    });

    return res.status(201).json({
      status: 'success',
      message: 'Welcome to the BIRT Lab Research Community.',
      memberId: member.memberId,
      membershipStatus: member.status
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        status: 'duplicate',
        message: 'A BIRT Lab membership already exists.'
      });
    }

    console.error('BIRT membership registration error:', error);

    return res.status(500).json({
      status: 'error',
      message: 'Unable to complete membership registration.'
    });
  }
});

// Read-only health check
router.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'BIRT Lab Membership'
  });
});

module.exports = router;
