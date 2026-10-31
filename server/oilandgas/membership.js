1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
32
33
34
35
36
37
38
39
40
41
42
43
44
45
46
47
48
49
50
51
52
53
54
55
56
57
58
59
60
61
62
63
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const origins = new Set(['https://oilandgas.eu.com', 'https://www.oilandgas.eu.com']);
const limits = { name: 120, email: 180, role: 150, country: 100, interest: 100, organisation: 180, introduction: 1500 };
const required = ['name', 'email', 'role', 'country', 'interest'];
const interests = new Set(['Measurement & metering', 'Instrumentation & Control', 'Reliability & maintenance', 'Safety & assurance', 'Digitalisation', 'Energy transition', 'Other']);

router.use((req, res, next) => {
  const origin = req.get('Origin');
  res.vary('Origin');
  if (origin && !origins.has(origin)) return res.sendStatus(403);
  if (origin) res.set('Access-Control-Allow-Origin', origin);
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
router.use(express.json({ limit: '16kb' }));

function members() {
  return mongoose.connection.useDb('oilandgas', { useCache: true }).collection('members');
}

router.get('/count', async (req, res, next) => {
  try {
    const count = await members().countDocuments({ status: 'approved' });
    res.set('Cache-Control', 'no-store').json({ count });
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  const body = req.body || {};
  if (body.consent !== true) return res.status(400).json({ error: 'Please confirm your consent.' });
  const member = {};
  for (const [field, limit] of Object.entries(limits)) {
    const value = body[field] === undefined ? '' : body[field];
    if (typeof value !== 'string' || value.trim().length > limit) {
      return res.status(400).json({ error: 'Please check the ' + field + ' field.' });
    }
    member[field] = value.trim();
  }
  member.email = member.email.toLowerCase();
  if (required.some(field => !member[field]) || !interests.has(member.interest) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(member.email)) {
    return res.status(400).json({ error: 'Please check your email and required fields.' });
  }
  try {
    // The built-in unique _id prevents concurrent applications for the same address.
    await members().insertOne({ ...member, _id: member.email, status: 'pending', consent: true, appliedAt: new Date() });
  } catch (error) {
    if (error.code !== 11000) return next(error);
  }
  res.status(202).json({ received: true });
});
router.use((error, req, res, next) => {
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Application too large.' });
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid application.' });
  console.error('Oil & Gas membership database error', error.code || error.name);
  res.status(503).json({ error: 'Membership is temporarily unavailable. Please try again later.' });
});
module.exports = router;
