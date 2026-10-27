
'use strict';

const express = require('express');
const crypto = require('crypto');
const Expert = require('./experts.model');

const router = express.Router();

const TOKEN_TTL = 60 * 60 * 2; // 2 hours

const getSecret = () =>
  process.env.BIRT_ADMIN_TOKEN_SECRET ||
  process.env.SESSION_SECRET;

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));

  return x.length === y.length &&
    crypto.timingSafeEqual(x, y);
}

function sign(value) {
  return crypto
    .createHmac('sha256', getSecret())
    .update(value)
    .digest('base64url');
}

function createToken() {
  const payload = Buffer.from(JSON.stringify({
    scope: 'birt-admin',
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL
  })).toString('base64url');

  return payload + '.' + sign(payload);
}

function requireAdmin(req, res, next) {
  const authorization = req.get('Authorization') || '';

  const token = authorization.startsWith('Bearer ')
    ? authorization.slice(7)
    : '';

  const parts = token.split('.');

  if (
    parts.length !== 2 ||
    !getSecret() ||
    !safeEqual(sign(parts[0]), parts[1])
  ) {
    return res.status(401).json({
      status: 'error',
      message: 'Unauthorized'
    });
  }

  try {
    const payload = JSON.parse(
      Buffer.from(parts[0], 'base64url').toString()
    );

    if (
      payload.scope !== 'birt-admin' ||
      !Number.isFinite(payload.exp) ||
      payload.exp <= Date.now() / 1000
    ) {
      throw new Error('Expired');
    }

  } catch {
    return res.status(401).json({
      status: 'error',
      message: 'Session expired'
    });
  }

  next();
}

// Basic login attempt protection
const attempts = new Map();

router.post('/login', (req, res) => {
  const ip = req.ip || 'unknown';
  const now = Date.now();

  let attempt = attempts.get(ip) || {
    count: 0,
    resetAt: now + 15 * 60 * 1000
  };

  if (now > attempt.resetAt) {
    attempt = {
      count: 0,
      resetAt: now + 15 * 60 * 1000
    };
  }

  if (attempt.count >= 8) {
    return res.status(429).json({
      status: 'error',
      message: 'Too many login attempts. Try again later.'
    });
  }

  const username = process.env.BIRT_ADMIN_USERNAME;
  const password = process.env.BIRT_ADMIN_PASSWORD;

  if (!username || !password || !getSecret()) {
    return res.status(503).json({
      status: 'error',
      message: 'Admin authentication is not configured.'
    });
  }

  if (
    !safeEqual(req.body?.username || '', username) ||
    !safeEqual(req.body?.password || '', password)
  ) {
    attempt.count++;
    attempts.set(ip, attempt);

    return res.status(401).json({
      status: 'error',
      message: 'Invalid username or password.'
    });
  }

  attempts.delete(ip);

  res.set('Cache-Control', 'no-store');

  return res.json({
    status: 'success',
    token: createToken(),
    expiresIn: TOKEN_TTL
  });
});

// Protected registration listing
router.get('/registrations', requireAdmin, async (req, res) => {
  try {
    const page = Math.max(
      1,
      parseInt(req.query.page, 10) || 1
    );

    const limit = Math.max(
      1,
      Math.min(100, parseInt(req.query.limit, 10) || 25)
    );

    const filter = {
      event: 'TERMIS-AP 2028'
    };

    const validStatuses = [
      'New',
      'Under Review',
      'Shortlisted',
      'Contacted',
      'Confirmed',
      'Declined'
    ];

    if (validStatuses.includes(req.query.status)) {
      filter.status = req.query.status;
    }

    if (
      typeof req.query.role === 'string' &&
      req.query.role.length <= 100
    ) {
      filter.roles = req.query.role;
    }

    if (req.query.membership === 'active') {
      filter.membershipStatus = 'Active';
    } else if (req.query.membership === 'none') {
      filter.membershipStatus = { $ne: 'Active' };
    }

    const [items, total] = await Promise.all([
      Expert.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      Expert.countDocuments(filter)
    ]);

    res.set('Cache-Control', 'no-store');

    return res.json({
      status: 'success',
      items,
      total,
      page,
      limit
    });

  } catch (error) {
    console.error('BIRT admin list error:', error);

    return res.status(500).json({
      status: 'error',
      message: 'Unable to load registrations.'
    });
  }
});

// Protected registration status update
router.patch(
  '/registrations/:id/status',
  requireAdmin,
  async (req, res) => {
    const validStatuses = [
      'New',
      'Under Review',
      'Shortlisted',
      'Contacted',
      'Confirmed',
      'Declined'
    ];

    if (!validStatuses.includes(req.body?.status)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid registration status.'
      });
    }

    if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid record ID.'
      });
    }

    try {
      const record = await Expert.findOneAndUpdate(
        {
          _id: req.params.id,
          event: 'TERMIS-AP 2028'
        },
        {
          $set: { status: req.body.status }
        },
        {
          new: true,
          runValidators: true
        }
      );

      if (!record) {
        return res.status(404).json({
          status: 'error',
          message: 'Registration not found.'
        });
      }

      return res.json({
        status: 'success',
        id: record.id,
        statusValue: record.status
      });

    } catch (error) {
      console.error('BIRT status update error:', error);

      return res.status(500).json({
        status: 'error',
        message: 'Unable to update registration.'
      });
    }
  }
);

// Protected CSV export
router.get('/export.csv', requireAdmin, async (req, res) => {
  try {
    const records = await Expert.find({
      event: 'TERMIS-AP 2028'
    })
      .sort({ createdAt: -1 })
      .limit(20000)
      .lean();

    const fields = [
      'reference',
      'createdAt',
      'name',
      'title',
      'email',
      'phone',
      'organisation',
      'designation',
      'department',
      'country',
      'roles',
      'otherRole',
      'expertise',
      'profile',
      'availability',
      'notes',
      'status',
      'consent',
      'membershipStatus',
      'memberSince'
    ];

    function csvCell(value) {
      let text = Array.isArray(value)
        ? value.join('; ')
        : value == null ? '' : String(value);

      // Prevent spreadsheet formula injection
      if (/^\s*[=+@-]/.test(text)) {
        text = "'" + text;
      }

      return '"' + text.replace(/"/g, '""') + '"';
    }

    const csv = '\uFEFF' +
      fields.map(csvCell).join(',') +
      '\r\n' +
      records.map(record =>
        fields.map(field => csvCell(record[field])).join(',')
      ).join('\r\n');

    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition':
        'attachment; filename="birt-termis-2028-experts.csv"',
      'Cache-Control': 'no-store'
    });

    return res.send(csv);

  } catch (error) {
    console.error('BIRT CSV export error:', error);

    return res.status(500).json({
      status: 'error',
      message: 'Unable to export registrations.'
    });
  }
});

module.exports = router;
