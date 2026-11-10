'use strict';
const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const router = express.Router();
const db = mongoose.connection.useDb('jalan_navigation', { useCache: true });
const schema = new mongoose.Schema({
  cell: String, direction: Number, speed: Number,
  at: { type: Date, default: Date.now }, source: String, sessionHash: String
}, { versionKey: false, collection: 'traffic_observations' });
schema.index({ at: 1 }, { expireAfterSeconds: 900 });
schema.index({ cell: 1, direction: 1, at: -1 });
const Observation = db.models.TrafficObservation || db.model('TrafficObservation', schema);
const ipBuckets = new Map();
router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.get('/health', (_req, res) => res.json({ ok: true, service: 'jalan', database: db.name, mode: 'pilot-v4.8' }));
function cell(lat, lon) { return `${Math.floor(lat * 500)}:${Math.floor(lon * 500)}`; }
function dir(heading) { return Math.floor((((heading % 360) + 360) % 360) / 45); }
function validCoord(x, lo, hi) { return typeof x === 'number' && Number.isFinite(x) && x >= lo && x <= hi; }
function median(values) {
  if (!values.length) return null;
  const a = values.slice().sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
router.post('/observations', express.json({ limit: '2kb' }), async (req, res) => {
  try {
    const now = Date.now(), ip = req.ip || 'unknown';
    const bucket = ipBuckets.get(ip) || { n: 0, until: now + 60000 };
    if (now > bucket.until) { bucket.n = 0; bucket.until = now + 60000; }
    if (++bucket.n > 20) { ipBuckets.set(ip, bucket); return res.status(429).json({ error: 'Too many requests' }); }
    ipBuckets.set(ip, bucket);
    const { lat, lon, speedKmh, heading, accuracy, sessionId } = req.body || {};
    if (!validCoord(lat, -90, 90) || !validCoord(lon, -180, 180) ||
        !validCoord(speedKmh, 0, 180) || !validCoord(heading, 0, 360) ||
        !validCoord(accuracy, 0, 25) || typeof sessionId !== 'string' ||
        !/^[a-zA-Z0-9_-]{16,80}$/.test(sessionId)) {
      return res.status(400).json({ error: 'Invalid observation' });
    }
    if (!process.env.JALAN_HASH_SECRET || process.env.JALAN_HASH_SECRET.length < 32) {
      return res.status(503).json({ error: 'Jalan server configuration incomplete' });
    }
    const sessionHash = crypto.createHmac('sha256', process.env.JALAN_HASH_SECRET).update(sessionId).digest('hex');
    await Observation.create({ cell: cell(lat, lon), direction: dir(heading), speed: Math.round(speedKmh), source: 'opt-in', sessionHash });
    return res.status(202).json({ accepted: true, retentionMinutes: 15 });
  } catch (e) {
    console.error('Jalan submit failed:', e.message);
    return res.status(503).json({ error: 'Traffic service unavailable' });
  }
});

// Two complete, consecutive two-minute windows. A session contributes one
// median speed per window, regardless of how many GPS fixes it submitted.
// This is evidence of sustained low speed in an approximate grid cell,
// NOT proof that the drivers share the same road or that a jam exists.
router.get('/traffic', async (req, res) => {
  try {
    const lat = Number(req.query.lat), lon = Number(req.query.lon);
    if (!validCoord(lat, -90, 90) || !validCoord(lon, -180, 180)) {
      return res.status(400).json({ error: 'Invalid location' });
    }
    const baseLat = Math.floor(lat * 500), baseLon = Math.floor(lon * 500), cells = [];
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) cells.push(`${baseLat + a}:${baseLon + b}`);
    const now = Date.now(), WINDOW = 120000;
    const windowEnd = Math.floor(now / WINDOW) * WINDOW;
    const windowStart = windowEnd - 2 * WINDOW;
    const docs = await Observation.find({ cell: { $in: cells }, at: { $gte: new Date(windowStart), $lt: new Date(windowEnd) } })
      .select('cell direction speed at sessionHash -_id').lean().limit(12000);
    const grouped = new Map();
    for (const o of docs) {
      if (!Number.isFinite(o.speed) || !o.sessionHash || !Number.isInteger(o.direction)) continue;
      const win = Math.floor(o.at.getTime() / WINDOW);
      const key = `${o.cell}|${o.direction}`;
      if (!grouped.has(key)) grouped.set(key, { cell: o.cell, direction: o.direction, windows: new Map() });
      const g = grouped.get(key);
      if (!g.windows.has(win)) g.windows.set(win, new Map());
      const sessions = g.windows.get(win);
      if (!sessions.has(o.sessionHash)) sessions.set(o.sessionHash, []);
      sessions.get(o.sessionHash).push(o.speed);
    }
    const segments = [];
    for (const g of grouped.values()) {
      const windowStats = [windowEnd / WINDOW - 2, windowEnd / WINDOW - 1].map(win => {
        const sessions = g.windows.get(win) || new Map();
        const speeds = [...sessions.values()].map(median);
        return { contributors: sessions.size, medianSpeedKmh: median(speeds), observations: [...sessions.values()].reduce((n, a) => n + a.length, 0) };
      });
      const [older, newer] = windowStats;
      const enough = older.contributors >= 3 && newer.contributors >= 3;
      const sustainedLowSpeed = enough && older.medianSpeedKmh <= 20 && newer.medianSpeedKmh <= 20;
      // Preserve legacy keys for the V4.7 frontend. Only show groups with
      // >=3 distinct sessions in the most recent complete window.
      if (newer.contributors < 3) continue;
      segments.push({
        cell: g.cell, direction: g.direction,
        contributors: newer.contributors, observations: newer.observations,
        meanSpeedKmh: Math.round(newer.medianSpeedKmh), // legacy field; median, see speedStatistic
        medianSpeedKmh: Math.round(newer.medianSpeedKmh),
        speedStatistic: 'median-of-session-medians',
        evidence: sustainedLowSpeed ? 'sustained-low-speed' : enough ? 'no-sustained-low-speed' : 'insufficient-history',
        confidence: enough ? 'multi-session-two-windows' : 'preliminary',
        windows: windowStats.map(w => ({ contributors: w.contributors, medianSpeedKmh: w.medianSpeedKmh === null ? null : Math.round(w.medianSpeedKmh) }))
      });
    }
    segments.sort((a, b) => b.contributors - a.contributors);
    return res.json({ mode: 'pilot-v4.8', matching: 'approximate-grid-not-road-matched',
      note: 'Not confirmed congestion; road identity and normal-speed baseline are unavailable.',
      windowMinutes: 2, segments: segments.slice(0, 30) });
  } catch (e) {
    console.error('Jalan traffic failed:', e.message);
    return res.status(503).json({ error: 'Traffic service unavailable' });
  }
});

