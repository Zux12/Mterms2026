const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const mail = require('nodemailer');
const router = express.Router();
const origins = new Set(['https://oilandgas.eu.com', 'https://www.oilandgas.eu.com']);
const topics = new Set(['Measurement', 'Instrumentation & Control', 'Digitalisation', 'Reliability', 'Safety', 'Energy transition', 'Other']);

const policy = 'publication-v1';
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
function originalSource(input) {
  const raw = field(input,2048);
  const doi = raw.replace(/^doi:\s*/i,'');
  let url;
  try {
    url = new URL(/^10\.\d{4,9}\/[^\s]+$/i.test(doi)
      ? 'https://doi.org/' + doi.split('/').map(encodeURIComponent).join('/') : raw);
  } catch { invalid('Enter a DOI or a complete public link.'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password ||
      !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname) ||
      /\.(localhost|local|internal)$/i.test(url.hostname)) invalid('Enter a public link to the original paper.');
  return url.href;
}
function notice(job, editor) {
  const heading = editor ? 'Publication ready for review' : 'Publication received';
  const lines = [
    ['Reference',job.reference],['Status','Pending editorial review'],['Paper',job.title],
    ['Authors as published',job.byline],['Topic',job.topic],['Original source',job.source],
    ['Reader note',job.note],['Shared by',job.name],
    ['Relationship',job.relationship === 'author' ? 'Author of the paper' : 'Recommender']
  ];
  if (editor) lines.push(['Private contact',job.email]);
  const escape = str => str.replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);
  const intro = editor ? 'A publication has been submitted for your review.' : 'Thank you for sharing this paper with the editorial team.';
  return {
    subject:heading+' · '+job.reference,
    text:[intro,...lines.map(([k,v])=>k+': '+v),'Contact the editors: https://oilandgas.eu.com/contact.html'].join('\n\n'),
    html:`<div style="max-width:620px;margin:auto;padding:24px;font:16px/1.5 Arial;color:#202020"><div style="border-left:6px solid #f66520;padding-left:12px;font:bold 36px Arial">oil &amp; gas<span style="color:#f66520">.</span></div><p style="letter-spacing:1px;font-size:12px">KNOWLEDGE • EXPERTISE • EXCHANGE</p><hr><h1 style="font:30px Georgia">${heading}</h1><p>${intro}</p><table cellpadding="8" style="width:100%;background:#f7f6f2;text-align:left">${lines.map(([k,v])=>`<tr><th scope="row">${k}</th><td>${escape(v)}</td></tr>`).join('')}</table><p><a href="https://oilandgas.eu.com/contact.html">Contact the editors</a></p></div>`
  };
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
}, express.json({limit:'64kb'}), async (req,res,next) => {
  let session;
  try {
    const b = req.body || {};
    if (b.policy !== policy || !topics.has(b.topic)) invalid('Select a topic and accept the policy.');
    if (!['author','recommender'].includes(b.relationship)) invalid('Choose your connection to the paper.');
    const person = author(b);
    const publication = { title:field(b.title,350), byline:field(b.byline,4000),
      topic:b.topic, note:field(b.note,3000), source:originalSource(b.source),
      relationship:b.relationship, ...person };
    const id = crypto.createHash('sha256').update(JSON.stringify(publication)).digest('hex');
    const reference = 'OG-P-' + id.slice(0,16).toUpperCase();
    const now = new Date();
    const database = db();
    session = await mongoose.connection.startSession();
    await session.withTransaction(async () => {
      const result = await database.collection('publications').updateOne({_id:id}, {$setOnInsert:{
        reference, ...publication, status:'pending_review',
        policy, submittedAt:now
      }},{upsert:true,session});
      if (!result.upsertedCount) return;
      {
        const a = person;
        await database.collection('members').updateOne({_id:a.email},{
          $set:{status:'approved'},$setOnInsert:{...a,appliedAt:now,source:'publication'},
          $addToSet:{publicationPolicies:policy}
        },{upsert:true,session});
      }
      await database.collection('publication_mail').insertMany(['editor','contributor'].map(kind=>({
        _id:id+'-'+kind, reference, ...publication, kind, nextAttempt:now
      })),{session});
    });
    res.status(202).json({reference});
    deliver().catch(logError);
  } catch (err) { next(err); }
  finally { if (session) await session.endSession(); }
});
function logError(err) { console.error('Oil & Gas publications',err.code || err.name); }
router.use((err,req,res,next) => {
  logError(err);
  if (err.status === 400) return res.status(400).json({error:err.type ? 'Invalid request.' : err.message});
  if (err.status === 413) return res.status(413).json({error:'Submission is too large.'});
  res.status(503).json({error:'Receipt could not be confirmed. Retry the same submission.'});
});

// A durable queue retries each recipient independently after restarts or SMTP failures.
let working = false;
async function deliver() {
  if (working || mongoose.connection.readyState !== 1) return;
  working = true;
  try {
    const queue = db().collection('publication_mail');
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
          headers:editor ? {} : {'Resend-Idempotency-Key':job._id},
          ...notice(job,editor)
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
