// server/routes/uploads.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const Registration = require('../models/Registration');
const { getBucket, ObjectId } = require('../lib/gridfs');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB
});

const ALLOWED_TYPES = ['studentProof','bankReceipt','abstract','slides'];
const ALLOWED_MIME  = ['application/pdf','image/png','image/jpeg'];

function safeName(name='file') {
  return String(name).replace(/[^\w\-.]+/g, '_').slice(0, 120);
}

async function loadReg(regCode, email) {
  return Registration.findOne({ regCode, 'personal.email': email });
}

// POST /api/uploads/gridfs (multipart)
// fields: regCode, email, type, file
router.post('/gridfs', upload.single('file'), async (req, res) => {
  try {
    const { regCode, email, type } = req.body || {};
    const file = req.file;

    if (!regCode || !email || !type || !file) {
      return res.status(400).json({ error: 'regCode, email, type & file are required' });
    }
    if (!ALLOWED_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Invalid upload type' });
    }
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      return res.status(400).json({ error: 'Only PDF/JPG/PNG accepted' });
    }

    const reg = await loadReg(regCode.trim(), email.trim());
    if (!reg) return res.status(404).json({ error: 'Registration not found' });

    // versioning
    const existing = (reg.uploads || []).filter(u => u.type === type);
    const version = (existing.length ? Math.max(...existing.map(u => u.version)) : 0) + 1;

    const bucket = getBucket();
    const filename = `${regCode}/${type}/v${version}-${safeName(file.originalname)}`;

    // stream into GridFS
    const fileId = await new Promise((resolve, reject) => {
      const stream = bucket.openUploadStream(filename, {
        contentType: file.mimetype,
        metadata: { regCode, email, type, version }
      });
      stream.on('error', reject);
      stream.on('finish', () => resolve(stream.id));
      stream.end(file.buffer);
    });

    // record upload
    reg.uploads = reg.uploads || [];
    reg.uploads.push({
      type,
      version,
      gridFsId: fileId,
      filename: safeName(file.originalname),
      size: file.size,
      contentType: file.mimetype,
      uploadedAt: new Date()
    });

    if (type === 'studentProof') {
      reg.studentProof = reg.studentProof || {};
      reg.studentProof.provided = true;
    }

    await reg.save();

    res.json({
      ok: true,
      id: String(fileId),
      version,
      filename: safeName(file.originalname)
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// GET /api/uploads/history?regCode=...&email=...&type=optional
router.get('/history', async (req, res) => {
  const { regCode, email, type } = req.query || {};
  if (!regCode || !email) return res.status(400).json({ error: 'regCode & email required' });

  const reg = await loadReg(regCode.trim(), email.trim());
  if (!reg) return res.status(404).json({ error: 'Registration not found' });

  let list = reg.uploads || [];
  if (type) list = list.filter(u => u.type === type);
  list.sort((a,b) => b.version - a.version);

  const rows = list.map(u => ({
    type: u.type,
    version: u.version,
    filename: u.filename,
    uploadedAt: u.uploadedAt,
    // Direct download link guarded by regCode/email
    downloadUrl: `/api/uploads/download/${u.gridFsId}?regCode=${encodeURIComponent(regCode)}&email=${encodeURIComponent(email)}`
  }));

  res.json({ count: rows.length, rows });
});

// GET /api/uploads/download/:id?regCode=&email=
// Streams the file if the (regCode,email) owns that file id.
router.get('/download/:id', async (req, res) => {
  try {
    const { regCode, email } = req.query || {};
    const id = req.params.id;
    if (!regCode || !email || !id) return res.status(400).send('Missing parameters');

    const reg = await loadReg(regCode.trim(), email.trim());
    if (!reg) return res.status(404).send('Registration not found');

    const entry = (reg.uploads || []).find(u => String(u.gridFsId) === id);
    if (!entry) return res.status(403).send('Not authorized for this file');

    const bucket = getBucket();
    res.set('Content-Type', entry.contentType || 'application/octet-stream');
    res.set('Content-Disposition', `inline; filename="${entry.filename}"`);
    bucket.openDownloadStream(new ObjectId(id)).pipe(res);
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).send('Download failed');
  }
});

module.exports = router;
