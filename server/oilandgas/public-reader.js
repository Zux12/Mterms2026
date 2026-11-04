'use strict';
const express = require('express');
const router = express.Router();
const website = 'https://oilandgas.eu.com';
const origins = new Set([website, 'https://www.oilandgas.eu.com']);

router.get('/read.html', (req, res) => {
  const url = new URL('/read.html', website);
  for (const key of ['kind', 'ref']) {
    if (typeof req.query[key] === 'string') url.searchParams.set(key, req.query[key]);
  }
  res.redirect(301, url.href);
});

router.get('/published/:kind/:ref', (req, res, next) => {
  const origin = req.get('Origin');
  res.vary('Origin');
  if (origins.has(origin)) res.set('Access-Control-Allow-Origin', origin);
  next();
});

module.exports = router;
