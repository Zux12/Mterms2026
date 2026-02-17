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

const app = express();


// ✅ CORS (simple + reliable)
app.set('trust proxy', 1);



/* Parsers */
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));


// ✅ CORS + Preflight (manual, stable across Safari/Heroku)
app.set('trust proxy', 1);

app.use((req, res, next) => {
  const origin = req.headers.origin;

  // Allow your website origins
  const allowed = new Set([
    'https://www.mterms2026.com',
    'https://mterms2026.com'
  ]);

  // If request has Origin and it’s allowed, reflect it back
  if (origin && allowed.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  // Always allow these headers/methods (preflight needs this)
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Preflight
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});




app.use(session({
  name: 'mterms.sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MTERM2026_DB_URI,
    collectionName: 'sessions',
    ttl: 60 * 60 * 24 * 14 // 14 days
  }),
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',        // true on Heroku
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 14 // 14 days
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
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));


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
