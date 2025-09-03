// server/app.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
// CORS: open for now to unblock; we'll lock down later
const cors = require('cors');
app.use(cors({
  origin: (origin, cb) => cb(null, true), // allow all origins for now
  methods: ['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: false,
  maxAge: 86400
}));
// Ensure preflight responses
app.options('*', cors());


const pricingRouter = require('./routes/pricing');

const app = express();
app.use(express.json({ limit: '2mb' }));

const allowed = (process.env.CORS_ORIGIN || '*')
  .split(',')
  .map(s => s.trim());

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // curl, Postman
    if (allowed.includes('*') || allowed.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  }
}));





const registrationsRouter = require('./routes/registrations');
app.use('/api/registrations', registrationsRouter);
const uploadsRouter = require('./routes/uploads');
app.use('/api/uploads', uploadsRouter);



// OPTIONAL: serve your static site if it’s in /public
app.use(express.static('public'));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/pricing', pricingRouter);

const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MTERM2026_DB_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.get('/', (req, res) => {
  res.type('text/plain').send('MTERM2026 API is running. Try /api/health or /api/pricing/table');
});

    app.listen(PORT, () => console.log(`Server listening on :${PORT}`));
  })
  .catch(err => {
    console.error('Mongo connection error:', err);
    process.exit(1);
  });
