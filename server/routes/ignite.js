// server/routes/ignite.js
const express = require('express');
const multer = require('multer');

const ReviewerInterest = require('../models/ReviewerInterest');
const { getBucket, ObjectId } = require('../lib/gridfs');

const router = express.Router();

router.options('*', (req, res) => res.sendStatus(204));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

const ALLOWED_PROFILE_MIME = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

function safeName(name = 'file') {
  return String(name).replace(/[^\w\-.]+/g, '_').slice(0, 140);
}

function igniteAuth(req, res, next) {
  const header = String(req.headers.authorization || '');

  if (!header.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Ignite Reviewer Network"');
    return res.status(401).json({ error: 'Ignite login required' });
  }

  const raw = Buffer.from(header.slice(6), 'base64').toString('utf8');
  const [username, password] = raw.split(':');

  if (username === 'ignite' && password === 'ignite') {
    return next();
  }

  return res.status(401).json({ error: 'Invalid Ignite credentials' });
}

// POST /api/ignite/reviewer-interest
// Public submission endpoint
router.post('/reviewer-interest', upload.single('profileFile'), async (req, res) => {
  try {
    const body = req.body || {};

    const fullName = String(body.fullName || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const phone = String(body.phone || '').trim();
    const institution = String(body.institution || '').trim();
    const position = String(body.position || '').trim();
    const country = String(body.country || '').trim();
    const expertise = String(body.expertise || '').trim();
    const highestQualification = String(body.highestQualification || '').trim();
    const scholarProfile = String(body.scholarProfile || '').trim();
    const professionalProfileText = String(body.professionalProfileText || '').trim();

    const consentContact =
      body.consentContact === 'true' ||
      body.consentContact === true ||
      body.consentContact === 'on';

    if (!fullName || !email || !institution || !position || !country || !expertise) {
      return res.status(400).json({
        error: 'Please complete all required fields.'
      });
    }

    if (!consentContact) {
      return res.status(400).json({
        error: 'Please tick the consent checkbox before submitting.'
      });
    }

    const existing = await ReviewerInterest.findOne({ email }).select('_id').lean();

    if (existing) {
      return res.status(409).json({
        error: 'Your interest has already been registered.'
      });
    }

    let profileFile = undefined;

    if (req.file) {
      if (!ALLOWED_PROFILE_MIME.includes(req.file.mimetype)) {
        return res.status(400).json({
          error: 'Invalid profile file type. Please upload PDF, DOC, or DOCX only.'
        });
      }

      const bucket = getBucket();
      const storedName = `reviewer-interest/${Date.now()}-${safeName(req.file.originalname)}`;

      const fileId = await new Promise((resolve, reject) => {
        const stream = bucket.openUploadStream(storedName, {
          contentType: req.file.mimetype,
          metadata: {
            type: 'reviewerInterestProfile',
            email,
            fullName
          }
        });

        stream.on('error', reject);
        stream.on('finish', () => resolve(stream.id));
        stream.end(req.file.buffer);
      });

      profileFile = {
        gridFsId: fileId,
        filename: safeName(req.file.originalname),
        size: req.file.size,
        contentType: req.file.mimetype,
        uploadedAt: new Date()
      };
    }

    const doc = await ReviewerInterest.create({
      fullName,
      email,
      phone,
      institution,
      position,
      country,
      expertise,
      highestQualification,
      scholarProfile,
      professionalProfileText,
      consentContact,
      profileFile
    });

    res.status(201).json({
      ok: true,
      message: 'Your registration of interest has been received. You will receive an email soon once your details are confirmed in our database.',
      id: doc._id
    });

  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({
        error: 'Your interest has already been registered.'
      });
    }

    console.error('Reviewer interest submission error:', err);
    res.status(500).json({
      error: 'Failed to submit reviewer interest.'
    });
  }
});

// GET /api/ignite/reviewer-interests
// Ignite-only list
router.get('/reviewer-interests', igniteAuth, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));

    const filter = {};

    if (q) {
      filter.$or = [
        { fullName: new RegExp(q, 'i') },
        { email: new RegExp(q, 'i') },
        { institution: new RegExp(q, 'i') },
        { position: new RegExp(q, 'i') },
        { country: new RegExp(q, 'i') },
        { expertise: new RegExp(q, 'i') }
      ];
    }

    const [rows, total] = await Promise.all([
      ReviewerInterest.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ReviewerInterest.countDocuments(filter)
    ]);

    res.json({ ok: true, rows, total, page, limit });

  } catch (err) {
    console.error('Ignite reviewer interests list error:', err);
    res.status(500).json({ error: 'Failed to load reviewer interests.' });
  }
});

// GET /api/ignite/reviewer-interests/export
// Ignite-only CSV export
router.get('/reviewer-interests/export', igniteAuth, async (req, res) => {
  try {
    const rows = await ReviewerInterest.find({})
      .sort({ createdAt: -1 })
      .lean();

    const headers = [
      'Submitted At',
      'Full Name',
      'Email',
      'Phone',
      'Institution / Company',
      'Position / Designation',
      'Country',
      'Expertise',
      'Highest Qualification',
      'ORCID / Scopus / Google Scholar',
      'Professional Profile',
      'Uploaded File',
      'Status'
    ];

    function csvCell(value) {
      const s = String(value ?? '');
      return `"${s.replaceAll('"', '""')}"`;
    }

    const lines = [headers.map(csvCell).join(',')];

    rows.forEach(r => {
      lines.push([
        r.createdAt ? new Date(r.createdAt).toISOString() : '',
        r.fullName || '',
        r.email || '',
        r.phone || '',
        r.institution || '',
        r.position || '',
        r.country || '',
        r.expertise || '',
        r.highestQualification || '',
        r.scholarProfile || '',
        r.professionalProfileText || '',
        r.profileFile?.filename || '',
        r.status || ''
      ].map(csvCell).join(','));
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="ignite-reviewer-interests.csv"');
    res.send(lines.join('\n'));

  } catch (err) {
    console.error('Ignite export error:', err);
    res.status(500).send('Export failed');
  }
});

// GET /api/ignite/reviewer-interests/:id/profile-file
// Ignite-only file download
router.get('/reviewer-interests/:id/profile-file', igniteAuth, async (req, res) => {
  try {
    const doc = await ReviewerInterest.findById(req.params.id).lean();

    if (!doc?.profileFile?.gridFsId) {
      return res.status(404).send('No profile file uploaded');
    }

    const bucket = getBucket();

    res.set('Content-Type', doc.profileFile.contentType || 'application/octet-stream');
    res.set('Content-Disposition', `attachment; filename="${doc.profileFile.filename || 'profile-file'}"`);

    bucket.openDownloadStream(new ObjectId(doc.profileFile.gridFsId)).pipe(res);

  } catch (err) {
    console.error('Ignite profile file download error:', err);
    res.status(500).send('Download failed');
  }
});

module.exports = router;
