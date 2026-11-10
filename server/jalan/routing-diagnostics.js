'use strict';
// Experimental diagnostic ingestion; mounted only on the development branch.
// Uses the existing MTERM2026_DB_URI/Mongoose connection and Jalan database.
const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');

const router = express.Router();
const db = mongoose.connection.useDb('jalan_navigation', { useCache: true });
const diagnostics = db.collection('routing_snap_diagnostics');
const fields = new Set(['experiment_id','start_node','goal_node','snap_distance_m',
  'route_minutes','reached','strategy','notes']);
const maxNode = 6922512;

function validate(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (Object.keys(value).some(k => !fields.has(k))) return null;
  if (typeof value.experiment_id !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,80}$/.test(value.experiment_id)) return null;
  for (const k of ['start_node', 'goal_node']) {
    if (k in value && (!Number.isSafeInteger(value[k]) || value[k] < 0 || value[k] >= maxNode)) return null;
  }
  for (const k of ['snap_distance_m','route_minutes']) {
    if (k in value && (typeof value[k] !== 'number' || !Number.isFinite(value[k]) ||
      value[k] < 0 || value[k] > (k === 'snap_distance_m' ? 2000 : 100000))) return null;
  }
  if ('reached' in value && typeof value.reached !== 'boolean') return null;
  for (const k of ['strategy','notes']) {
    if (k in value && (typeof value[k] !== 'string' ||
      value[k].length > (k === 'strategy' ? 80 : 300))) return null;
  }
  return { ...value, recorded_at: new Date(), source: 'jalan_experimental_backend' };
}

function authorized(req) {
  const secret = process.env.JALAN_DIAGNOSTICS_TOKEN;
  if (!secret || secret.length < 32) return false;
  const token = req.get('Authorization') || '';
  const expected = 'Bearer ' + secret;
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a,b);
}

router.use((_req,res,next) => { res.set('Cache-Control','no-store'); next(); });
router.get('/health', (_req,res) => res.json({
  ok:true, service:'jalan-routing-diagnostics', mode:'experimental',
  storageConfigured: Boolean(process.env.JALAN_DIAGNOSTICS_TOKEN &&
    process.env.JALAN_DIAGNOSTICS_TOKEN.length >= 32)
}));
router.post('/records', express.json({ limit:'8kb' }), async (req,res) => {
  if (!authorized(req)) return res.status(401).json({error:'Unauthorized'});
  const doc = validate(req.body);
  if (!doc) return res.status(400).json({error:'Invalid diagnostic'});
  try {
    await diagnostics.insertOne(doc);
    return res.status(201).json({stored:true});
  } catch (error) {
    console.error('Jalan diagnostic insert failed:', error.message);
    return res.status(503).json({error:'Storage unavailable'});
  }
});

module.exports = { router, validate, authorized };
