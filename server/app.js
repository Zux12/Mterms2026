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

/* ---- CORS: allow all while stabilizing (simple & reliable) ----
   Once confirmed working, we can switch to a whitelist again.
*/
app.use((req, res, next) => { res.setHeader('Vary', 'Origin'); next(); });
app.use(cors());            // <-- allow every origin for now
app.options('*', cors());   // <-- answer preflight for all routes

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
