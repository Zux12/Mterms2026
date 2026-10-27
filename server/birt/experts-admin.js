
'use strict';

const express = require('express');
const crypto = require('crypto');
const Expert = require('./experts.model');
const Member = require('./membership.model');

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


// Combined read-only membership directory (two collections retained).
// A bounded first version; expand to aggregation-based pagination if records grow.
async function combinedMembers() {
  const [expertRecords, directRecords] = await Promise.all([
    Expert.find({ membershipStatus: 'Active' })
      .select('name email title organisation designation country expertise reference memberSince createdAt')
      .sort({ createdAt: -1 }).limit(20000).lean(),
    Member.find({ status: 'Active' })
      .select('name email title organisation designation country expertise membershipCategory memberId joinedAt createdAt')
      .sort({ createdAt: -1 }).limit(20000).lean()
  ]);
  const byEmail = new Map();
  for (const e of expertRecords) {
    const key = String(e.email || '').trim().toLowerCase();
    if (!key) continue;
    byEmail.set(key, {
      name:e.name, email:key, title:e.title, organisation:e.organisation,
      designation:e.designation, country:e.country, expertise:e.expertise,
      membershipCategory:'', memberId:'', reference:e.reference,
      joinedAt:e.memberSince || e.createdAt, source:'expert',
      sourceLabel:'Expert form', sources:['expert']
    });
  }
  for (const m of directRecords) {
    const key = String(m.email || '').trim().toLowerCase();
    if (!key) continue;
    const previous = byEmail.get(key);
    if (previous) {
      byEmail.set(key, {
        ...previous,
        name:m.name || previous.name,
        organisation:m.organisation || previous.organisation,
        country:m.country || previous.country,
        expertise:m.expertise || previous.expertise,
        membershipCategory:m.membershipCategory,
        memberId:m.memberId,
        joinedAt: previous.joinedAt && m.joinedAt
          ? new Date(Math.min(new Date(previous.joinedAt).getTime(),new Date(m.joinedAt).getTime()))
          : previous.joinedAt || m.joinedAt,
        source:'both',sourceLabel:'Expert form + Direct membership',sources:['expert','direct']
      });
    } else {
      byEmail.set(key, {
        name:m.name,email:key,title:m.title,organisation:m.organisation,
        designation:m.designation,country:m.country,expertise:m.expertise,
        membershipCategory:m.membershipCategory,memberId:m.memberId,
        reference:'',joinedAt:m.joinedAt || m.createdAt,
        source:'direct',sourceLabel:'Direct membership',sources:['direct']
      });
    }
  }
  return {
    members:[...byEmail.values()].sort((a,b)=>new Date(b.joinedAt||0)-new Date(a.joinedAt||0)),
    counts:{uniqueActive:byEmail.size,expertRecords:expertRecords.length,directRecords:directRecords.length},
    truncated:expertRecords.length===20000 || directRecords.length===20000
  };
}

router.get('/members', requireAdmin, async (req,res)=>{
  try {
    const page=Math.max(1,Math.min(100000,parseInt(req.query.page,10)||1));
    const limit=Math.max(1,Math.min(100,parseInt(req.query.limit,10)||25));
    const source=['expert','direct'].includes(req.query.source)?req.query.source:'';
    const result=await combinedMembers();
    if(result.truncated) return res.status(503).json({status:'error',message:'Membership data exceeds the current directory limit. Contact the administrator.'});
    const selected=source?result.members.filter(x=>x.sources.includes(source)):result.members;
    res.set('Cache-Control','no-store');
    return res.json({status:'success',items:selected.slice((page-1)*limit,page*limit),total:selected.length,page,limit,counts:result.counts});
  } catch(err) {console.error('BIRT members list error:',err);return res.status(500).json({status:'error',message:'Unable to load members.'})}
});

router.get('/members/export.csv',requireAdmin,async(req,res)=>{
  try {
    const result=await combinedMembers();
    if(result.truncated) return res.status(503).json({status:'error',message:'Membership export exceeds the current limit.'});
    const fields=['name','email','title','organisation','designation','country','membershipCategory','expertise','sourceLabel','joinedAt','memberId','reference'];
    const csvCell=value=>{
      let str=value==null?'':String(value);
      if(/^\s*[=+@-]/.test(str))str="'"+str;
      return '"'+str.replace(/"/g,'""')+'"';
    };
    const csv='\uFEFF'+fields.map(csvCell).join(',')+'\r\n'+result.members.map(x=>fields.map(f=>csvCell(x[f])).join(',')).join('\r\n');
    res.set({'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="birt-members.csv"','Cache-Control':'no-store'});
    return res.send(csv);
  } catch(err) {console.error('BIRT members export error:',err);return res.status(500).json({status:'error',message:'Unable to export members.'})}
});

module.exports = router;
