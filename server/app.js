// server/app.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const pricingRouter = require('./routes/pricing');

const app = express();
app.use(express.json());
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
const registrationsRouter = require('./routes/registrations');
app.use('/api/registrations', registrationsRouter);


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
