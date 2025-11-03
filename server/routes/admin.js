// server/routes/admin.js
const express = require('express');
const router = express.Router();
const Registration = require('../models/Registration');

// super-basic Basic-Auth (dev only). Change later to real auth/JWT.
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin';
function adminAuth(req, res, next){
  const h = req.headers.authorization || '';
  if (!h.startsWith('Basic ')) return res.status(401).json({ error: 'Auth required' });
  const [user, pass] = Buffer.from(h.slice(6), 'base64').toString('utf8').split(':');
  if (user === ADMIN_USER && pass === ADMIN_PASS) return next();
  return res.status(401).json({ error: 'Invalid credentials' });
}

// GET /api/admin/registrations?q=&page=&limit=
router.get('/registrations', adminAuth, async (req,res)=>{
  const { q = '', page = 1, limit = 20 } = req.query;
  const p = Math.max(1, parseInt(page,10));
  const l = Math.min(100, Math.max(1, parseInt(limit,10)));

  const query = q ? {
    $or: [
      { regCode: new RegExp(q, 'i') },
      { 'personal.email': new RegExp(q, 'i') },
      { 'personal.firstName': new RegExp(q, 'i') },
      { 'personal.lastName': new RegExp(q, 'i') },
      { 'professional.affiliation': new RegExp(q, 'i') },
    ]
  } : {};

  const [rows, total] = await Promise.all([
    Registration.find(query).sort({ createdAt: -1 }).skip((p-1)*l).limit(l),
    Registration.countDocuments(query)
  ]);

  res.json({ rows, total, page: p, limit: l });
});

// GET /api/admin/registrations/:id
router.get('/registrations/:id', adminAuth, async (req,res)=>{
  const doc = await Registration.findById(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  res.json({ doc });
});

// PUT /api/admin/registrations/:id
router.put('/registrations/:id', adminAuth, async (req,res)=>{
  const { updates = {} } = req.body || {};
  // sanitize: avoid overwriting regCode by mistake
  delete updates._id; delete updates.regCode; delete updates.createdAt; delete updates.updatedAt;

  const doc = await Registration.findByIdAndUpdate(
    req.params.id,
    { $set: updates },
    { new: true }
  );
  if (!doc) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true, doc });
});

module.exports = router;
