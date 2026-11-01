'use strict';
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const mongoose = require('mongoose');
const mail = require('nodemailer');
const router = express.Router();
const database = () => mongoose.connection.useDb('oilandgas', {useCache:true}).db;
const kinds = ['articles','publications'];
const site = 'https://oilandgas.eu.com';
const lifetime = 2 * 60 * 60 * 1000;
const cookieName = '__Secure-oilDesk';
const cookieOptions = {httpOnly:true, secure:true, sameSite:'strict', path:'/api/oilandgas/editor'};
const digest = value => crypto.createHash('sha256').update(value).digest();
const secret = () => process.env.OIL_EDITOR_PASSWORD || '';
const wrap = handler => (req,res,next) => Promise.resolve(handler(req,res)).catch(next);
const fail = (status,message) => { throw Object.assign(new Error(message),{status}); };
const safeLink = link => {
  try { const u = new URL(link); return ['http:','https:'].includes(u.protocol) && !u.username && !u.password ? u.href : ''; }
  catch { return ''; }
};
function fields(record) {
  return {
    title:record.title, summary:record.summary ?? record.note, topic:record.topic,
    byline:record.byline ?? record.authors.map(a=>a.name).join(', ')
  };
}
function publicEntry(record,kind) {
  return {kind,reference:record.reference, ...record.publication,
    source:kind==='publications' ? safeLink(record.source) : '',
    sharedBy:kind==='publications' ? record.name : '',publishedAt:record.publishedAt};
}
router.use((req,res,next)=>{
  res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
    'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"});
  next();
});
router.get('/',(req,res)=>res.redirect(302,req.baseUrl+'/desk.html'));
for (const file of ['desk.html','desk.css','desk.js','reader.js','read.html']) {
  router.get('/'+file,(req,res)=>res.sendFile(path.join(__dirname,'desk',file)));
}
router.get('/published',wrap(async(req,res)=>{
  const origin=req.get('Origin');
  if ([site,'https://www.oilandgas.eu.com'].includes(origin)) res.set('Access-Control-Allow-Origin',origin).vary('Origin');
  const lists=await Promise.all(kinds.map(async kind=>{
    const rows=await database().collection(kind).find({status:'published',publication:{$exists:true}},
      {projection:{reference:1,publication:1,source:1,name:1,publishedAt:1}}).sort({publishedAt:-1}).limit(100).toArray();
    return rows.map(r=>publicEntry(r,kind));
  }));
  res.json(lists.flat().sort((a,b)=>b.publishedAt-a.publishedAt));
}));
router.get('/published/:kind/:ref',wrap(async(req,res)=>{
  const {kind,ref}=req.params;
  if (!kinds.includes(kind)) return res.sendStatus(404);
  const r=await database().collection(kind).findOne({reference:ref,status:'published',publication:{$exists:true}},
    {projection:{reference:1,publication:1,source:1,name:1,publishedAt:1}});
  if (!r) return res.sendStatus(404);
  res.json(publicEntry(r,kind));
}));
router.use(express.json({limit:'32kb'}));
router.use((req,res,next)=>{
  if(req.method==='POST' && (req.get('Origin')!=='https://'+req.get('host') || !req.is('application/json'))) return res.sendStatus(403);
  next();
});
function sessionId(req) {
  const token=(req.headers.cookie || '').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.split('=')[1];
  return /^[a-f0-9]{64}$/.test(token||'') ? crypto.createHmac('sha256',secret()).update(token).digest('hex') : '';
}
router.post('/login',wrap(async(req,res)=>{
  const password=secret();
  if(password.length<16) fail(503,'Set the editor password in Heroku (at least 16 characters).');
  const db=database(), attempts=db.collection('editor_login_attempts');
  const bucket=Math.floor(Date.now()/900000);
  const key=bucket+':'+digest(req.ip||'unknown').toString('hex');
  await attempts.createIndex({expiresAt:1},{expireAfterSeconds:0});
  await attempts.updateOne({_id:key},{$inc:{tries:1},$setOnInsert:{expiresAt:new Date(Date.now()+1800000)}},{upsert:true});
  if ((await attempts.findOne({_id:key})).tries>8) fail(429,'Please try again after 15 minutes.');
  if(typeof req.body?.password!=='string' || !crypto.timingSafeEqual(digest(req.body.password),digest(password))) fail(401,'Incorrect password.');
  const token=crypto.randomBytes(32).toString('hex');
  const sessions=db.collection('editor_sessions');
  await sessions.createIndex({expiresAt:1},{expireAfterSeconds:0});
  await sessions.insertOne({_id:crypto.createHmac('sha256',password).update(token).digest('hex'),expiresAt:new Date(Date.now()+lifetime)});
  res.cookie(cookieName,token,{...cookieOptions,maxAge:lifetime}).json({ok:true});
}));
router.use(wrap(async(req,res,next)=>{
  const id=sessionId(req);
  if(!id || !secret() || !(await database().collection('editor_sessions').findOne({_id:id,expiresAt:{$gt:new Date()}}))) fail(401,'Please sign in.');
  next();
}));
router.post('/logout',wrap(async(req,res)=>{
  await database().collection('editor_sessions').deleteOne({_id:sessionId(req)});
  res.clearCookie(cookieName,cookieOptions).json({ok:true});
}));
router.get('/queue',wrap(async(req,res)=>{
  const status=req.query.status || 'pending_review';
  if(!['pending_review','approved','declined','published'].includes(status)) fail(400,'Unknown status.');
  const page=Number(req.query.page||0);
  if(!Number.isSafeInteger(page)||page<0||page>10000) fail(400,'Invalid page.');
  const rows=await Promise.all(kinds.map(async kind=>(await database().collection(kind).find({status},
    {projection:{reference:1,title:1,'draft.title':1,submittedAt:1}}).sort({submittedAt:-1,reference:1}).limit((page+1)*25+1).toArray()).map(r=>({kind,reference:r.reference,title:r.draft?.title||r.title,submittedAt:r.submittedAt}))));
  const sorted=rows.flat().sort((a,b)=>b.submittedAt-a.submittedAt||a.reference.localeCompare(b.reference));
  res.json({items:sorted.slice(page*25,(page+1)*25),more:sorted.length>(page+1)*25});
}));
router.use('/item/:kind/:ref',(req,res,next)=>{
  if(!kinds.includes(req.params.kind) || !/^OG-[AP]-[A-F0-9]{16}$/.test(req.params.ref)) return res.sendStatus(404);
  req.items=database().collection(req.params.kind);
  req.ref=req.params.ref;
  next();
});
router.get('/item/:kind/:ref',wrap(async(req,res)=>{
  const r=await req.items.findOne({reference:req.ref},{projection:{'manuscript.bytes':0}});
  if(!r) return res.sendStatus(404);
  res.json({original:fields(r),draft:r.draft||fields(r),reference:r.reference,status:r.status,version:r.editorVersion||0,
    contacts:r.authors||[{name:r.name,email:r.email}],source:safeLink(r.source),sharedBy:r.name,reason:r.declineReason,
    manuscript:!!r.manuscript,mailState:r.declineMail?.state});
}));
router.get('/item/:kind/:ref/manuscript',wrap(async(req,res)=>{
  const r=await req.items.findOne({reference:req.ref},{projection:{manuscript:1}});
  if(!r?.manuscript) return res.sendStatus(404);
  const bytes=r.manuscript.bytes;
  const data=bytes ? (Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes.value(true))) : Buffer.from(r.manuscript.text,'utf8');
  res.attachment(req.ref+(bytes?'.docx':'.txt')).send(data);
}));
const limits={title:350,summary:4000,topic:100,byline:18000};
function draftFields(input) {
  const draft={};
  for (const [key,max] of Object.entries(limits)) {
    if(typeof input?.[key]!=='string'||!input[key].trim()||input[key].length>max) fail(400,'Check the '+key+' field.');
    draft[key]=input[key].trim();
  }
  return draft;
}
router.post('/item/:kind/:ref/:action',wrap(async(req,res)=>{
  const {action}=req.params;
  const allowed={save:['pending_review','approved'],approve:['pending_review'],decline:['pending_review'],preview:['approved'],publish:['approved']};
  if(!Object.hasOwn(allowed,action)) return res.sendStatus(404);
  const version=req.body?.version;
  if(!Number.isSafeInteger(version)||version<0) fail(400,'Invalid version.');
  const filter={reference:req.ref,status:{$in:allowed[action]},editorVersion:version||{$in:[null,0]}};
  const r=await req.items.findOne(filter,{projection:{manuscript:0}});
  if(!r) fail(409,'This entry changed. Reopen it before continuing.');
  const draft=r.draft||fields(r);
  if(action==='preview') {
    const token=crypto.randomBytes(24).toString('hex');
    const ok=await req.items.updateOne(filter,{$set:{previewHash:digest(token).toString('hex')}});
    if(!ok.matchedCount) fail(409,'Reopen the updated entry.');
    return res.json({token,entry:publicEntry({...r,publication:draft},req.params.kind)});
  }
  const set={};
  if(action==='save'||action==='approve') set.draft=draftFields(req.body.draft);
  if(action==='approve') set.status='approved';
  if(action==='decline') {
    const reason=req.body.reason;
    if(typeof reason!=='string'||!reason.trim()||reason.length>2000) fail(400,'Enter a short reason for the contributor.');
    Object.assign(set,{status:'declined',declineReason:reason.trim(),declineMail:{state:'queued',due:new Date()}});
  }
  if(action==='publish') {
    if(typeof req.body.token!=='string'|| !r.previewHash || digest(req.body.token).toString('hex')!==r.previewHash) fail(409,'Preview this draft first.');
    filter.previewHash=r.previewHash;
    Object.assign(set,{status:'published',publication:draft,publishedAt:new Date()});
  }
  const changed=await req.items.updateOne(filter,{$set:set,$inc:{editorVersion:1},$unset:{previewHash:''}});
  if(!changed.matchedCount) fail(409,'Another edit was saved. Reopen this entry.');
  res.json({ok:true});
  if(action==='decline') sendDecisions().catch(report);
}));
// Reserved for future revision and correction links.
function report(err){console.error('Oil editorial desk',err.code||err.name);}
let busy=false;
async function sendDecisions(){
  if(busy||mongoose.connection.readyState!==1) return;
  busy=true;
  try{
    for(const kind of kinds){
      const c=database().collection(kind);
      const filter={status:'declined','declineMail.state':'queued','declineMail.due':{$lte:new Date()}};
      const r=await c.findOne(filter,{projection:{manuscript:0}});
      if(!r)continue;
      const lock=crypto.randomUUID();
      if(!(await c.updateOne({...filter,_id:r._id},{$set:{'declineMail.lock':lock,'declineMail.due':new Date(Date.now()+300000)}})).modifiedCount)continue;
      const claim={_id:r._id,'declineMail.lock':lock};
      try{
        const smtp=mail.createTransport({host:'smtp.resend.com',port:465,secure:true,auth:{user:'resend',pass:process.env.OIL_ARTICLE_RESEND_KEY},connectionTimeout:10000,socketTimeout:20000});
        const result=await smtp.sendMail({from:'Oil & Gas Editorial <receipts@updates.oilandgas.eu.com>',to:{address:r.authors?.[0]?.email||r.email},
          headers:{'Resend-Idempotency-Key':'decision-'+r.reference},subject:'Editorial decision · '+r.reference,
          text:['Thank you for your submission. The editorial team has decided to decline it.',r.title,r.reference,r.declineReason,'Oil & Gas Editorial Team'].join('\n\n')});
        if(!result.accepted.length)throw Error('Delivery declined');
        await c.updateOne(claim,{$set:{'declineMail.state':'sent'}});
      }catch(err){report(err);await c.updateOne(claim,{$set:{'declineMail.due':new Date(Date.now()+900000)}});}
    }
  }finally{busy=false;}
}
setInterval(()=>sendDecisions().catch(report),60000).unref();
router.use((err,req,res,next)=>{report(err);res.status(err.status||503).json({error:err.status?err.message:'The desk is temporarily unavailable.'});});
module.exports=router;
