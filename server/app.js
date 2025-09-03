// server/app.js
require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const pricingRouter = require('./routes/pricing');
const registrationsRouter = require('./routes/registrations');
const uploadsRouter = require('./routes/uploads');

const app = express();

/* ---- CORS (whitelist, robust) ----
   Set on Heroku:
   heroku config:set CORS_ORIGIN="https://zux12.github.io" -a mterm2026-559f9bf571b5
   (comma-separate to allow more origins)
*/
const ALLOWED = (process.env.CORS_ORIGIN || '*')
  .split(',')
  .map(s => s.trim().replace(/\/$/, '').toLowerCase());

app.use((req, res, next) => { res.setHeader('Vary', 'Origin'); next(); });

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // curl/Postman/same-origin
    const o = origin.replace(/\/$/, '').toLowerCase();
    if (ALLOWED.includes('*') || ALLOWED.includes(o)) return cb(null, true);
    return cb(new Error('CORS: origin not allowed'));
  },
  methods: ['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: false,
  maxAge: 86400
}));
app.options('*', cors());

/* Parsers */
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

/* Static (optional) */
app.use(express.static(path.join(__dirname, '../public')));

/* Health */
app.get('/api/health', (req, res) => res.json({ ok: true }));

/* API routes */
app.use('/api/pricing', pricingRouter);
app.use('/api/registrations', registrationsRouter);
app.use('/api/uploads', uploadsRouter);

/* Friendly root */
app.get('/', (req, res) => {
  res.type('text/plain').send('MTERM2026 API is running. Try /api/health or /api/pricing/table');
});

/* Start */
const PORT = process.env.PORT || 3000;
mongoose.connect(process.env.MTERM2026_DB_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log(`Server listening on :${PORT}`));
  })
  .catch(err => {
    console.error('Mongo connection error:', err);
    process.exit(1);
  });
