const express = require('express');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'mterms-live',
    database: 'existing-mterms-database',
    collections: [
      'mtermslive_announcements',
      'mtermslive_messages',
      'mtermslive_feedback',
      'mtermslive_information'
    ]
  });
});

module.exports = router;