router.get('/self-test', (_req, res) => {
  const { runTests } = require('./selftest');
  const result = runTests();
  res.status(result.ok ? 200 : 500).json(result);
});

router.get('/road-matching-self-test', (_req, res) => {
  const { runTests } = require('./road-matching-selftest');
  const result = runTests();
  res.status(result.ok ? 200 : 500).json(result);
});

// Experimental diagnostic storage; no public write access without a server token.
router.use('/routing-diagnostics', require('./routing-diagnostics').router);

router.use('/road-pilot', require('./road-pilot').router);
router.use('/real-road', require('./real-road-matching').router);

router.get('/real-road-self-test', (_req, res) => {
  const result = require('./real-road-selftest').runTests();
  res.status(result.ok ? 200 : 500).json(result);
});

router.use('/real-road-field', require('./real-road-field-validation').router);

router.use('/multi-point', require('./multi-point-validation').router);
router.use('/weighted-sequence', require('./weighted-sequence-validation').router);
router.use('/topology', require('./topology-validation').router);
router.use('/network-foundation', require('./network-foundation').router);
router.use('/network-v490', require('./network-v490').router);
router.use('/network-v491', require('./network-v491').router);
router.use('/restriction-v492', require('./restriction-v492').router);
router.use('/network-v493', require('./network-v493').router);
router.use('/kl-preview-v4100', require('./kl-preview-v4100').router);
router.use('/kl-preview-v4101', require('./kl-preview-v4101').router);
router.use('/kl-segment-v4102', require('./kl-segment-v4102').router);

module.exports = router;
