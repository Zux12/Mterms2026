'use strict';
// Weekly Research Recognition: email is deliberately NOT connected.
const express=require('express');
const mongoose=require('mongoose');
const crypto=require('crypto');
const policy=require('./recognition-policy');
const publicRouter=express.Router();
const adminRouter=express.Router();
const db=()=>mongoose.connection.useDb('oilandgas',{useCache:true}).db;
const categories=[
 {key:'editors-pick',label:"Editor's Pick of the Week"},
 {key:'industry-impact',label:'Industry Impact Spotlight'},
 {key:'emerging-research',label:'Emerging Research Spotlight'}
];
const MAX_SCORE=100;
const words={
 relevance:/oil|gas|petrol|hydrocarbon|refiner|pipeline|drill|offshore|lng|process|energy|carbon|emission|corrosion|meter|instrument|reservoir|safety/i,
 application:/case study|field|deployment|plant|industrial|operation|implementation|prototype|validation|performance|optimization|reliability|experiment/i,
 method:/method|analysis|model|experiment|data|measurement|evaluation|simulation|comparison|investigation|result/i,
 novelty:/novel|new|innovative|advanced|improved|framework|approach|development|design/i,
 impact:/safety|risk|reliability|efficiency|cost|emission|sustainab|environment|maintenance|integrity|performance/i
};
function entry(row,kind){
 const p=row.publication||{};
 return {kind,reference:row.reference,publicationId:row.publicationId||null,
 title:String(p.title||row.title||''),summary:String(p.summary||p.note||row.note||''),
 byline:String(p.byline||row.byline||(row.authors||[]).map(x=>x.name).join(', ')),
 topic:String(p.topic||row.topic||''),
 source:kind==='publications'&&/^https:\/\//.test(row.source||'')?row.source:'',
 integrityStatus:String(row.integrityStatus||row.retractionStatus||'').toLowerCase(),
 publishedAt:row.publishedAt||null};
}
function scorePaper(p){
 const txt=[p.title,p.summary,p.topic].join(' ');
 // This is a transparent provisional ranking; it is NOT a scientific-quality judgement.
 const found={
  relevance:words.relevance.test(txt)?25:0,
  technical:words.method.test(txt)?20:0,
  practical:words.application.test(txt)?20:0,
  evidence:p.source?15:8,
  originality:words.novelty.test(txt)?10:0,
  timeliness:words.impact.test(txt)?10:0
 };
 const total=Object.values(found).reduce((a,b)=>a+b,0);
 return {total,breakdown:found,mode:'rule-based-provisional',
  note:'Textual discovery score only. Technical merit, novelty and scientific quality require editorial/AI evidence review.'};
}
function weekStart(date=new Date()){
 // Monday 09:00 Malaysia = Monday 01:00 UTC, Malaysia has no daylight-saving adjustment.
 const shifted=new Date(date.getTime()+8*3600000);
 const dow=(shifted.getUTCDay()+6)%7;
 shifted.setUTCHours(9,0,0,0);
 shifted.setUTCDate(shifted.getUTCDate()-dow);
 if(shifted.getTime()-8*3600000>date.getTime())shifted.setUTCDate(shifted.getUTCDate()-7);
 return new Date(shifted.getTime()-8*3600000);
}
function normalizeName(name){return String(name||'').normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');}
function isMY(p){return p.malaysianAffiliationVerified===true;}
async function candidates(){
 const out=[];
 for(const kind of ['publications']){
  const rows=await db().collection(kind).find({status:'published',publication:{$exists:true}},
   {projection:{reference:1,publicationId:1,publication:1,source:1,publishedAt:1,authors:1,byline:1,integrityStatus:1,retractionStatus:1}}).limit(1500).toArray();
  out.push(...rows.map(r=>entry(r,kind)).filter(p=>policy.publicationEligibility(p).eligible));
 }
 return out;
}
async function shortlist(){
 const existing=await db().collection('recognition_selections').find({status:{$in:['active','archived']}},
  {projection:{reference:1,kind:1,start:1}}).sort({start:-1}).limit(1000).toArray();
 const now=weekStart();
 const all=await candidates();
 const authorKeys=[...new Set(all.flatMap(p=>p.byline.split(/[,;]+/).map(normalizeName).filter(Boolean)))];
 const linked=await db().collection('author_admin_details').find({_id:{$in:authorKeys}},
  {projection:{_id:1,affiliation:1}}).toArray();
 const affiliationMap=new Map(linked.map(x=>[x._id,x.affiliation||'']));
 for(const p of all){
  p.malaysianAffiliationVerified=p.byline.split(/[,;]+/).map(normalizeName)
   .some(key=>/\bmalaysia\b|\buniversiti\b|\butm\b|\butp\b|\bukm\b|\bupm\b|\bcyberjaya\b|\bgeomatika\b/i.test(affiliationMap.get(key)||''));
 }
 const ranked=all.filter(p=>!existing.some(e=>e.reference===p.reference&&e.kind===p.kind&&
  new Date(e.start).getTime()>now.getTime()-365*86400000))
 .map(p=>({...p,assessment:scorePaper(p)}))
 .sort((a,b)=>b.assessment.total-a.assessment.total ||
  Number(isMY(b))-Number(isMY(a)) ||
  String(b.publishedAt||'').localeCompare(String(a.publishedAt||'')));
 const used=new Set();
 return categories.map((c,index)=>{
  const options=ranked.filter(p=>!used.has(p.kind+':'+p.reference));
  const chosen=options.find(p=>index===1&&words.application.test(p.title+' '+p.summary))||
   options.find(p=>index===2&&words.novelty.test(p.title+' '+p.summary))||options[0]||null;
  if(chosen)used.add(chosen.kind+':'+chosen.reference);
  return {category:c.key,label:c.label,candidate:chosen};
 });
}
async function applyOverrides(proposed) {
 const overrides=await db().collection('recognition_overrides').find({}).toArray();
 for(const item of proposed){
  const override=overrides.find(o=>o.category===item.category);
  if(!override)continue;
  const record=await db().collection(override.kind).findOne({
   reference:override.reference,status:'published',publication:{$exists:true}});
  if(!record)continue;
  const p=entry(record,override.kind);
  if(!policy.publicationEligibility(p).eligible)continue;
  item.candidate={...p,assessment:{...scorePaper(p),
   overrideReason:override.reason,mode:'admin-override'}};
  item.override={reference:override.reference,reason:override.reason};
 }
 return proposed;
}
function publicRecord(s){return {id:s._id,category:s.category,label:s.label,kind:s.kind,reference:s.reference,
 title:s.title,summary:s.summary,byline:s.byline,topic:s.topic,source:s.source||'',start:s.start,end:s.end,
 status:s.status,certificateStatus:'not-issued',emailStatus:'disabled'};}
publicRouter.use((req,res,next)=>{const origin=req.get('Origin');
 if(['https://oilandgas.eu.com','https://www.oilandgas.eu.com'].includes(origin)){res.set('Access-Control-Allow-Origin',origin);res.vary('Origin');}
 res.set('Cache-Control','public,max-age=120');next();});
publicRouter.get('/current',async(req,res,next)=>{try{
 const now=new Date();const items=await db().collection('recognition_selections')
 .find({status:'active',start:{$lte:now},end:{$gt:now}}).sort({category:1}).limit(3).toArray();
 res.json({programme:'WRRP-001',emailEnabled:false,items:items.map(publicRecord)});
}catch(e){next(e);}});
publicRouter.get('/archive',async(req,res,next)=>{try{
 const page=Number(req.query.page||0);
 if(!Number.isSafeInteger(page)||page<0||page>1000)return res.status(400).json({error:'Invalid page'});
 const category=typeof req.query.category==='string'?req.query.category:'';
 const q=typeof req.query.q==='string'?req.query.q.trim():'';
 if(q.length>100||(category&&!categories.some(c=>c.key===category)))return res.status(400).json({error:'Invalid archive filter'});
 const match={status:{$in:['active','archived']}};
 if(category)match.category=category;
 if(q){const literal=q.replace(/[^a-zA-Z0-9À-ž\s-]/g,'');
  if(literal)match.$or=['title','byline','topic','label'].map(k=>({[k]:{$regex:literal,$options:'i'}}));}
 const [count,items]=await Promise.all([
  db().collection('recognition_selections').countDocuments(match),
  db().collection('recognition_selections').find(match).sort({start:-1,_id:1}).skip(page*12).limit(12).toArray()
 ]);
 res.json({total:count,page,items:items.map(publicRecord)});
}catch(e){next(e);}});
publicRouter.get('/verify/:id',async(req,res,next)=>{try{
 if(!/^OG-WRS-[A-Z0-9-]{8,64}$/.test(req.params.id))return res.sendStatus(404);
 const row=await db().collection('recognition_certificates').findOne({_id:req.params.id});
 if(!row)return res.sendStatus(404);
 res.json({id:row._id,status:row.status,author:row.authorName,title:row.title,category:row.category,label:row.label,start:row.start,end:row.end,issuedAt:row.issuedAt||null,note:row.note});
}catch(e){next(e);}});
adminRouter.use(express.json({limit:'20kb'}));
adminRouter.get('/status',async(req,res,next)=>{try{
 const now=new Date();const active=await db().collection('recognition_selections')
 .find({status:'active',end:{$gt:now}}).sort({category:1}).toArray();
 res.json({programme:'WRRP-001',schedulerEnabled:process.env.OIL_RECOGNITION_AUTO==='true',
  emailEnabled:false,certificateIssuanceEnabled:true,activationEnabled:process.env.OIL_RECOGNITION_ACTIVATION_ENABLED==='true',
  mode:'testing',active:active.map(publicRecord)});
}catch(e){next(e);}});
adminRouter.get('/preview',async(req,res,next)=>{try{
 res.json({scheduledStart:weekStart().toISOString(),emailEnabled:false,
  scoring:'rule-based-provisional',activationEnabled:process.env.OIL_RECOGNITION_ACTIVATION_ENABLED==='true',
  items:(await applyOverrides(await shortlist())).map(x=>({...x,minimumScore:policy.thresholdFor(x.category),
   passesThreshold:!!x.candidate&&x.candidate.assessment.total>=policy.thresholdFor(x.category)}))});
}catch(e){next(e);}});
adminRouter.post('/override',async(req,res,next)=>{try{
 const {category,kind,reference,reason}=req.body||{};
 if(!categories.some(c=>c.key===category)||kind!=='publications'||
 typeof reference!=='string'||!/^OG-[AP]-[A-F0-9]{16}$/.test(reference)||
 typeof reason!=='string'||reason.trim().length<5||reason.length>500)
 return res.status(400).json({error:'Category, published reference and reason are required.'});
 const record=await db().collection(kind).findOne({reference,status:'published',publication:{$exists:true}});
 if(!record)return res.status(404).json({error:'Published paper not found.'});
 const p=entry(record,kind);
 const eligibility=policy.publicationEligibility(p);
 if(!eligibility.eligible)return res.status(422).json({error:'Publication is not eligible: '+eligibility.reasons.join(', ')});
 await db().collection('recognition_overrides').updateOne({_id:category},
 {$set:{category,kind,reference,reason:reason.trim(),updatedAt:new Date(),state:'pending'}},{upsert:true});
 await db().collection('recognition_audit').insertOne({action:'override-staged',category,kind,reference,
 reason:reason.trim(),createdAt:new Date()});
 res.json({ok:true,staged:true,paper:p.title,emailEnabled:false});
}catch(e){next(e);}});
adminRouter.get('/overrides',async(req,res,next)=>{try{
 const items=await db().collection('recognition_overrides').find({}).limit(20).toArray();
 res.json({items});
}catch(e){next(e);}});
adminRouter.post('/override/clear',async(req,res,next)=>{try{
 const category=req.body?.category,reason=req.body?.reason;
 if(!categories.some(c=>c.key===category)||typeof reason!=='string'||reason.trim().length<5)
 return res.status(400).json({error:'Category and reason required'});
 await db().collection('recognition_overrides').deleteOne({_id:category});
 await db().collection('recognition_audit').insertOne({action:'override-cleared',category,reason:reason.trim(),createdAt:new Date()});
 res.json({ok:true});
}catch(e){next(e);}});

async function activateCycle(){
 const start=weekStart(),end=new Date(start.getTime()+7*86400000);
 const cycleId=start.toISOString().slice(0,10);
 const selections=db().collection('recognition_selections');
 const previous=await db().collection('recognition_cycles').findOne({_id:cycleId,status:'active'});
 if(previous)return {ok:true,alreadyActive:true,cycleId};
 const proposed=await applyOverrides(await shortlist());
 const invalid=proposed.filter(row=>!row.candidate||!policy.publicationEligibility(row.candidate).eligible||
  (row.candidate.assessment.total<policy.thresholdFor(row.category)&&row.candidate.assessment.mode!=='admin-override'));
 if(invalid.length)throw Object.assign(new Error('Insufficient eligible, qualified publications: '+invalid.map(x=>x.category).join(', ')),{status:409});
 const keys=proposed.map(x=>x.candidate&&x.candidate.kind+':'+x.candidate.reference);
 if(keys.some(x=>!x)||new Set(keys).size!==3)
  throw Object.assign(new Error('Cannot activate until three distinct, published eligible papers are available.'),{status:409});
 const session=await mongoose.connection.startSession();
 try{
  await session.withTransaction(async()=>{
   if(await db().collection('recognition_cycles').findOne({_id:cycleId},{session}))
    throw Object.assign(new Error('Weekly cycle already exists; review before retrying.'),{status:409});
   const now=new Date();
   await db().collection('recognition_cycles').insertOne({_id:cycleId,start,end,status:'active',
    selectionMode:'provisional-text-ranking',emailsEnabled:false,createdAt:now},{session});
   await selections.updateMany({status:'active',end:{$lte:now}},{$set:{status:'archived',archivedAt:now}},{session});
   await selections.insertMany(proposed.map(row=>{
    const p=row.candidate;
    return {_id:cycleId+':'+row.category,cycleId,category:row.category,label:row.label,
     kind:p.kind,reference:p.reference,publicationId:p.publicationId,
     title:p.title,summary:p.summary,byline:p.byline,topic:p.topic,source:p.source,
     start,end,status:'active',score:p.assessment,createdAt:now,emailStatus:'disabled'};
   }),{session});
   await db().collection('recognition_audit').insertOne({action:'weekly-activation',cycleId,
    createdAt:now,emailEnabled:false},{session});
  });
 }finally{await session.endSession();}
 return {ok:true,cycleId,activated:3,emailEnabled:false};
}
adminRouter.post('/activate',async(req,res,next)=>{try{
 if(process.env.OIL_RECOGNITION_ACTIVATION_ENABLED!=='true')
  return res.status(423).json({error:'Activation locked while research evaluation and deployment tests are incomplete.'});
 if(req.body?.confirm!=='ACTIVATE_NO_EMAIL')return res.status(400).json({error:'Explicit activation confirmation required.'});
 res.json(await activateCycle());
}catch(e){next(e);}});
adminRouter.get('/history',async(req,res,next)=>{try{
 const items=await db().collection('recognition_selections').find({}).sort({start:-1}).limit(60).toArray();
 res.json({items:items.map(publicRecord)});
}catch(e){next(e);}});
adminRouter.get('/scorecard',async(req,res)=>res.json({programme:'WRRP-001',mode:'rule-based-provisional',
 maxScore:MAX_SCORE,weights:{relevance:25,technical:20,practical:20,evidence:15,originality:10,timeliness:10},
 warning:'This provisional text matching engine is not yet an AI technical-quality evaluation. Review before full production activation.'}));
let schedulerBusy=false;
async function scheduledTick(){
 if(process.env.OIL_RECOGNITION_ACTIVATION_ENABLED!=='true'||process.env.OIL_RECOGNITION_AUTO!=='true'||schedulerBusy||mongoose.connection.readyState!==1)return;
 schedulerBusy=true;
 try{const now=new Date(),start=weekStart(now);
  if(now>=start&&!await db().collection('recognition_cycles').findOne({_id:start.toISOString().slice(0,10)}))
   await activateCycle();
 }catch(err){console.error('Recognition schedule:',err.message);}
 finally{schedulerBusy=false;}
}
// Feature flag defaults OFF. This scheduler never sends email.
setInterval(scheduledTick,15*60000).unref();


adminRouter.post('/withdraw',async(req,res,next)=>{try{
 const selectionId=String(req.body?.selectionId||'').trim();
 const reason=String(req.body?.reason||'').trim();
 if(!/^\d{4}-\d\d-\d\d:(editors-pick|industry-impact|emerging-research)$/.test(selectionId)||
  reason.length<10||reason.length>500)
  return res.status(400).json({error:'Select a recognition and provide a withdrawal reason (10–500 characters).'});
 const session=await mongoose.connection.startSession();
 try{
  let result={ok:false};
  await session.withTransaction(async()=>{
   const selections=db().collection('recognition_selections');
   const row=await selections.findOne({_id:selectionId},{session});
   if(!row)throw Object.assign(new Error('Recognition record not found.'),{status:404});
   if(row.status==='withdrawn'){result={ok:true,alreadyWithdrawn:true};return;}
   const now=new Date();
   await selections.updateOne({_id:selectionId,status:{$in:['active','archived']}},
    {$set:{status:'withdrawn',withdrawnAt:now,withdrawalReason:reason}},{session});
   await db().collection('recognition_certificates').updateMany({selectionId},
    {$set:{status:'withdrawn',withdrawnAt:now}},{session});
   await db().collection('recognition_audit').insertOne({
    action:'recognition-withdrawn',selectionId,reason,createdAt:now,
    previousStatus:row.status},{session});
   result={ok:true,withdrawn:true,certificatesRevoked:true,emailEnabled:false};
  });
  res.json(result);
 }finally{await session.endSession();}
}catch(e){next(e);}});
adminRouter.get('/certificates',async(req,res,next)=>{try{
 const rows=await db().collection('recognition_certificates').find({})
 .sort({issuedAt:-1}).limit(100).toArray();
 res.json({items:rows.map(x=>({id:x._id,selectionId:x.selectionId,authorName:x.authorName,
 title:x.title,category:x.category,status:x.status,issuedAt:x.issuedAt}))});
}catch(e){next(e);}});
adminRouter.post('/certificate/issue',async(req,res,next)=>{try{
 const selectionId=String(req.body?.selectionId||'').trim();
 const authorName=String(req.body?.authorName||'').trim();
 if(!/^\d{4}-\d\d-\d\d:(editors-pick|industry-impact|emerging-research)$/.test(selectionId)||
  authorName.length<2||authorName.length>160)
  return res.status(400).json({error:'Choose a valid selection and published co-author name.'});
 const selection=await db().collection('recognition_selections').findOne({_id:selectionId,
  status:{$in:['active','archived']}});
 if(!selection)return res.status(404).json({error:'Recognition selection not found.'});
 const authorKey=normalizeName(authorName);
 if(!policy.verifiedBylineAuthor(selection,authorName))return res.status(400).json({error:'Author must exactly match a published byline entry.'});
 const collection=db().collection('recognition_certificates');
 await collection.createIndex({selectionId:1,authorKey:1},{unique:true});
 const existing=await collection.findOne({selectionId,authorKey});
 if(existing)return res.json({ok:true,alreadyIssued:true,id:existing._id});
 const now=new Date(),id='OG-WRS-'+crypto.randomBytes(12).toString('hex').toUpperCase();
 try{await collection.insertOne({_id:id,selectionId,authorKey,authorName,
  title:selection.title,category:selection.category,label:selection.label,
  start:selection.start,end:selection.end,issuedAt:now,status:'valid',
  note:'Editorial recognition, not an accredited academic award.'});}
 catch(e){if(e.code===11000){const prior=await collection.findOne({selectionId,authorKey});
  return res.json({ok:true,alreadyIssued:true,id:prior._id});}throw e;}
 await db().collection('recognition_audit').insertOne({action:'certificate-issued',
  selectionId,authorName,certificateId:id,createdAt:now});
 res.json({ok:true,id,verificationUrl:'https://oilandgas.eu.com/certificate.html?id='+encodeURIComponent(id),
  emailEnabled:false});
}catch(e){next(e);}});
adminRouter.get('/notifications',async(req,res)=>res.json({emailEnabled:false,mode:'placeholder',
 message:'No emails will be queued or sent. Notification system awaits acceptance testing and explicit approval.',
 queued:0,sent:0}));
module.exports={publicRouter,adminRouter,weekStart,scorePaper};
