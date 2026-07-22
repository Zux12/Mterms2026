const express = require('express');
const crypto = require('crypto');
const AnalyticsSession = require('../models/AnalyticsSession');

const router = express.Router();

const MAX_PAGES_PER_SESSION = 100;
const MAX_SESSION_SECONDS = 60 * 60 * 12;

function safeString(value, max = 300) {
  return String(value || '').trim().slice(0, max);
}

function clampNumber(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function adminAuth(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="MTERMS Admin"');
    return res.status(401).json({ error: 'Admin authentication required' });
  }

  let decoded = '';
  try {
    decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  } catch {
    return res.status(401).json({ error: 'Invalid authorization header' });
  }

  const separator = decoded.indexOf(':');
  const username = separator >= 0 ? decoded.slice(0, separator) : '';
  const password = separator >= 0 ? decoded.slice(separator + 1) : '';

  const expectedUser = process.env.ADMIN_USER || 'admin';
  const expectedPass = process.env.ADMIN_PASS || 'admin';

  if (username !== expectedUser || password !== expectedPass) {
    return res.status(401).json({ error: 'Invalid admin credentials' });
  }

  next();
}

function getClientIp(req) {
  const forwarded = safeString(req.headers['x-forwarded-for'], 500);
  let ip = forwarded ? forwarded.split(',')[0].trim() : (req.socket?.remoteAddress || '');
  ip = ip.replace(/^::ffff:/, '');
  return ip;
}

function isPrivateIp(ip) {
  return !ip ||
    ip === '127.0.0.1' ||
    ip === '::1' ||
    /^10\./.test(ip) ||
    /^192\.168\./.test(ip) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip);
}

function countryNameFromCode(code) {
  const normalized = safeString(code, 3).toUpperCase();
  if (!normalized || normalized === 'XX' || normalized === 'T1') return 'Unknown';

  try {
    const names = new Intl.DisplayNames(['en'], { type: 'region' });
    return names.of(normalized) || normalized;
  } catch {
    return normalized;
  }
}

async function detectCountry(req) {
  const headerCode =
    req.headers['cf-ipcountry'] ||
    req.headers['x-vercel-ip-country'] ||
    req.headers['cloudfront-viewer-country'];

  if (headerCode) {
    const code = safeString(headerCode, 3).toUpperCase();
    return { countryCode: code, country: countryNameFromCode(code) };
  }

  const ip = getClientIp(req);
  if (isPrivateIp(ip)) return { countryCode: 'XX', country: 'Unknown' };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const response = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'MTERMS2026-Analytics/1.0' }
    });
    clearTimeout(timeout);

    if (!response.ok) throw new Error(`Geolocation HTTP ${response.status}`);
    const data = await response.json();

    const code = safeString(data.country_code, 3).toUpperCase() || 'XX';
    const country = safeString(data.country_name, 100) || countryNameFromCode(code);
    return { countryCode: code, country };
  } catch {
    return { countryCode: 'XX', country: 'Unknown' };
  }
}

function parseUserAgent(userAgent) {
  const ua = safeString(userAgent, 600);
  let deviceType = 'Desktop';
  if (/ipad|tablet|playbook|silk/i.test(ua)) deviceType = 'Tablet';
  else if (/mobi|iphone|ipod|android/i.test(ua)) deviceType = 'Mobile';
  else if (!ua) deviceType = 'Other';

  let browser = 'Unknown';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\//.test(ua)) browser = 'Opera';
  else if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = 'Safari';

  let operatingSystem = 'Unknown';
  if (/Windows NT 10/.test(ua)) operatingSystem = 'Windows';
  else if (/Windows NT/.test(ua)) operatingSystem = 'Windows';
  else if (/Android/.test(ua)) operatingSystem = 'Android';
  else if (/iPhone|iPad|iPod/.test(ua)) operatingSystem = 'iOS/iPadOS';
  else if (/Mac OS X/.test(ua)) operatingSystem = 'macOS';
  else if (/Linux/.test(ua)) operatingSystem = 'Linux';

  return { deviceType, browser, operatingSystem };
}

function normalizePath(value) {
  let path = safeString(value, 300);
  if (!path) return '/';
  try {
    const url = new URL(path, 'https://www.mterms2026.com');
    path = url.pathname || '/';
  } catch {
    path = path.split('?')[0].split('#')[0] || '/';
  }
  return path;
}

function anonymizeVisitorId(visitorId) {
  const salt = process.env.ANALYTICS_HASH_SALT || process.env.SESSION_SECRET || 'mterms-analytics';
  return crypto.createHash('sha256').update(`${salt}:${safeString(visitorId, 200)}`).digest('hex');
}

