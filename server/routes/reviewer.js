// server/routes/reviewer.js
const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const crypto = require('crypto');

const Reviewer = require('../models/Reviewer');
const Registration = require('../models/Registration');
const AbstractReview = require('../models/AbstractReview');
const { getBucket, ObjectId } = require('../lib/gridfs');

const router = express.Router();

router.options('*', (req, res) => res.sendStatus(204));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

const ALLOWED_REVIEWER_FILE_MIME = [
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

function safeName(name = 'file') {
  return String(name).replace(/[^\w\-.]+/g, '_').slice(0, 120);
}

function calcTotal(scores = {}) {
  return (
    Number(scores.introductionObjective || 0) +
    Number(scores.materialsMethods || 0) +
    Number(scores.results || 0) +
    Number(scores.conclusion || 0) +
    Number(scores.significanceImplication || 0)
  );
}

async function ensureDefaultReviewers() {
  for (let i = 1; i <= 10; i++) {
    const username = `panel${i}`;
    const exists = await Reviewer.findOne({ username }).select('_id').lean();
    if (exists) continue;

    const passwordHash = await bcrypt.hash(username, 10);

    await Reviewer.create({
      username,
      displayName: `Panel Reviewer ${i}`,
      passwordHash,
      role: 'reviewer',
      status: 'active'
    });
  }
}

function reviewerSecret() {
  return process.env.SESSION_SECRET || process.env.MTERM2026_SESSION_SECRET || 'mterms2026-reviewer-secret';
}

function createReviewerToken(reviewer) {
  const payload = {
    id: String(reviewer._id),
    username: reviewer.username,
    displayName: reviewer.displayName || reviewer.username
  };

  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', reviewerSecret())
    .update(body)
    .digest('base64url');

  return `${body}.${sig}`;
}

function verifyReviewerToken(token) {
  if (!token || !token.includes('.')) return null;

  const [body, sig] = token.split('.');
  const expected = crypto
    .createHmac('sha256', reviewerSecret())
    .update(body)
    .digest('base64url');

  if (sig !== expected) return null;

  return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
}

function requireReviewer(req, res, next) {

  if (req.session?.reviewerId && req.session?.reviewerUsername) {
    return next();
  }

  let token = '';

  const auth = String(req.headers.authorization || '');
  if (auth.startsWith('Bearer ')) {
    token = auth.slice(7);
  }

  if (!token && req.query.token) {
    token = String(req.query.token);
  }

  const payload = verifyReviewerToken(token);

  if (!payload?.id || !payload?.username) {
    return res.status(401).json({ error: 'Reviewer login required' });
  }

  req.session.reviewerId = payload.id;
  req.session.reviewerUsername = payload.username;
  req.session.reviewerDisplayName = payload.displayName || payload.username;

  next();
}

// POST /api/reviewer/login
router.post('/login', async (req, res) => {
  try {
    await ensureDefaultReviewers();

    const username = String(req.body?.username || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const reviewer = await Reviewer.findOne({ username, status: 'active' })
      .select('+passwordHash username displayName role status')
      .lean(false);

    if (!reviewer) return res.status(401).json({ error: 'Invalid username or password' });

    const ok = await bcrypt.compare(password, reviewer.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid username or password' });

    reviewer.lastLoginAt = new Date();
    await reviewer.save();

    req.session.reviewerId = String(reviewer._id);
    req.session.reviewerUsername = reviewer.username;
    req.session.reviewerDisplayName = reviewer.displayName || reviewer.username;

res.json({
  ok: true,
  reviewerToken: createReviewerToken(reviewer),
  reviewer: {
    username: reviewer.username,
    displayName: reviewer.displayName || reviewer.username
  }
});

    
  } catch (err) {
    console.error('Reviewer login error:', err);
    res.status(500).json({ error: 'Reviewer login failed' });
  }
});

// POST /api/reviewer/logout
router.post('/logout', (req, res) => {
  delete req.session.reviewerId;
  delete req.session.reviewerUsername;
  delete req.session.reviewerDisplayName;
  res.json({ ok: true });
});

// GET /api/reviewer/me
router.get('/me', requireReviewer, (req, res) => {
  res.json({
    ok: true,
    reviewer: {
      username: req.session.reviewerUsername,
      displayName: req.session.reviewerDisplayName || req.session.reviewerUsername
    }
  });
});

// GET /api/reviewer/abstracts
router.get('/abstracts', requireReviewer, async (req, res) => {
  try {
    const username = req.session.reviewerUsername;

    const reviews = await AbstractReview.find({ assignedReviewerUsername: username })
      .sort({ updatedAt: -1 })
      .lean();

    const regIds = reviews.map(r => r.registrationId);
    const registrations = await Registration.find({ _id: { $in: regIds } })
      .select('regCode personal professional student program submission uploads createdAt')
      .lean();

    const regMap = new Map(registrations.map(r => [String(r._id), r]));

const rows = reviews
  .map(review => {
    const reg = regMap.get(String(review.registrationId));

    // registration deleted from MongoDB
    if (!reg) return null;

      const abstractUploads = Array.isArray(reg?.uploads)
        ? reg.uploads.filter(u => u.type === 'abstract')
        : [];

      abstractUploads.sort((a, b) => {
        const va = Number(a.version || 0);
        const vb = Number(b.version || 0);
        if (vb !== va) return vb - va;
        return new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0);
      });

      const latestAbstract = abstractUploads[0] || null;

      return {
        reviewId: review._id,
        registrationId: review.registrationId,
        regCode: review.regCode,
        status: review.status,
        submittedAt: review.submittedAt || null,
        assignedAt: review.assignedAt || null,
        participant: reg ? {
          name: `${reg.personal?.firstName || ''} ${reg.personal?.lastName || ''}`.trim(),
          email: reg.personal?.email || '',
          affiliation: reg.professional?.affiliation || reg.student?.university || '',
          presentationType: reg.program?.type || '',
          abstractTitle: reg.submission?.title || '',
          theme: reg.submission?.theme || '',
          field: reg.submission?.field || ''
        } : null,
        latestAbstract: latestAbstract ? {
          filename: latestAbstract.filename,
          version: latestAbstract.version,
          uploadedAt: latestAbstract.uploadedAt,
          downloadUrl: `/api/reviewer/abstracts/${review.registrationId}/abstract-file`
        } : null
              };
    })
    .filter(Boolean);

    res.json({ ok: true, rows });
  } catch (err) {
    console.error('Reviewer abstracts error:', err);
    res.status(500).json({ error: 'Failed to load assigned abstracts' });
  }
});

// GET /api/reviewer/reviews/:registrationId
router.get('/reviews/:registrationId', requireReviewer, async (req, res) => {
  try {
    const username = req.session.reviewerUsername;
    const registrationId = req.params.registrationId;

    const review = await AbstractReview.findOne({
      registrationId,
      assignedReviewerUsername: username
    }).lean();

    if (!review) return res.status(404).json({ error: 'Review assignment not found' });

    const reg = await Registration.findById(registrationId)
      .select('regCode personal professional student program submission uploads createdAt')
      .lean();

    if (!reg) return res.status(404).json({ error: 'Registration not found' });

    res.json({ ok: true, review, registration: reg });
  } catch (err) {
    console.error('Reviewer review load error:', err);
    res.status(500).json({ error: 'Failed to load review' });
  }
});

// PUT /api/reviewer/reviews/:registrationId
router.put('/reviews/:registrationId', requireReviewer, async (req, res) => {
  try {
    const username = req.session.reviewerUsername;
    const registrationId = req.params.registrationId;
    const mode = String(req.body?.mode || 'draft'); // draft or submitted

    const review = await AbstractReview.findOne({
      registrationId,
      assignedReviewerUsername: username
    });

    if (!review) return res.status(404).json({ error: 'Review assignment not found' });

    if (review.status === 'submitted') {
      return res.status(400).json({ error: 'This review has already been submitted and is locked' });
    }

    const scores = req.body?.scores || {};
    const total = calcTotal(scores);

    if (total > 35) {
      return res.status(400).json({ error: 'Total score cannot exceed 35' });
    }

    review.scores = {
      introductionObjective: Number(scores.introductionObjective || 0),
      materialsMethods: Number(scores.materialsMethods || 0),
      results: Number(scores.results || 0),
      conclusion: Number(scores.conclusion || 0),
      significanceImplication: Number(scores.significanceImplication || 0),
      total
    };

    review.requireCorrection = String(req.body?.requireCorrection || '');
    review.correctionReasons = {
      tooLong: !!req.body?.correctionReasons?.tooLong,
      poorlyWritten: !!req.body?.correctionReasons?.poorlyWritten,
      weakHypothesis: !!req.body?.correctionReasons?.weakHypothesis,
      vagueExperimentalPlan: !!req.body?.correctionReasons?.vagueExperimentalPlan,
      insufficientData: !!req.body?.correctionReasons?.insufficientData,
      others: !!req.body?.correctionReasons?.others,
      othersText: String(req.body?.correctionReasons?.othersText || '').trim()
    };

    review.recommendedCategory = String(req.body?.recommendedCategory || '');

    if (mode === 'submitted') {
      review.status = 'submitted';
      review.submittedAt = new Date();
    } else {
      review.status = 'draft';
    }

    await review.save();

    res.json({ ok: true, review });
  } catch (err) {
    console.error('Reviewer save review error:', err);
    res.status(500).json({ error: 'Failed to save review' });
  }
});

// POST /api/reviewer/reviews/:registrationId/commented-file
router.post('/reviews/:registrationId/commented-file', requireReviewer, upload.single('file'), async (req, res) => {
  try {
    const username = req.session.reviewerUsername;
    const registrationId = req.params.registrationId;
    const file = req.file;

    if (!file) return res.status(400).json({ error: 'File is required' });

    if (!ALLOWED_REVIEWER_FILE_MIME.includes(file.mimetype)) {
      return res.status(400).json({ error: 'Invalid file type. Accepted: DOC or DOCX only' });
    }

    const review = await AbstractReview.findOne({
      registrationId,
      assignedReviewerUsername: username
    });

    if (!review) return res.status(404).json({ error: 'Review assignment not found' });

    if (review.status === 'submitted') {
      return res.status(400).json({ error: 'This review has already been submitted and is locked' });
    }

    const bucket = getBucket();
    const filename = `reviewer-comments/${review.regCode}/${username}-${Date.now()}-${safeName(file.originalname)}`;

    const fileId = await new Promise((resolve, reject) => {
      const stream = bucket.openUploadStream(filename, {
        contentType: file.mimetype,
        metadata: {
          type: 'reviewerCommentedAbstract',
          regCode: review.regCode,
          registrationId: String(registrationId),
          reviewer: username
        }
      });

      stream.on('error', reject);
      stream.on('finish', () => resolve(stream.id));
      stream.end(file.buffer);
    });

    review.reviewerFile = {
      gridFsId: fileId,
      filename: safeName(file.originalname),
      size: file.size,
      contentType: file.mimetype,
      uploadedAt: new Date()
    };

    if (review.status === 'assigned') review.status = 'draft';

    await review.save();

    res.json({
      ok: true,
      file: {
        filename: review.reviewerFile.filename,
        uploadedAt: review.reviewerFile.uploadedAt
      }
    });
  } catch (err) {
    console.error('Reviewer commented file upload error:', err);
    res.status(500).json({ error: 'Failed to upload reviewer file' });
  }
});

// GET /api/reviewer/abstracts/:registrationId/abstract-file
router.get('/abstracts/:registrationId/abstract-file', requireReviewer, async (req, res) => {
  try {
    const username = req.session.reviewerUsername;
    const registrationId = req.params.registrationId;

    const review = await AbstractReview.findOne({
      registrationId,
      assignedReviewerUsername: username
    }).lean();

    if (!review) return res.status(403).send('Not authorized');

    const reg = await Registration.findById(registrationId).select('uploads').lean();
    if (!reg) return res.status(404).send('Registration not found');

    const abstracts = Array.isArray(reg.uploads)
      ? reg.uploads.filter(u => u.type === 'abstract')
      : [];

    abstracts.sort((a, b) => {
      const va = Number(a.version || 0);
      const vb = Number(b.version || 0);
      if (vb !== va) return vb - va;
      return new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0);
    });

    const latest = abstracts[0];
    if (!latest) return res.status(404).send('No abstract uploaded');

    const bucket = getBucket();

    res.set('Content-Type', latest.contentType || 'application/octet-stream');
    res.set('Content-Disposition', `inline; filename="${latest.filename}"`);

    bucket.openDownloadStream(new ObjectId(latest.gridFsId)).pipe(res);
  } catch (err) {
    console.error('Reviewer abstract download error:', err);
    res.status(500).send('Download failed');
  }
});

module.exports = router;
