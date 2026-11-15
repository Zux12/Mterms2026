'use strict';
const express = require('express');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// IMPORTANT: mount AFTER the existing Editor's Desk session authentication middleware.
const router = express.Router();
const members = () => mongoose.connection.useDb('oilandgas', {useCache:true}).collection('members');
const allowedEmail = value => typeof value === 'string' && value.length <= 180 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const validMemberId = value => allowedEmail(value) && value === value.toLowerCase();

router.use((req,res,next) => {
  res.set('Cache-Control','no-store, private');
  next();
});

router.get('/pending', async (req,res,next) => {
  try {
    const rows=await members().find({status:'pending'},{
      projection:{_id:0,name:1,email:1,organisation:1,role:1,country:1,
        interest:1,appliedAt:1,status:1}
    }).sort({appliedAt:1}).limit(100).toArray();
    res.json({items:rows});
  } catch(err) {next(err);}
});

function welcomeMessage(record) {
  const name=String(record.name || 'Member').replace(/[\r\n]/g,' ').slice(0,120);
  const interest=String(record.interest||'').replace(/[\r\n]/g,' ').slice(0,100);
  return [
    'Dear '+name+',',
    'Congratulations! Your membership application has been approved.',
    'We are pleased to welcome you as a member of the Oil & Gas Community, an international platform connecting engineers, researchers, academics, and industry professionals.',
    'As a member, you are invited to:',
    '- Explore technical publications, research papers, and industry articles.',
    '- Contribute your technical knowledge, research and professional experiences.',
    '- Discover industry insights and developments.',
    '- Engage with a growing community of professionals and researchers.',
    interest ? 'We look forward to your contributions, particularly in '+interest+'.' : 'We look forward to your contributions.',
    'Visit our community: https://oilandgas.eu.com',
    'Thank you for joining us.',
    'Warm regards,',
    'Oil & Gas Community Team',
    'https://oilandgas.eu.com',
    'Connecting Knowledge. Advancing the Industry.'
  ].join('\n\n');
}

function configured() {
  return typeof process.env.OIL_ARTICLE_RESEND_KEY==='string' &&
    process.env.OIL_ARTICLE_RESEND_KEY.length>5;
}

let sending = false;
async function deliverQueued() {
  if(sending || mongoose.connection.readyState!==1 || !configured()) return;
  sending=true;
  try {
    const db=members();
    for(let i=0;i<10;i++) {
      const now=new Date();
      const lock=crypto.randomUUID();
      const row=await db.findOneAndUpdate({
        status:'approved',
        'welcomeMail.state':{$in:['queued','retry']},
        'welcomeMail.nextAttemptAt':{$lte:now},
        'welcomeMail.attempts':{$lt:5}
      },{$set:{'welcomeMail.state':'sending','welcomeMail.lock':lock,
        'welcomeMail.startedAt':now},$inc:{'welcomeMail.attempts':1}},
      {sort:{approvedAt:1},returnDocument:'after'});
      if(!row) break;
      const match={_id:row._id,'welcomeMail.state':'sending','welcomeMail.lock':lock};
      try {
        const transport=nodemailer.createTransport({
          host:'smtp.resend.com',port:465,secure:true,
          auth:{user:'resend',pass:process.env.OIL_ARTICLE_RESEND_KEY},
          connectionTimeout:10000,socketTimeout:20000
        });
        const sent=await transport.sendMail({
          from:'Oil & Gas Community <receipts@updates.oilandgas.eu.com>',
          to:row.email,
          subject:'Welcome to Oil & Gas Community — Membership Approved',
          text:welcomeMessage(row),
          headers:{'Resend-Idempotency-Key':'oilgas-welcome-'+crypto.createHash('sha256').update(row._id).digest('hex')}
        });
        if(!sent.accepted?.includes(row.email)) throw Error('SMTP did not accept recipient');
        await db.updateOne(match,{$set:{'welcomeMail.state':'sent',
          'welcomeMail.acceptedAt':new Date(),'welcomeMail.messageId':String(sent.messageId||'').slice(0,250)},
          $unset:{'welcomeMail.lock':'','welcomeMail.nextAttemptAt':'','welcomeMail.lastError':''}});
      } catch(err) {
        const attempts=Number(row.welcomeMail?.attempts||1);
        const exhausted=attempts>=5;
        await db.updateOne(match,{$set:{
          'welcomeMail.state':exhausted?'failed':'retry',
          'welcomeMail.nextAttemptAt':new Date(Date.now()+Math.min(3600000,300000*attempts)),
          'welcomeMail.lastError':String(err?.code||err?.message||'SMTP failure').slice(0,120)
        },$unset:{'welcomeMail.lock':''}});
        console.warn('Oil & Gas membership email retry',row._id,err?.code||err?.name);
      }
    }
  } catch(err) {
    console.error('Oil & Gas membership delivery worker',err?.code||err?.name);
  } finally { sending=false; }
}