router.post('/session', async (req, res) => {
  try {
    const body = req.body || {};
    const action = safeString(body.action, 20);
    const sessionId = safeString(body.sessionId, 120);
    const visitorId = safeString(body.visitorId, 200);

    if (!sessionId || !visitorId || !['start', 'heartbeat', 'end'].includes(action)) {
      return res.status(400).json({ error: 'Invalid analytics payload' });
    }

    const now = new Date();
    const pagePath = normalizePath(body.page);
    const pageTitle = safeString(body.title, 300);
    const pageDuration = clampNumber(body.pageDurationSeconds, 0, MAX_SESSION_SECONDS);
    const sessionDuration = clampNumber(body.sessionDurationSeconds, 0, MAX_SESSION_SECONDS);
    const visitorIdHash = anonymizeVisitorId(visitorId);

    let session = await AnalyticsSession.findOne({ sessionId });

    if (!session) {
      const country = await detectCountry(req);
      const tech = parseUserAgent(req.headers['user-agent']);

      session = new AnalyticsSession({
        sessionId,
        visitorIdHash,
        countryCode: country.countryCode,
        country: country.country,
        deviceType: tech.deviceType,
        browser: tech.browser,
        operatingSystem: tech.operatingSystem,
        language: safeString(body.language, 30),
        screenWidth: clampNumber(body.screenWidth, 0, 10000),
        screenHeight: clampNumber(body.screenHeight, 0, 10000),
        landingPage: pagePath,
        lastPage: pagePath,
        totalPageViews: 0,
        durationSeconds: sessionDuration,
        pages: [],
        startedAt: now,
        lastActivityAt: now
      });
    }

    let page = session.pages[session.pages.length - 1];
    const isSameCurrentPage = page && page.path === pagePath;

    if (action === 'start' && !isSameCurrentPage && session.pages.length < MAX_PAGES_PER_SESSION) {
      session.pages.push({
        path: pagePath,
        title: pageTitle,
        enteredAt: now,
        lastActivityAt: now,
        durationSeconds: 0,
        views: 1
      });
      session.totalPageViews += 1;
      page = session.pages[session.pages.length - 1];
    } else if (!page && session.pages.length < MAX_PAGES_PER_SESSION) {
      session.pages.push({
        path: pagePath,
        title: pageTitle,
        enteredAt: now,
        lastActivityAt: now,
        durationSeconds: pageDuration,
        views: 1
      });
      session.totalPageViews += 1;
      page = session.pages[session.pages.length - 1];
    }

    if (page && page.path === pagePath) {
      page.lastActivityAt = now;
      page.durationSeconds = Math.max(page.durationSeconds || 0, pageDuration);
      if (!page.title && pageTitle) page.title = pageTitle;
    }

    session.lastPage = pagePath;
    session.lastActivityAt = now;
    session.durationSeconds = Math.max(session.durationSeconds || 0, sessionDuration);
    if (action === 'end') session.endedAt = now;

    await session.save();
    res.json({ ok: true });
  } catch (error) {
    console.error('Analytics session error:', error);
    res.status(500).json({ error: 'Unable to save analytics' });
  }
});

function parseDateRange(req) {
  const end = req.query.end ? new Date(req.query.end) : new Date();
  const start = req.query.start
    ? new Date(req.query.start)
    : new Date(end.getTime() - (29 * 24 * 60 * 60 * 1000));

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('Invalid date range');
  }

  end.setHours(23, 59, 59, 999);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

