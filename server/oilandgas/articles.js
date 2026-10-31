const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const mail = require('nodemailer');
const router = express.Router();
const origins = new Set(['https://oilandgas.eu.com', 'https://www.oilandgas.eu.com']);
const topics = new Set(['Measurement', 'Instrumentation & Control', 'Digitalisation', 'Reliability', 'Safety', 'Energy transition', 'Other']);
const MAX_FILE = 10 * 1024 * 1024;
const policy = 'article-v1';
const db = () => mongoose.connection.useDb('oilandgas', { useCache: true }).db;
function invalid(message) { throw Object.assign(new Error(message), { status: 400 }); }
function field(value, max) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) invalid('Please check the required fields.');
  return value.trim();
}
function author(input) {
  const name = field(input?.name, 160);
  const email = field(input?.email, 180).toLowerCase();
  if (!/^[^\s@,;<>"\\]+@[^\s@,;<>"\\]+\.[^\s@,;<>"\\]+$/.test(email)) invalid('Check each author’s email address.');
  return { name, email };
}
// Inspect the ZIP directory without extracting or modifying any manuscript content.
function wordDocument(data) {
  if (typeof data !== 'string' || data.length > 4 * Math.ceil(MAX_FILE / 3)) invalid('Choose a .docx up to 10 MB.');
  const file = Buffer.from(data, 'base64');
  const end = file.lastIndexOf(Buffer.from([80,75,5,6]));
  if (file.length > MAX_FILE || file.length < 22 || end < 0 || end + 22 > file.length ||
      file.readUInt32LE(0) !== 0x04034b50) invalid('Please upload a Word .docx file.');
  let offset = file.readUInt32LE(end + 16);
  const names = new Set();
  for (let i = 0; i < file.readUInt16LE(end + 10); i++) {
    if (offset + 46 > end || file.readUInt32LE(offset) !== 0x02014b50) invalid('Invalid Word document.');
    const length = file.readUInt16LE(offset + 28);
    names.add(file.toString('utf8', offset + 46, offset + 46 + length));
    offset += 46 + length + file.readUInt16LE(offset + 30) + file.readUInt16LE(offset + 32);
  }
  if (offset !== end || !names.has('word/document.xml') || !names.has('[Content_Types].xml') ||
      [...names].some(n => /vbaProject\.bin$/i.test(n))) invalid('Choose a standard .docx document.');
  return file;
}

router.use((req,res,next) => {
  res.vary('Origin');
  if (!origins.has(req.get('Origin'))) return res.sendStatus(403);
  res.set('Access-Control-Allow-Origin',req.get('Origin'));
  res.set('Access-Control-Allow-Headers','Content-Type');
  res.set('Access-Control-Allow-Methods','POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
const attempts = new Map();
let resetAt = 0;
router.post('/', (req,res,next) => {
  if (Date.now() >= resetAt) { attempts.clear(); resetAt = Date.now() + 15*60*1000; }
  const n = attempts.get(req.ip) || 0;
  if (n >= 6 || attempts.size >= 2000) return res.sendStatus(429);
  attempts.set(req.ip,n+1);
  next();
}, express.json({limit:'15mb'}), async (req,res,next) => {
  let session;
  try {
    const b = req.body || {};
    if (b.policy !== policy || !topics.has(b.topic)) invalid('Select a topic and accept the policy.');
    if (!Array.isArray(b.authors) || !b.authors.length || b.authors.length > 100) invalid('Check the author list.');
    const authors = b.authors.map(author);
    if (new Set(authors.map(a=>a.email)).size !== authors.length) invalid('Use a different email for each author.');
    const title = field(b.title,250);
    const summary = field(b.summary,4000);
    let manuscript;
    if (b.mode === 'word') manuscript = { filename:'manuscript.docx', bytes:wordDocument(b.file) };
    else if (b.mode === 'text') manuscript = { text:field(b.text,250000) };
    else invalid('Select a manuscript format.');
    const id = crypto.createHash('sha256').update(JSON.stringify([authors,title,summary,b.topic,b.mode,policy])).update(manuscript.bytes || manuscript.text).digest('hex');
    const reference = 'OG-A-' + id.slice(0,16).toUpperCase();
    const now = new Date();
    const database = db();
    session = await mongoose.connection.startSession();
    await session.withTransaction(async () => {
      const result = await database.collection('articles').updateOne({_id:id}, {$setOnInsert:{
        reference, title, summary, topic:b.topic, authors, manuscript, status:'pending_review',
        policy, submittedAt:now
      }},{upsert:true,session});
      if (!result.upsertedCount) return;
      for (const a of authors) {
        await database.collection('members').updateOne({_id:a.email},{
          $set:{status:'approved'},$setOnInsert:{...a,appliedAt:now,source:'article'},
          $addToSet:{articlePolicies:policy}
        },{upsert:true,session});
      }
      await database.collection('article_mail').insertMany(['editor','author'].map(kind=>({
        _id:id+'-'+kind, reference, title, kind, authorName:authors[0].name, email:authors[0].email, nextAttempt:now
      })),{session});
    });
    res.status(202).json({reference});
    deliver().catch(logError);
  } catch (err) { next(err); }
  finally { if (session) await session.endSession(); }
});
function receiptHtml(job) {
  const escape = value => String(value).replace(/[&<>"']/g, ch =>
    ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'})[ch]);
  const greeting = job.authorName ? 'Dear ' + escape(job.authorName) + ',' : 'Dear contributor,';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#fff;color:#20201f;font:16px/1.55 Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;text-align:left"><tr><td style="padding:32px 22px">
<div style="border-left:6px solid #f66520;padding-left:12px;font:bold 38px/1 Arial,sans-serif;letter-spacing:-2px">oil &amp; gas<span style="color:#f66520">.</span></div>
<p style="margin:12px 0 0;padding-bottom:22px;border-bottom:2px solid #242424;font:12px Arial,sans-serif;letter-spacing:1px">KNOWLEDGE &bull; EXPERTISE &bull; EXCHANGE</p>
<h1 style="margin:28px 0 18px;font:normal 30px/1.2 Georgia,serif">Article received</h1>
<p>${greeting}</p><p>Thank you for submitting <strong>${escape(job.title)}</strong> to Oil &amp; Gas. Your manuscript is with our editorial team for review.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:18px 20px;background:#f6f4f0;border-left:4px solid #f66520">
<div style="font:12px Arial,sans-serif;letter-spacing:1px;color:#595852">SUBMISSION REFERENCE</div>
<div style="margin:6px 0 12px;font:bold 18px Arial,sans-serif;overflow-wrap:anywhere">${escape(job.reference)}</div>
<div><strong>Status</strong> &nbsp; Pending editorial review</div></td></tr></table>
<p>If you have a question or need to correct a detail, <a href="https://oilandgas.eu.com/contact.html" style="color:#953809">contact the editors</a> and include your reference number.</p>
<p style="margin:26px 0 4px">Oil &amp; Gas Editorial Team</p>
</td></tr></table></td></tr></table></body></html>`;
}

function logError(err) { console.error('Oil & Gas articles',err.code || err.name); }
router.use((err,req,res,next) => {
  logError(err);
  if (err.status === 400) return res.status(400).json({error:err.type ? 'Invalid request.' : err.message});
  if (err.status === 413) return res.status(413).json({error:'File exceeds the upload limit.'});
  res.status(503).json({error:'Receipt could not be confirmed. Retry the same submission.'});
});

// A durable queue retries each recipient independently after restarts or SMTP failures.
let working = false;
async function deliver() {
  if (working || mongoose.connection.readyState !== 1) return;
  working = true;
  try {
    const queue = db().collection('article_mail');
    for (let i = 0; i < 12; i++) {
      const due = {nextAttempt:{$lte:new Date()}};
      const job = await queue.findOne(due,{sort:{nextAttempt:1}});
      if (!job) break;
      const lock = crypto.randomUUID();
      const claim = await queue.updateOne({_id:job._id,...due},{$set:{lock,nextAttempt:new Date(Date.now()+300000)}});
      if (!claim.modifiedCount) continue;
      try {
        const editor = job.kind === 'editor';
        const mailbox = process.env.OIL_CONTACT_MAILBOX;
        const sender = editor ? mailbox : 'receipts@updates.oilandgas.eu.com';
        const host = editor ? process.env.OIL_CONTACT_SMTP_HOST : 'smtp.resend.com';
        const user = editor ? mailbox : 'resend';
        const pass = editor ? process.env.OIL_CONTACT_PASSWORD : process.env.OIL_ARTICLE_RESEND_KEY;
        if (!host || !user || !pass) throw Error('Missing mail configuration');
        const smtp = mail.createTransport({host, port:465, secure:true,
          auth:{user,pass}, connectionTimeout:10000, socketTimeout:20000});
        const result = await smtp.sendMail({
          from:{name:'Oil & Gas Editorial',address:sender},
          to:{address:editor ? mailbox : job.email},
          ...(editor ? {} : {html:receiptHtml(job)}),
          headers:editor ? {} : {'Resend-Idempotency-Key':job._id},
          subject:'Article received · '+job.reference,
          text:[editor ? 'A new article is ready for editorial review.' : 'Thank you. Your article has been received for editorial review.',
            job.title,job.reference,'Contact the editors: https://oilandgas.eu.com/contact.html'].join('\n\n')
        });
        if (!result.accepted.length) throw Error('Delivery declined');
        await queue.deleteOne({_id:job._id,lock});
      } catch (err) {
        logError(err);
        await queue.updateOne({_id:job._id,lock},{$inc:{failures:1},$set:{nextAttempt:new Date(Date.now()+Math.min(24*3600000,60000*2**Math.min(job.failures||0,11)))}});
      }
    }
  } finally { working=false; }
}
setInterval(()=>deliver().catch(logError),60000).unref();
module.exports = router;
