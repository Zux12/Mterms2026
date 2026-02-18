// server/app.js
require('dotenv').config();
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');

const pricingRouter = require('./routes/pricing');
const registrationsRouter = require('./routes/registrations');
const uploadsRouter = require('./routes/uploads');
const authRouter = require('./routes/auth');
const adminRouter = require('./routes/admin');

const app = express();

/* Parsers */
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

/* ===== CORS + Preflight (stable) ===== */
app.set('trust proxy', 1);

app.use((req, res, next) => {
  const origin = req.headers.origin;

  const allowed = new Set([
    'https://www.mterms2026.com',
    'https://mterms2026.com'
  ]);

  if (origin && allowed.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

/* ===== Sessions (cross-site cookie for www.mterms2026.com -> herokuapp) ===== */
app.use(session({
  name: 'mterms.sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MTERM2026_DB_URI,
    collectionName: 'sessions',
    ttl: 60 * 60 * 24 * 14
  }),
  cookie: {
    httpOnly: true,
    secure: true,        // required for SameSite=None
    sameSite: 'none',    // required for cross-site cookies
    maxAge: 1000 * 60 * 60 * 24 * 14
  }
}));

/* Static (optional) */
app.use(express.static(path.join(__dirname, '../public')));

/* Health */
app.get('/api/health', (req, res) => res.json({ ok: true }));

/* API routes */
app.use('/api/pricing', pricingRouter);
app.use('/api/registrations', registrationsRouter);
app.use('/api/uploads', uploadsRouter);
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);

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