router.get('/admin/dashboard', adminAuth, async (req, res) => {
  try {
    const { start, end } = parseDateRange(req);
    const match = { startedAt: { $gte: start, $lte: end } };

    const [
      totalsRows,
      uniqueVisitorsRows,
      returningRows,
      visitorsByDay,
      countries,
      devices,
      browsers,
      operatingSystems,
      pages,
      visitsByHour,
      durationRanges
    ] = await Promise.all([
      AnalyticsSession.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            sessions: { $sum: 1 },
            pageViews: { $sum: '$totalPageViews' },
            avgDurationSeconds: { $avg: '$durationSeconds' },
            avgPages: { $avg: '$totalPageViews' }
          }
        }
      ]),
      AnalyticsSession.aggregate([
        { $match: match },
        { $group: { _id: '$visitorIdHash' } },
        { $count: 'count' }
      ]),
      AnalyticsSession.aggregate([
        { $match: match },
        { $group: { _id: '$visitorIdHash', sessions: { $sum: 1 } } },
        {
          $group: {
            _id: null,
            newVisitors: { $sum: { $cond: [{ $eq: ['$sessions', 1] }, 1, 0] } },
            returningVisitors: { $sum: { $cond: [{ $gt: ['$sessions', 1] }, 1, 0] } }
          }
        }
      ]),
      AnalyticsSession.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$startedAt', timezone: 'Asia/Kuala_Lumpur' } },
            sessions: { $sum: 1 },
            uniqueVisitors: { $addToSet: '$visitorIdHash' },
            pageViews: { $sum: '$totalPageViews' }
          }
        },
        { $project: { _id: 0, date: '$_id', sessions: 1, visitors: { $size: '$uniqueVisitors' }, pageViews: 1 } },
        { $sort: { date: 1 } }
      ]),
      AnalyticsSession.aggregate([
        { $match: match },
        { $group: { _id: '$country', sessions: { $sum: 1 }, visitors: { $addToSet: '$visitorIdHash' } } },
        { $project: { _id: 0, name: { $ifNull: ['$_id', 'Unknown'] }, sessions: 1, visitors: { $size: '$visitors' } } },
        { $sort: { visitors: -1 } },
        { $limit: 15 }
      ]),
      AnalyticsSession.aggregate([
        { $match: match },
        { $group: { _id: '$deviceType', value: { $sum: 1 } } },
        { $project: { _id: 0, name: '$_id', value: 1 } },
        { $sort: { value: -1 } }
      ]),
      AnalyticsSession.aggregate([
        { $match: match },
        { $group: { _id: '$browser', value: { $sum: 1 } } },
        { $project: { _id: 0, name: '$_id', value: 1 } },
        { $sort: { value: -1 } }
      ]),
      AnalyticsSession.aggregate([
        { $match: match },
        { $group: { _id: '$operatingSystem', value: { $sum: 1 } } },
        { $project: { _id: 0, name: '$_id', value: 1 } },
        { $sort: { value: -1 } }
      ]),
      AnalyticsSession.aggregate([
        { $match: match },
        { $unwind: '$pages' },
        {
          $group: {
            _id: '$pages.path',
            title: { $first: '$pages.title' },
            views: { $sum: '$pages.views' },
            avgDurationSeconds: { $avg: '$pages.durationSeconds' }
          }
        },
        { $project: { _id: 0, path: '$_id', title: 1, views: 1, avgDurationSeconds: { $round: ['$avgDurationSeconds', 0] } } },
        { $sort: { views: -1 } },
        { $limit: 20 }
      ]),
      AnalyticsSession.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $hour: { date: '$startedAt', timezone: 'Asia/Kuala_Lumpur' } },
            sessions: { $sum: 1 }
          }
        },
        { $project: { _id: 0, hour: '$_id', sessions: 1 } },
        { $sort: { hour: 1 } }
      ]),
      AnalyticsSession.aggregate([
        { $match: match },
        {
          $bucket: {
            groupBy: '$durationSeconds',
            boundaries: [0, 30, 60, 180, 300, 600, 3600, 43201],
            default: 'Other',
            output: { sessions: { $sum: 1 } }
          }
        }
      ])
    ]);

    const totals = totalsRows[0] || {};
    const visitorSplit = returningRows[0] || {};
    const uniqueVisitors = uniqueVisitorsRows[0]?.count || 0;

    res.json({
      range: { start, end },
      summary: {
        uniqueVisitors,
        sessions: totals.sessions || 0,
        pageViews: totals.pageViews || 0,
        avgDurationSeconds: Math.round(totals.avgDurationSeconds || 0),
        avgPages: Number((totals.avgPages || 0).toFixed(1)),
        newVisitors: visitorSplit.newVisitors || 0,
        returningVisitors: visitorSplit.returningVisitors || 0,
        totalCountries: countries.filter(x => x.name && x.name !== 'Unknown').length
      },
      visitorsByDay,
      countries,
      devices,
      browsers,
      operatingSystems,
      pages,
      visitsByHour,
      durationRanges
    });
  } catch (error) {
    console.error('Analytics dashboard error:', error);
    res.status(400).json({ error: error.message || 'Unable to load dashboard' });
  }
});

router.get('/admin/sessions', adminAuth, async (req, res) => {
  try {
    const { start, end } = parseDateRange(req);
    const page = clampNumber(req.query.page, 1, 100000);
    const limit = clampNumber(req.query.limit, 1, 100);
    const country = safeString(req.query.country, 100);
    const device = safeString(req.query.device, 30);
    const path = safeString(req.query.path, 300);

    const filter = { startedAt: { $gte: start, $lte: end } };
    if (country) filter.country = country;
    if (device) filter.deviceType = device;
    if (path) filter['pages.path'] = path;

    const [rows, total] = await Promise.all([
      AnalyticsSession.find(filter)
        .sort({ startedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select({
          sessionId: 1,
          country: 1,
          countryCode: 1,
          deviceType: 1,
          browser: 1,
          operatingSystem: 1,
          landingPage: 1,
          lastPage: 1,
          totalPageViews: 1,
          durationSeconds: 1,
          pages: 1,
          startedAt: 1,
          lastActivityAt: 1
        })
        .lean(),
      AnalyticsSession.countDocuments(filter)
    ]);

    res.json({ rows, total, page, limit });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Unable to load visitor sessions' });
  }
});

module.exports = router;