router.post('/approve', async (req,res,next) => {
  try {
    const email=req.body?.email;
    if(!validMemberId(email)) return res.status(400).json({error:'Invalid member email.'});
    const now=new Date();
    const result=await members().findOneAndUpdate({_id:email,status:'pending',consent:true},
      {$set:{status:'approved',approvedAt:now,welcomeMail:{
        state:'queued',attempts:0,queuedAt:now,nextAttemptAt:now
      }}},{returnDocument:'after'});
    if(!result) {
      const existing=await members().findOne({_id:email},{projection:{status:1,'welcomeMail.state':1}});
      if(!existing) return res.status(404).json({error:'Membership application not found.'});
      if(existing.status==='approved') return res.status(409).json({error:'Member already approved. No duplicate email queued.',
        status:existing.status,welcomeState:existing.welcomeMail?.state||'not_queued'});
      return res.status(409).json({error:'Only pending, consented applications can be approved.'});
    }
    res.json({ok:true,status:'approved',welcomeState:'queued',
      message:'Approved. Welcome email queued; delivery is tracked separately.'});
    // Only the explicit approval initiates a welcome email. No historical member backfill.
    setImmediate(()=>deliverQueued().catch(()=>{}));
  } catch(err) {next(err);}
});

// Read-only private history of membership mail state recorded by the application.
// "sent" means SMTP accepted; inbox delivery requires the provider's delivery event.
router.get('/history',async(req,res,next)=>{
  try{
    const page=Number(req.query.page||0);
    const kind=req.query.kind||'all';
    const q=typeof req.query.q==='string'?req.query.q.trim():'';
    if(!Number.isSafeInteger(page)||page<0||page>100000 ||
       !['all','welcome','receipt'].includes(kind)||q.length>120){
      return res.status(400).json({error:'Invalid history filters.'});
    }
    const tracked=kind==='welcome'?{'welcomeMail.state':{$exists:true}}:
      kind==='receipt'?{'receiptMail.state':{$exists:true}}:
      {$or:[{'welcomeMail.state':{$exists:true}},{'receiptMail.state':{$exists:true}}]};
    const match=kind==='all'?tracked:{...tracked};
    if(q){
      const literal=q.replace(/[.*+?^${}()|[\]\\]/g,'\\router.get('/delivery/:email',async(req,res,next)=>{');
      const search={$or:[{name:{$regex:literal,$options:'i'}},
        {email:{$regex:literal,$options:'i'}},
        {organisation:{$regex:literal,$options:'i'}}]};
      if(match.$or) match.$and=[search];
      else Object.assign(match,search);
    }
    const projection={_id:0,name:1,email:1,organisation:1,status:1,
      approvedAt:1,appliedAt:1,
      'welcomeMail.state':1,'welcomeMail.queuedAt':1,
      'welcomeMail.acceptedAt':1,'welcomeMail.startedAt':1,
      'welcomeMail.attempts':1,'welcomeMail.lastError':1,
      'welcomeMail.nextAttemptAt':1,'welcomeMail.messageId':1,
      'receiptMail.state':1,'receiptMail.queuedAt':1,
      'receiptMail.acceptedAt':1,'receiptMail.attempts':1,
      'receiptMail.lastError':1,'receiptMail.nextAttemptAt':1,
      'receiptMail.messageId':1};
    const limit=20;
    const collection=members();
    const [rows,total]=await Promise.all([
      collection.find(match,{projection}).sort({approvedAt:-1,appliedAt:-1,_id:1})
        .skip(page*limit).limit(limit).toArray(),
      collection.countDocuments(match)
    ]);
    res.json({items:rows,page,limit,total,more:(page+1)*limit<total,
      meaning:'Sent = Resend SMTP accepted the email. Inbox delivery is not independently verified by this record.'});
  }catch(err){next(err);}
});

router.get('/delivery/:email',async(req,res,next)=>{
  try {
    const email=req.params.email;
    if(!validMemberId(email)) return res.status(400).json({error:'Invalid email.'});
    const row=await members().findOne({_id:email},{projection:{
      name:1,status:1,approvedAt:1,welcomeMail:1
    }});
    if(!row) return res.sendStatus(404);
    res.json({name:row.name,status:row.status,
      welcomeState:row.welcomeMail?.state || 'not_queued',
      acceptedAt:row.welcomeMail?.acceptedAt||null,
      attempts:row.welcomeMail?.attempts||0,
      lastError:row.welcomeMail?.lastError||null});
  }catch(err){next(err);}
});

// Retry transient SMTP failures. No retroactive emails to older approved members.
setInterval(()=>deliverQueued().catch(()=>{}),60000).unref();

module.exports=router;
