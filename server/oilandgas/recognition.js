'use strict';
// Weekly Research Recognition: email is deliberately NOT connected.
const express=require('express');
const mongoose=require('mongoose');
const crypto=require('crypto');
const policy=require('./recognition-policy');
const selector=require('./recognition-selector');
const fullText=require('./recognition-evidence');
const adminAlert=require('./recognition-admin-alert');
const deterministic=require('./recognition-rules');
const sourceVerifier=require('./recognition-source');
const integrityMonitor=require('./recognition-integrity');
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
 abstract:String(p.abstract||''),abstractSourceVerified:p.abstractSourceVerified===true,
 verifiedAuthors:Array.isArray(p.verifiedAuthors)?p.verifiedAuthors.slice(0,150):[],
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
 // Diagnostic evidence for admin review. Does not alter the established scoring.
 // Each field records the exact matched text, never an invented research claim.
 const match=regex=>{const found=regex.exec(txt);return found?found[0]:null;};
 const signals={
  relevance:match(words.relevance),technical:match(words.method),
  practical:match(words.application),evidence:p.source?'original-source-url-present':null,
  originality:match(words.novelty),timeliness:match(words.impact)
 };
 const explanations=Object.entries(found).map(([criterion,points])=>({
  criterion,points,signal:signals[criterion],
  limitation:criterion==='evidence'?'A publication link is not independent verification of research quality.':
   criterion==='originality'?'A novelty keyword is not proof of original scientific contribution.':
   'A textual match is a topical indicator, not validation of the underlying claim.'
 }));
 return {total,breakdown:found,signals,explanations,
  rubricVersion:'provisional-keyword-v1',inputCharacters:txt.length,
  mode:'rule-based-provisional',
  note:'Textual screening score only. Do not use as evidence of technical merit or award eligibility until abstract comparability and integrity checks are complete.'};
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
   {projection:{reference:1,publicationId:1,publication:1,source:1,publishedAt:1,authors:1,byline:1,integrityStatus:1,retractionStatus:1}}).toArray();
  out.push(...rows.map(r=>entry(r,kind)).filter(p=>policy.publicationEligibility(p).eligible));
 }
 return out;
}
async function shortlist(){
 const existing=await db().collection('recognition_selections').find({status:{$in:['active','archived','withdrawn']}},
  {projection:{reference:1,kind:1,publicationId:1,source:1}}).toArray();
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
 const ranked=all.filter(p=>!existing.some(e=>e.kind===p.kind &&
  (e.reference===p.reference || (e.publicationId&&p.publicationId&&e.publicationId===p.publicationId) ||
  (selector.sourceIdentity(p.source)&&selector.sourceIdentity(p.source)===selector.sourceIdentity(e.source)))))
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
function reviewRevision(p){
 return crypto.createHash('sha256').update(JSON.stringify({
  reference:p.reference,publicationId:p.publicationId,
  title:p.title,summary:p.summary,abstract:p.abstract,
  abstractSourceVerified:p.abstractSourceVerified,verifiedAuthors:p.verifiedAuthors,source:p.source
 })).digest('hex');
}
async function reviewedShortlist(){
 const all=await candidates();
 const history=await db().collection('recognition_selections')
  .find({status:{$in:['active','archived','withdrawn']}},{projection:{reference:1,kind:1,publicationId:1,source:1,start:1,byline:1}}).toArray();
 const refs=all.map(p=>p.reference);
 const reviews=await db().collection('recognition_rule_reviews').find({reference:{$in:refs}}).toArray();
 const byRef=new Map(reviews.map(r=>[r.reference,r]));
 return selector.choose(all.map(p=>{
  const r=byRef.get(p.reference),assessment=deterministic.abstractAssessment(p);
  const recent=!!r?.checkedAt&&new Date(r.checkedAt).getTime()>Date.now()-7*86400000;
  return {...p,assessment,reviewStatus:r?.status,
   bibliographyVerified:recent&&r?.bibliographyVerified===true,
   integrityCleared:recent&&r?.integrityCleared===true,
   reviewRevisionMatches:!!r&&r.revision===reviewRevision(p)};
 }),history,new Date(),{verifiedOnly:true});
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
 status:s.status,assessment:s.score?{total:s.score.total,breakdown:s.score.breakdown,
  rubricVersion:s.score.version||s.score.rubricVersion||'',reasons:s.score.reasons||null}:null,
 withdrawnAt:s.withdrawnAt||null,withdrawalReason:s.status==='withdrawn'?String(s.withdrawalReason||''):null,
 certificateStatus:'not-issued',emailStatus:'disabled'};}
publicRouter.use((req,res,next)=>{const origin=req.get('Origin');
 if(['https://oilandgas.eu.com','https://www.oilandgas.eu.com'].includes(origin)){res.set('Access-Control-Allow-Origin',origin);res.vary('Origin');}
 res.set('Cache-Control','public,max-age=120');next();});
publicRouter.get('/current',async(req,res,next)=>{try{
 const now=new Date();const items=await db().collection('recognition_selections')
 .find({status:'active',start:{$lte:now},end:{$gt:now}}).sort({category:1}).limit(3).toArray();
 res.json({programme:'WRRP-001',programmeActive:process.env.OIL_RECOGNITION_RULES_READY==='true'&&process.env.OIL_RECOGNITION_ACTIVATION_ENABLED==='true'&&process.env.OIL_RECOGNITION_AUTO==='true',emailEnabled:false,items:items.map(publicRecord)});
}catch(e){next(e);}});
publicRouter.get('/archive',async(req,res,next)=>{try{
 const page=Number(req.query.page||0);
 if(!Number.isSafeInteger(page)||page<0||page>1000)return res.status(400).json({error:'Invalid page'});
 const category=typeof req.query.category==='string'?req.query.category:'';
 const q=typeof req.query.q==='string'?req.query.q.trim():'';
 if(q.length>100||(category&&!categories.some(c=>c.key===category)))return res.status(400).json({error:'Invalid archive filter'});
 const match={status:{$in:['active','archived','withdrawn']}};
 if(category)match.category=category;
 if(q){const literal=q.replace(/[^a-zA-Z0-9À-ž\s-]/g,'');
  if(literal)match.$or=['title','byline','topic','label'].map(k=>({[k]:{$regex:literal,$options:'i'}}));}
 const [count,items]=await Promise.all([
  db().collection('recognition_selections').countDocuments(match),
  db().collection('recognition_selections').find(match).sort({start:-1,_id:1}).skip(page*12).limit(12).toArray()
 ]);
 res.json({total:count,page,items:items.map(publicRecord)});
}catch(e){next(e);}});
publicRouter.get('/record/:id',async(req,res,next)=>{try{
 const id=String(req.params.id||'');
 if(!/^\d{4}-\d{2}-\d{2}:(editors-pick|industry-impact|emerging-research)$/.test(id))
  return res.sendStatus(404);
 const record=await db().collection('recognition_selections').findOne({_id:id});
 if(!record||!['active','archived','withdrawn'].includes(record.status))return res.sendStatus(404);
 res.set('Cache-Control','public,max-age=60').json(publicRecord(record));
}catch(e){next(e);}});
publicRouter.get('/verify/:id',async(req,res,next)=>{try{
 if(!/^OG-WRS-[A-Z0-9-]{8,64}$/.test(req.params.id))return res.sendStatus(404);
 const row=await db().collection('recognition_certificates').findOne({_id:req.params.id});
 if(!row)return res.sendStatus(404);
 res.json({id:row._id,status:row.status,author:row.authorName,title:row.title,category:row.category,label:row.label,start:row.start,end:row.end,issuedAt:row.issuedAt||null,note:row.note});
}catch(e){next(e);}});
// A unique opaque link identifies a recognition letter recipient without exposing email.
// GET events mean a link was requested (including possible automated link scanners).
// POST events are recorded only after the verified letter has rendered in a browser.
const TRACKING_TOKEN_RE=/^[a-f0-9]{64}$/i;
const tokenDigest=token=>crypto.createHash('sha256').update(token).digest('hex');
function letterNoStore(req,res,next){
 res.set({'Cache-Control':'no-store, private','Referrer-Policy':'no-referrer',
  'X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'});
 next();
}
publicRouter.get('/letter-link/:token',letterNoStore,async(req,res,next)=>{try{
 const token=req.params.token||'';
 if(!TRACKING_TOKEN_RE.test(token))return res.sendStatus(404);
 const key=tokenDigest(token);
 const links=db().collection('recognition_letter_links');
 const found=await links.findOne({_id:key,status:'enabled'});
 if(!found)return res.sendStatus(404);
 const cert=await db().collection('recognition_certificates').findOne({_id:found.letterId,status:'valid'});
 if(!cert)return res.sendStatus(404);
 // Do not infer a human email open from a GET. Email security tools may prefetch links.
 const now=new Date();
 await links.updateOne({_id:key,status:'enabled'},{$inc:{linkRequests:1},
  $set:{lastLinkRequestAt:now},$min:{firstLinkRequestAt:now}});
 const target=new URL('https://oilandgas.eu.com/letter.html');
 target.searchParams.set('id',cert._id);
 target.searchParams.set('visit',token);
 return res.redirect(302,target.href);
}catch(e){next(e);}});
publicRouter.options('/letter-view',(req,res)=>{
 const origin=req.get('Origin');
 if(!['https://oilandgas.eu.com','https://www.oilandgas.eu.com'].includes(origin))
  return res.sendStatus(403);
 res.set({'Access-Control-Allow-Origin':origin,
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Access-Control-Allow-Headers':'Content-Type',
  'Access-Control-Max-Age':'300','Vary':'Origin'});
 return res.sendStatus(204);
});
publicRouter.post('/letter-view',letterNoStore,express.json({limit:'2kb'}),async(req,res,next)=>{try{
 const token=typeof req.body?.token==='string'?req.body.token:'';
 const letterId=typeof req.body?.letterId==='string'?req.body.letterId:'';
 if(!TRACKING_TOKEN_RE.test(token)||!/^OG-WRS-[A-Z0-9-]{8,64}$/.test(letterId))
  return res.status(400).json({recorded:false});
 const key=tokenDigest(token);
 const link=await db().collection('recognition_letter_links').findOne({_id:key,letterId,status:'enabled'});
 if(!link)return res.status(404).json({recorded:false});
 const valid=await db().collection('recognition_certificates').findOne({_id:letterId,status:'valid'});
 if(!valid)return res.status(404).json({recorded:false});
 const now=new Date();
 await db().collection('recognition_letter_links').updateOne({_id:key,status:'enabled'},
  {$inc:{letterLoads:1},$set:{lastLetterLoadAt:now},$min:{firstLetterLoadAt:now}});
 res.json({recorded:true,meaning:'Letter page loaded; this does not prove the recipient personally viewed it.'});
}catch(e){next(e);}});
adminRouter.use(express.json({limit:'20kb'}));
async function recognitionPaused(){
 const controls=await db().collection('recognition_controls').findOne({_id:'programme'});
 return controls?.paused===true;
}
adminRouter.post('/pause',async(req,res,next)=>{try{
 if(req.body?.confirm!=='PAUSE_RECOGNITION')
  return res.status(400).json({error:'Explicit pause confirmation required.'});
 const reason=String(req.body?.reason||'').trim();
 if(reason.length<5||reason.length>300)
  return res.status(400).json({error:'Provide a pause reason (5–300 characters).'});
 const now=new Date();
 await db().collection('recognition_controls').updateOne({_id:'programme'},
  {$set:{paused:true,reason,pausedAt:now}},{upsert:true});
 await db().collection('recognition_audit').insertOne({action:'programme-paused',
  reason,createdAt:now,emailEnabled:false});
 res.json({ok:true,paused:true,emailEnabled:false});
}catch(e){next(e);}});
adminRouter.post('/resume',async(req,res,next)=>{try{
 if(req.body?.confirm!=='RESUME_RECOGNITION')
  return res.status(400).json({error:'Explicit resume confirmation required.'});
 const now=new Date();
 await db().collection('recognition_controls').updateOne({_id:'programme'},
  {$set:{paused:false,resumedAt:now}},{upsert:true});
 await db().collection('recognition_audit').insertOne({action:'programme-resumed',
  createdAt:now,emailEnabled:false});
 res.json({ok:true,paused:false,emailEnabled:false});
}catch(e){next(e);}});
adminRouter.get('/status',async(req,res,next)=>{try{
 const paused=await recognitionPaused();
 const now=new Date();const active=await db().collection('recognition_selections')
 .find({status:'active',end:{$gt:now}}).sort({category:1}).toArray();
 res.json({programme:'WRRP-001',schedulerEnabled:process.env.OIL_RECOGNITION_AUTO==='true',
  emailEnabled:false,certificateIssuanceEnabled:true,activationEnabled:process.env.OIL_RECOGNITION_ACTIVATION_ENABLED==='true',
  adminAlertEnabled:process.env.OIL_RECOGNITION_ADMIN_ALERTS_ENABLED==='true',
  adminRecipient:'m.zurix@oilandgas.eu.com',
  smtpConfigured:!!process.env.OIL_RECOGNITION_SMTP_PASSWORD,
  rulesEngineReady:process.env.OIL_RECOGNITION_RULES_READY==='true',paused,
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
adminRouter.get('/preview-reviewed',async(req,res,next)=>{try{
 const items=await reviewedShortlist();
 res.set('Cache-Control','no-store').json({
  programme:'WRRP-001',mode:'deterministic-abstract-reviewed-only',emailEnabled:false,
  activationEnabled:false,items,
  warning:'Rule-based scoring is textual editorial screening; independent publication integrity confirmation is required.'
 });
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

// Automatic editorial screening is deliberately narrower than scientific
// integrity certification: requires matching Crossref title/abstract, a recent
// known-retraction lookup, and no explicit Crossref retraction notice.
async function autoScreenSourceVerifiedCandidates({max=5}={}){
 const papers=await candidates();
 const eligible=papers.map(p=>({...p,assessment:deterministic.abstractAssessment(p)}))
  .filter(p=>p.assessment.eligibleForEditorialReview&&p.assessment.total>=75);
 const reviewed=await db().collection('recognition_rule_reviews')
  .find({reference:{$in:eligible.map(p=>p.reference)}}).toArray();
 const byRef=new Map(reviewed.map(x=>[x.reference,x])),now=new Date();
 const stale=new Date(now.getTime()-7*86400000);
 const todo=eligible.filter(p=>{
  const r=byRef.get(p.reference);
  return !(r?.status==='approved'&&r.revision===reviewRevision(p)&&
   r.checkedAt&&new Date(r.checkedAt)>stale)&&
   (!r?.autoAttemptedAt||new Date(r.autoAttemptedAt)<stale);
 }).slice(0,Math.min(10,Math.max(1,max)));
 let approved=0;
 for(const paper of todo){
  const source=await sourceVerifier.crossrefAbstract(paper);
  const notice=await integrityMonitor.inspect(paper);
  const norm=s=>deterministic.normalize(s).toLowerCase();
  const same=source.status==='verified'&&norm(source.abstract)===norm(paper.abstract);
  const valid=same&&notice.state==='no-explicit-notice-found';
  const status=valid?'approved':'pending-source-or-integrity-review';
  await db().collection('recognition_rule_reviews').updateOne({_id:paper.reference},
   {$set:{reference:paper.reference,revision:reviewRevision(paper),status,
    bibliographyVerified:valid,integrityCleared:valid,
    integrityCheckScope:'Crossref matching metadata and no explicit indexed retraction notice; not independent scientific validation',
    evidenceUrl:notice.evidenceUrl||source.source||null,
    checkedAt:new Date(),autoAttemptedAt:new Date(),
    assessmentVersion:deterministic.VERSION,approvalMode:valid?'automatic-source-screen':'pending'}},
   {upsert:true});
  if(valid){
   approved++;
   await db().collection('recognition_audit').insertOne({
    action:'automatic-known-notice-screen-passed',reference:paper.reference,
    evidenceUrl:notice.evidenceUrl,createdAt:new Date(),emailEnabled:false,
    limitation:'No indexed retraction notice is not an independent guarantee of research integrity.'});
  }
 }
 return {checked:todo.length,approved,emailEnabled:false};
}
// Friday 09:00 MYT locks the NEXT Monday's proposed winners (72 hours ahead).
// Drafts use only cleared reviews; the rule-only assessment migration must be
// completed before the production activation flags can be enabled.
// Bounded, restart-safe original abstract discovery. Nothing qualifies merely
// because metadata is present: a complete Crossref abstract must pass the source gate.
async function discoverSourceAbstracts({max=5,force=false}={}){
 const now=new Date(),retryCutoff=new Date(now.getTime()-7*86400000);
 const rows=await db().collection('publications')
  .find({status:'published',publication:{$exists:true},
   $or:[{'publication.abstract':{$exists:false}},
    {'publication.abstractSourceVerified':{$ne:true}}]},
   {projection:{reference:1,source:1,publication:1,publicationId:1,integrityStatus:1,publishedAt:1}})
  .limit(10000).toArray();
 const attempts=await db().collection('recognition_abstract_discovery').find({
  _id:{$in:rows.map(x=>x.reference)}},{projection:{_id:1,attemptedAt:1}}).toArray();
 const recent=new Map(attempts.map(x=>[x._id,x.attemptedAt]));
 const targets=rows.filter(x=>force||!recent.has(x.reference)||
  new Date(recent.get(x.reference))<retryCutoff).slice(0,Math.min(Math.max(1,max),10));
 const outcomes=[];
 for(const row of targets){
  const paper=entry(row,'publications'),result=await sourceVerifier.crossrefAbstract(paper);
  await db().collection('recognition_abstract_discovery').updateOne({_id:row.reference},
   {$set:{attemptedAt:new Date(),status:result.status}}, {upsert:true});
  if(result.status==='verified'){
   const write=await db().collection('publications').updateOne({
    _id:row._id,status:'published','publication.title':row.publication.title,
    source:row.source,'publication.abstractSourceVerified':{$ne:true}},
    {$set:{'publication.abstract':result.abstract,'publication.abstractSourceVerified':true,
     'publication.abstractMetadataSource':result.source,
   'publication.verifiedAuthors':result.verifiedAuthors,
     'publication.abstractVerificationMethod':'crossref-title-match',
     'publication.abstractVerifiedAt':new Date()}});
   if(write.modifiedCount){
    await db().collection('recognition_rule_reviews').updateOne({_id:row.reference},
     {$set:{status:'stale-reassessment-required',updatedAt:new Date()}});
    await db().collection('recognition_audit').insertOne({action:'automatic-doi-abstract-verified',
     reference:row.reference,source:result.source,createdAt:new Date(),emailEnabled:false});
   }
  }
  outcomes.push({reference:row.reference,status:result.status});
 }
 return {attempted:outcomes.length,verified:outcomes.filter(x=>x.status==='verified').length,
  results:outcomes,source:'Crossref',recognitionIssued:false,emailEnabled:false};
}
adminRouter.post('/rules/discover-batch',async(req,res,next)=>{try{
 if(req.body?.confirm!=='DISCOVER_NO_AWARDS')
  return res.status(400).json({error:'Explicit abstract-only discovery confirmation required.'});
 const results=await discoverSourceAbstracts({max:Math.min(10,Math.max(1,Number(req.body?.limit)||5))});
 res.set('Cache-Control','private,no-store').json(results);
}catch(e){next(e);}});
async function prepareFridayPreview(start){
 const date=new Date(start),id=date.toISOString().slice(0,10);
 const rows=await reviewedShortlist();
 const plans=categories.map(cat=>{
  const choice=rows.find(r=>r.category===cat.key);
  const p=choice?.candidate;
  const qualified=!!p&&policy.publicationEligibility(p).eligible&&
   p.assessment?.total>=policy.thresholdFor(cat.key);
  return {category:cat.key,label:cat.label,candidate:qualified?{
   kind:p.kind,reference:p.reference,publicationId:p.publicationId||null,
   title:p.title,byline:p.byline,summary:p.summary,topic:p.topic,source:p.source,
   verifiedAuthors:p.verifiedAuthors,
   score:p.assessment
  }:null};
 });
 const now=new Date(),record={_id:id,start:date,previewAt:adminAlert.previewAt(date),
  preparedAt:now,status:'prepared',items:plans,
  missing:plans.filter(x=>!x.candidate).map(x=>x.category),emailStatus:'not-configured'};
 await db().collection('recognition_previews').updateOne({_id:id},{$setOnInsert:record},{upsert:true});
 return db().collection('recognition_previews').findOne({_id:id});
}
// Friday email is a distinct, admin-only notification. Never linked to author
// notification settings. Only sends when a recipient and explicit alert flag exist.
async function sendFridayAdminAlert(preview){
 const to=String(process.env.OIL_RECOGNITION_ADMIN_EMAIL||'m.zurix@oilandgas.eu.com').trim();
 if(process.env.OIL_RECOGNITION_ADMIN_ALERTS_ENABLED!=='true')return {state:'disabled'};
 if(!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(to))return {state:'unconfigured-recipient'};
 // Hostinger mailbox password stays in the hosting environment, never in Git.
 const user=String(process.env.OIL_RECOGNITION_SMTP_USER||'m.zurix@oilandgas.eu.com').trim();
 const password=process.env.OIL_RECOGNITION_SMTP_PASSWORD;
 if(!password||user!==to)return {state:'unconfigured-smtp'};
 const current=await db().collection('recognition_previews').findOneAndUpdate(
  {_id:preview._id,emailStatus:{$in:['not-configured','retry','disabled']}},
  {$set:{emailStatus:'sending',emailClaimedAt:new Date()}},{returnDocument:'after'});
 if(!current)return {state:'already-claimed'};
 try{
  const mailer=require('nodemailer');
  const port=Number(process.env.OIL_RECOGNITION_SMTP_PORT||465);
  if(![465,587].includes(port))throw Error('Invalid Hostinger SMTP port configuration');
  const transport=mailer.createTransport({host:'smtp.hostinger.com',port,secure:port===465,
   requireTLS:port===587,auth:{user,pass:password},
   connectionTimeout:10000,socketTimeout:20000});
  const body=adminAlert.mailContents({start:preview.start,
   items:preview.items.map(row=>({...row,candidate:row.candidate?{
    ...row.candidate,assessment:row.candidate.score}:null}))});
  const sent=await transport.sendMail({
   from:{name:'Oil & Gas Research Recognition',address:user},
   to,subject:body.subject,html:body.html,text:body.text,
   headers:{'Resend-Idempotency-Key':'wrrp-admin-preview-'+preview._id}
  });
  if(!sent.accepted?.length)throw Error('Admin email not accepted');
  await db().collection('recognition_previews').updateOne({_id:preview._id,emailStatus:'sending'},
   {$set:{emailStatus:'sent',emailSentAt:new Date()}});
  return {state:'sent'};
 }catch(e){
  await db().collection('recognition_previews').updateOne({_id:preview._id,emailStatus:'sending'},
   {$set:{emailStatus:'retry',emailErrorAt:new Date()}});
  throw e;
 }
}
// Explicitly requested one-off administrative SMTP test, independent of recognition
// scheduling. Authenticated Editor's Desk only; no author notifications or awards.
// Global cooldown uses a single MongoDB record so repeated clicks cannot mail-spam.
adminRouter.post('/admin-email/test',async(req,res,next)=>{try{
 if(req.body?.confirm!=='SEND_ADMIN_SMTP_TEST')
  return res.status(400).json({error:'Explicit test confirmation required.'});
 const user=String(process.env.OIL_RECOGNITION_SMTP_USER||'m.zurix@oilandgas.eu.com').trim();
 const recipient='m.zurix@oilandgas.eu.com';
 const password=process.env.OIL_RECOGNITION_SMTP_PASSWORD;
 if(!password||user!==recipient)return res.status(409).json({
  error:'Hostinger SMTP mailbox username/password have not been configured.',
  emailSent:false,authorEmailsEnabled:false});
 const port=Number(process.env.OIL_RECOGNITION_SMTP_PORT||465);
 if(![465,587].includes(port))return res.status(409).json({error:'Invalid configured SMTP port.'});
 const attemptId=crypto.randomUUID(),now=new Date(),cutoff=new Date(now.getTime()-10*60000);
 const claims=db().collection('recognition_admin_test_email');
 await claims.updateOne({_id:'single-recipient'},{$setOnInsert:{createdAt:now}},{upsert:true});
 const claim=await claims.findOneAndUpdate({_id:'single-recipient',
  $or:[{lastAttemptAt:{$exists:false}},{lastAttemptAt:{$lte:cutoff}}]},
  {$set:{lastAttemptAt:now,lastAttemptId:attemptId,status:'attempted'}},
  {returnDocument:'after'});
 if(!claim)return res.status(429).json({error:'A test has already been attempted in the past 10 minutes; avoid duplicate messages.'});
 const smtp=require('nodemailer').createTransport({host:'smtp.hostinger.com',
  port,secure:port===465,requireTLS:port===587,
  auth:{user,pass:password},connectionTimeout:10000,socketTimeout:20000});
 const body=adminAlert.mailContents({start:adminAlert.plannedStart(now),items:categories.map(cat=>({
  category:cat.key,candidate:null
 }))});
 const html=body.html.replace('PRIVATE EDITORIAL NOTICE • FRIDAY PREVIEW',
  'SMTP TEST ONLY • NO REAL WINNERS');
 const textBody='SMTP TEST ONLY — no research has been selected.\n'+
  'This verifies the Hostinger administrator email transport. No author emails or recognition were issued.\n\n'+body.text;
 try{
  await smtp.verify();
  const result=await smtp.sendMail({from:{name:'Oil & Gas Research Recognition',address:user},
   to:recipient,subject:'[SMTP TEST — NO AWARDS] Oil & Gas WRRP Administrator Email',
   html,text:textBody,
   headers:{'X-OilAndGas-Test':'recognition-admin-smtp'}});
  if(!result.accepted?.includes(recipient))throw Error('SMTP did not accept administrator recipient');
  await claims.updateOne({_id:'single-recipient',lastAttemptId:attemptId},
   {$set:{status:'smtp-accepted',acceptedAt:new Date(),lastError:null}});
  await db().collection('recognition_audit').insertOne({action:'admin-email-test-smtp-accepted',
   createdAt:new Date(),emailEnabled:false,adminRecipient:recipient});
  res.json({ok:true,status:'smtp-accepted',recipient,
   note:'Hostinger SMTP accepted the message. Inbox delivery still requires recipient confirmation.',
   authorEmailsEnabled:false,recognitionActivated:false});
 }catch(error){
  await claims.updateOne({_id:'single-recipient',lastAttemptId:attemptId},
   {$set:{status:'failed',failedAt:new Date(),lastErrorCode:String(error.code||'smtp-error').slice(0,50)}});
  res.status(503).json({ok:false,status:'failed',error:
   'Hostinger SMTP test failed. Check mailbox credential, SMTP connectivity and server logs. No author email was sent.'});
 }
}catch(error){next(error);}});
adminRouter.get('/friday-preview',async(req,res,next)=>{try{
 const start=adminAlert.plannedStart();
 const id=start.toISOString().slice(0,10);
 const preview=await db().collection('recognition_previews').findOne({_id:id});
 res.set('Cache-Control','no-store').json({nextPublication:start.toISOString(),
  previewScheduledAt:adminAlert.previewAt(start).toISOString(),
  status:preview?.status||'not-prepared',missing:preview?.missing||[],
  emailStatus:preview?.emailStatus||'not-configured',adminAlertEnabled:
  process.env.OIL_RECOGNITION_ADMIN_ALERTS_ENABLED==='true',
  adminRecipientConfigured:/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(String(process.env.OIL_RECOGNITION_ADMIN_EMAIL||'m.zurix@oilandgas.eu.com')),
  items:preview?.items||[],authorEmailsEnabled:false});
}catch(e){next(e);}});
adminRouter.get('/friday-preview/email-html',async(req,res,next)=>{try{
 // Read-only HTML preview, never dispatches an email.
 const start=adminAlert.plannedStart();
 const preview=await db().collection('recognition_previews').findOne({_id:start.toISOString().slice(0,10)});
 const data=preview?preview.items.map(row=>({...row,candidate:row.candidate?{
  ...row.candidate,assessment:row.candidate.score}:null})):categories.map(cat=>({
  category:cat.key,candidate:null
 }));
 res.set('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'");
 res.set('Cache-Control','private, no-store').type('html').send(
  adminAlert.mailContents({start,items:data}).html);
}catch(e){next(e);}});
async function activateCycle(){
 if(await recognitionPaused())throw Object.assign(new Error('Recognition paused by administrator.'),{status:423});
 const start=weekStart(),end=new Date(start.getTime()+7*86400000);
 const cycleId=start.toISOString().slice(0,10);
 const selections=db().collection('recognition_selections');
 const previous=await db().collection('recognition_cycles').findOne({_id:cycleId,status:'active'});
 if(previous)return {ok:true,alreadyActive:true,cycleId};
 const saved=await db().collection('recognition_previews').findOne({_id:cycleId,status:'prepared'});
 if(!saved||new Date(saved.preparedAt)>start)
  throw Object.assign(new Error('Friday preview missing. Recognition cannot publish without a 72-hour-ahead draft.'),{status:409});
 // Revalidate the EXACT Friday shortlist at publication, not a newly ranked
 // Monday shortlist; new papers must wait until the following cycle.
 const all=await candidates();
 const approvedReviews=await db().collection('recognition_rule_reviews').find({
  reference:{$in:saved.items.filter(x=>x.candidate).map(x=>x.candidate.reference)}}).toArray();
 const byRef=new Map(all.map(p=>[p.reference,p]));
 const byReview=new Map(approvedReviews.map(r=>[r.reference,r]));
 const history=await db().collection('recognition_selections').find({status:{$in:['active','archived','withdrawn']}},
  {projection:{reference:1,publicationId:1,source:1,kind:1}}).toArray();
 const proposed=saved.items.map(row=>{
  const frozen=row.candidate;
  const current=frozen&&byRef.get(frozen.reference),r=current&&byReview.get(current.reference);
  const revisionMatches=!!r&&r.revision===reviewRevision(current);
  const qualified=!!current&&!!frozen&&revisionMatches&&
   selector.eligibleReview({...current,assessment:deterministic.abstractAssessment(current),
    bibliographyVerified:r.checkedAt&&new Date(r.checkedAt)>new Date(Date.now()-7*86400000)&&r.bibliographyVerified,
    integrityCleared:r.checkedAt&&new Date(r.checkedAt)>new Date(Date.now()-7*86400000)&&r.integrityCleared,
    reviewStatus:r.status,reviewRevisionMatches:true})&&
   current.publicationId===frozen.publicationId&&
   selector.sourceIdentity(current.source)===selector.sourceIdentity(frozen.source)&&
   !selector.paperCooldown(current,history)&&
   policy.publicationEligibility(current).eligible&&
   deterministic.abstractAssessment(current).total>=policy.thresholdFor(row.category);
  return {category:row.category,label:row.label,candidate:qualified?{
   ...current,assessment:deterministic.abstractAssessment(current)}:null};
 });
 const keys=proposed.filter(x=>x.candidate).map(x=>x.candidate.kind+':'+x.candidate.reference);
 if(new Set(keys).size!==keys.length)
  throw Object.assign(new Error('Duplicate recognized publication in weekly cycle'),{status:409});
 const session=await mongoose.connection.startSession();
 try{
  await session.withTransaction(async()=>{
   if(await db().collection('recognition_cycles').findOne({_id:cycleId},{session}))
    throw Object.assign(new Error('Weekly cycle already exists; review before retrying.'),{status:409});
   const now=new Date();
   await db().collection('recognition_cycles').insertOne({_id:cycleId,start,end,status:'active',
    selectionMode:'rules-abstract-v2-approved',emailsEnabled:false,createdAt:now},{session});
   await selections.updateMany({status:'active',end:{$lte:now}},{$set:{status:'archived',archivedAt:now}},{session});
   const awardable=proposed.filter(row=>row.candidate);
   if(awardable.length)await selections.insertMany(awardable.map(row=>{
    const p=row.candidate;
    return {_id:cycleId+':'+row.category,cycleId,category:row.category,label:row.label,
     kind:p.kind,reference:p.reference,publicationId:p.publicationId,
     title:p.title,summary:p.summary,byline:p.byline,topic:p.topic,source:p.source,
     verifiedAuthors:p.verifiedAuthors||[],
     start,end,status:'active',score:p.assessment,createdAt:now,emailStatus:'disabled'};
   }),{session});
   // Issue independent A4 letter records only for Crossref-confirmed coauthors
   // whose complete names appear exactly in the published byline. Do not guess
   // unclear identities; the editor may verify and issue those separately.
   const letters=[];
   for(const row of awardable){
    const p=row.candidate,seen=new Set();
    for(const raw of (Array.isArray(p.verifiedAuthors)?p.verifiedAuthors:[]).slice(0,150)){
     const authorName=String(raw||'').trim(),authorKey=normalizeName(authorName);
     if(!authorKey||seen.has(authorKey)||!policy.verifiedBylineAuthor(p,authorName))continue;
     seen.add(authorKey);
     letters.push({_id:'OG-WRS-'+crypto.randomBytes(12).toString('hex').toUpperCase(),
      selectionId:cycleId+':'+row.category,authorKey,authorName,
      title:p.title,category:row.category,label:row.label,start,end,
      issuedAt:now,status:'valid',note:'Individual editorial research recognition; no author email sent',
      issuanceMode:'verified-publisher-coauthor-automatic'});
    }
   }
   if(letters.length)await db().collection('recognition_certificates').insertMany(letters,{session});
   await db().collection('recognition_audit').insertOne({action:'weekly-activation',cycleId,
    awarded:proposed.filter(x=>x.candidate).length,unfilled:proposed.filter(x=>!x.candidate).map(x=>x.category),
    lettersIssued:letters.length,
    createdAt:now,emailEnabled:false},{session});
  });
 }finally{await session.endSession();}
 return {ok:true,cycleId,activated:proposed.filter(x=>x.candidate).length,
  unfilled:proposed.filter(x=>!x.candidate).map(x=>x.category),emailEnabled:false};
}
adminRouter.post('/activate',async(req,res,next)=>{try{
 if(process.env.OIL_RECOGNITION_RULES_READY!=='true'||process.env.OIL_RECOGNITION_ACTIVATION_ENABLED!=='true')
  return res.status(423).json({error:'Activation locked while research evaluation and deployment tests are incomplete.'});
 if(req.body?.confirm!=='ACTIVATE_NO_EMAIL')return res.status(400).json({error:'Explicit activation confirmation required.'});
 res.json(await activateCycle());
}catch(e){next(e);}});
adminRouter.get('/history',async(req,res,next)=>{try{
 const items=await db().collection('recognition_selections').find({}).sort({start:-1}).limit(60).toArray();
 res.json({items:items.map(publicRecord)});
}catch(e){next(e);}});
// AI metadata assessment is read-only and invoked by an authenticated editor.
// It cannot activate selections, issue certificates, modify database records or email authors.
// Published research enters the consideration pool automatically; no separate award
// application is required. This queue is read-only and does not itself score or award.
// Editor-triggered Crossref ingestion does not pick winners, clear integrity or email authors.
// It only makes complete verifiable DOI abstracts available to the deterministic scorer.
adminRouter.post('/rules/import-abstract',async(req,res,next)=>{try{
 const reference=String(req.body?.reference||'').trim();
 if(!/^OG-P-[A-F0-9]{16}$/.test(reference))return res.status(400).json({error:'Valid publication reference required.'});
 const collection=db().collection('publications');
 const row=await collection.findOne({reference,status:'published',publication:{$exists:true}});
 if(!row)return res.status(404).json({error:'Published publication not found.'});
 const p=entry(row,'publications');
 const result=await sourceVerifier.crossrefAbstract(p);
 if(result.status!=='verified')return res.status(409).json({state:result.status,
  note:'The original abstract could not be independently retrieved and verified. The paper remains pending.'});
 const revisedAt=new Date();
 const update=await collection.updateOne({_id:row._id,status:'published',
  'publication.title':row.publication.title,source:row.source},
  {$set:{'publication.abstract':result.abstract,'publication.abstractSourceVerified':true,
   'publication.abstractMetadataSource':result.source,
   'publication.verifiedAuthors':result.verifiedAuthors,
   'publication.abstractVerifiedAt':revisedAt}});
 if(!update.modifiedCount)return res.status(409).json({error:'Publication changed during abstract verification.'});
 await db().collection('recognition_rule_reviews').updateOne({_id:reference},
  {$set:{status:'stale-reassessment-required',updatedAt:revisedAt}});
 await db().collection('recognition_audit').insertOne({action:'doi-abstract-import',
  reference,metadataSource:result.source,createdAt:revisedAt,emailEnabled:false});
 res.json({ok:true,state:'original-abstract-verified',
  words:deterministic.abstractAssessment({...p,abstract:result.abstract,abstractSourceVerified:true}).evidence.abstractWords,
  selectionActivated:false,emailsSent:false});
}catch(e){next(e);}});
// Editor can enter an original publisher/repository abstract if Crossref omits it.
// Requires positive source attribution; never accepts a directory teaser as evidence.
adminRouter.post('/rules/verify-abstract',async(req,res,next)=>{try{
 const reference=String(req.body?.reference||'').trim();
 const abstract=String(req.body?.abstract||'').trim();
 const evidenceUrl=String(req.body?.evidenceUrl||'').trim();
 if(!/^OG-P-[A-F0-9]{16}$/.test(reference)||!policy.validHttpsUrl(evidenceUrl)||
  abstract.length>16000||req.body?.confirm!=='ORIGINAL_ABSTRACT_VERIFIED')
  return res.status(400).json({error:'Reference, valid public HTTPS original abstract URL and explicit source verification confirmation required.'});
 const col=db().collection('publications');
 const row=await col.findOne({reference,status:'published',publication:{$exists:true}});
 if(!row)return res.status(404).json({error:'Published paper not found.'});
 const p=entry(row,'publications');
 const assessment=deterministic.abstractAssessment({...p,abstract,abstractSourceVerified:true});
 if(!assessment.eligibleForEditorialReview)return res.status(422).json({
  error:'Insufficient original abstract or publication evidence.',issues:assessment.evidence.issues});
 const changed=await col.updateOne({_id:row._id,status:'published',
  'publication.title':row.publication.title,source:row.source},
  {$set:{'publication.abstract':abstract,'publication.abstractSourceVerified':true,
   'publication.abstractMetadataSource':evidenceUrl,
   'publication.abstractVerificationMethod':'documented-editorial-source-check',
   'publication.abstractVerifiedAt':new Date()}});
 if(!changed.modifiedCount)return res.status(409).json({error:'Paper was modified during verification.'});
 await db().collection('recognition_rule_reviews').updateOne({_id:reference},
  {$set:{status:'stale-reassessment-required',updatedAt:new Date()}});
 await db().collection('recognition_audit').insertOne({action:'manual-source-abstract-verified',
  reference,evidenceUrl,createdAt:new Date(),emailEnabled:false});
 res.json({ok:true,source:'editor-verified-original-abstract',score:assessment.total,
  emailsSent:false,recognitionIssued:false});
}catch(e){next(e);}});
adminRouter.post('/rules/approve',async(req,res,next)=>{try{
 const reference=String(req.body?.reference||'').trim();
 const evidenceUrl=String(req.body?.integrityEvidenceUrl||'').trim();
 const rationale=String(req.body?.rationale||'').trim();
 if(!/^OG-P-[A-F0-9]{16}$/.test(reference)||!policy.validHttpsUrl(evidenceUrl)||
  rationale.length<30||rationale.length>1200||req.body?.confirm!=='SOURCE_INTEGRITY_CHECKED')
  return res.status(400).json({error:'Reference, HTTPS integrity evidence, detailed rationale (30–1200 characters), and confirmation required.'});
 const row=await db().collection('publications').findOne({reference,status:'published',publication:{$exists:true}});
 if(!row)return res.status(404).json({error:'Published research not found.'});
 const p=entry(row,'publications'),assessment=deterministic.abstractAssessment(p);
 if(!policy.publicationEligibility(p).eligible||!assessment.eligibleForEditorialReview)
  return res.status(422).json({error:'Original abstract and publication details are not sufficiently source verified.',issues:assessment.evidence.issues});
 const history=await db().collection('recognition_selections').find({},{
  projection:{reference:1,publicationId:1,source:1,kind:1}}).toArray();
 if(selector.paperCooldown(p,history))return res.status(409).json({error:'This publication has already received a recognition.'});
 const now=new Date();
 await db().collection('recognition_rule_reviews').updateOne({_id:reference},
 {$set:{reference,revision:reviewRevision(p),status:'approved',bibliographyVerified:true,
  integrityCleared:true,integrityEvidenceUrl:evidenceUrl,integrityRationale:rationale,
  assessmentVersion:deterministic.VERSION,approvedAt:now,checkedAt:now}}, {upsert:true});
 await db().collection('recognition_audit').insertOne({action:'rules-paper-integrity-approved',
  reference,rationale,integrityEvidenceUrl:evidenceUrl,createdAt:now,emailEnabled:false});
 res.json({ok:true,score:assessment.total,version:deterministic.VERSION,
  shortlistedOnly:true,authorEmailsEnabled:false});
}catch(e){next(e);}});
adminRouter.get('/rules-scorecard',async(req,res,next)=>{try{
 const all=await candidates();
 const history=await db().collection('recognition_selections').find({},{
  projection:{reference:1,publicationId:1,source:1,kind:1}}).toArray();
 const items=all.map(p=>({reference:p.reference,title:p.title,byline:p.byline,
  assessment:deterministic.abstractAssessment(p),
  previouslyRecognized:selector.paperCooldown(p,history)}));
 res.set('Cache-Control','private,no-store').json({rubricVersion:deterministic.VERSION,
  items,total:items.length,pending:items.filter(x=>!x.assessment.eligibleForEditorialReview).length,
  authorEmailsEnabled:false,simulationOnly:true});
}catch(e){next(e);}});
adminRouter.get('/candidate-queue',async(req,res,next)=>{try{
 const published=await candidates();
 const refs=published.map(p=>p.reference);
 const [evidence,reviews,history]=await Promise.all([
  db().collection('recognition_evidence').find({reference:{$in:refs}},{projection:{reference:1,revision:1,status:1}}).toArray(),
  db().collection('recognition_rule_reviews').find({reference:{$in:refs}},{projection:{reference:1,revision:1,status:1}}).toArray(),
  db().collection('recognition_selections').find({}, {projection:{reference:1,publicationId:1,source:1,kind:1}}).toArray()
 ]);
 const evidMap=new Map(evidence.map(x=>[x.reference,x])),
       reviewMap=new Map(reviews.map(x=>[x.reference,x]));
 const items=published.map(p=>{
  const prior=selector.paperCooldown(p,history);
  const rev=reviewRevision(p),e=evidMap.get(p.reference),r=reviewMap.get(p.reference);
  const assessment=deterministic.abstractAssessment(p);
  const status=prior?'recognized-once':!assessment.eligibleForEditorialReview?'abstract-or-source-pending':
   !r||r.revision!==rev?'source-integrity-review-needed':r.status==='approved'?'ready-for-shortlist':
   'source-integrity-review-needed';
  return {reference:p.reference,title:p.title,publishedAt:p.publishedAt,status,
   publicationId:p.publicationId,score:assessment.total,issues:assessment.evidence.issues};
 });
 res.set('Cache-Control','private,no-store').json({items,total:items.length,
  emailEnabled:false,manualAwardApplicationRequired:false});
}catch(err){next(err);}});
adminRouter.post('/evidence',async(req,res,next)=>{try{
 const reference=String(req.body?.reference||'').trim();
 if(!/^OG-P-[A-F0-9]{16}$/.test(reference))return res.status(400).json({error:'Invalid reference.'});
 const row=await db().collection('publications').findOne({
  reference,status:'published',publication:{$exists:true}
 },{projection:{reference:1,publication:1,source:1,publicationId:1,publishedAt:1,integrityStatus:1,retractionStatus:1}});
 if(!row)return res.status(404).json({error:'Published publication not found.'});
 const p=entry(row,'publications');
 const eligibility=policy.publicationEligibility(p);
 if(!eligibility.eligible)return res.status(422).json({error:'Publication is ineligible.',reasons:eligibility.reasons});
 const evidence=fullText.validatePacket(req.body);
 if(!evidence.valid)return res.status(400).json({error:'Complete all source-verified evidence fields.',issues:evidence.issues});
 const revision=reviewRevision(p),now=new Date();
 // Revision-bound evidence makes every subsequent publication edit invalidate its
 // eligibility. Old AI reviews cannot survive an updated research paper.
 await db().collection('recognition_evidence').updateOne({_id:reference},{
  $set:{reference,revision,packet:evidence.packet,status:'verified',verifiedAt:now}
 },{upsert:true});
 await db().collection('recognition_reviews').updateOne({_id:reference},{$set:{
  status:'stale-reassessment-required',updatedAt:now}});
 await db().collection('recognition_audit').insertOne({
  action:'research-evidence-recorded',reference,createdAt:now,emailEnabled:false});
 res.json({ok:true,state:'evidence-recorded',assessmentRequired:true,
  recognitionActivated:false,emailEnabled:false});
}catch(err){next(err);}});
adminRouter.post('/review-paper',async(req,res,next)=>{try{
 const reference=String(req.body?.reference||'').trim();
 if(!/^OG-P-[A-F0-9]{16}$/.test(reference))return res.status(400).json({error:'Invalid paper reference'});
 const record=await db().collection('publications').findOne({
  reference,status:'published',publication:{$exists:true}
 },{projection:{reference:1,publication:1,source:1,publishedAt:1,publicationId:1,integrityStatus:1,retractionStatus:1}});
 if(!record)return res.status(404).json({error:'Published paper not found'});
 const paper=entry(record,'publications'),eligibility=policy.publicationEligibility(paper);
 if(!eligibility.eligible)return res.status(422).json({error:'Paper ineligible',reasons:eligibility.reasons});
 const revision=reviewRevision(paper);
 const evidence=await db().collection('recognition_evidence').findOne({_id:reference,revision,status:'verified'});
 if(!fullText.availableEvidence(evidence,revision))
  return res.status(409).json({error:'Source-verified full-paper methodology, findings, limitations and practical implications are required before AI assessment.',state:'evidence_required'});
 const result=await require('./recognition-review').review(paper,{fullPaperPacket:evidence.packet});
 if(result.state==='reviewed'){
  // Existing revision is computed before AI assessment to bind evidence to the same record.
  await db().collection('recognition_reviews').updateOne({_id:paper.reference},{
   $set:{reference:paper.reference,publicationId:paper.publicationId,
    revision,assessment:result.assessment,
    metadata:{state:result.metadata?.state,doi:result.metadata?.doi,
     title:result.metadata?.title,metadataUrl:result.metadata?.metadataUrl},
    model:result.model,status:'pending-editorial-and-integrity-review',reviewedAt:new Date(),
    emailEnabled:false}
  },{upsert:true});
  result.savedAsDraftReview=true;
 }
 res.set('Cache-Control','no-store').json(result);
}catch(e){console.error('WRRP editorial evidence review',e.code||e.name);
 res.status(503).json({error:'Independent evidence review unavailable. No score was awarded or recognition activated.',emailEnabled:false});
}});
// Editorial approval records an explicit external integrity review.
// Approval NEVER activates a week or sends email.
adminRouter.post('/review-approve',async(req,res,next)=>{try{
 const reference=String(req.body?.reference||'').trim();
 const evidenceUrl=String(req.body?.evidenceUrl||'').trim();
 const rationale=String(req.body?.rationale||'').trim();
 const confirmation=req.body?.confirmation;
 if(!/^OG-P-[A-F0-9]{16}$/.test(reference)||!policy.validHttpsUrl(evidenceUrl)||
  rationale.length<30||rationale.length>1200||confirmation!=='INTEGRITY_CHECKED')
  return res.status(400).json({error:'Provide a valid reference, public HTTPS evidence URL, detailed rationale (30–1200 characters), and explicit integrity-check confirmation.'});
 const record=await db().collection('publications').findOne({reference,status:'published',publication:{$exists:true}},
  {projection:{reference:1,publicationId:1,publication:1,source:1,publishedAt:1,integrityStatus:1,retractionStatus:1}});
 if(!record)return res.status(404).json({error:'Published research record unavailable'});
 const paper=entry(record,'publications');
 if(!policy.publicationEligibility(paper).eligible)return res.status(422).json({error:'Publication does not satisfy research eligibility checks.'});
 const review=await db().collection('recognition_reviews').findOne({_id:reference});
 if(!review||review.status==='approved')return res.status(409).json({error:'A pending, unapproved AI evidence review is required.'});
 if(review.revision!==reviewRevision(paper)||review.metadata?.state!=='found'||
  !review.assessment?.evidence?.bibliographyVerified||
  review.assessment?.mode!=='ai-full-paper-evidence-assessment'||
  review.assessment?.fullPaperEvidenceReviewed!==true)
  return res.status(409).json({error:'Bibliographic verification missing or publication has changed; repeat the evidence review.'});
 if(review.assessment.total<75)return res.status(409).json({error:'Assessment below minimum recognition threshold.'});
 const now=new Date();
 const approved={...review.assessment,evidence:{...review.assessment.evidence,
  integrityCleared:true,integrityEvidenceUrl:evidenceUrl,
  integrityCheckedAt:now,integrityCheckMethod:'documented-editorial-review'},
  readyForRecognition:true,decision:'approved-for-automatic-shortlist'};
 const changed=await db().collection('recognition_reviews').updateOne({
  _id:reference,revision:review.revision,status:'pending-editorial-and-integrity-review'
 },{$set:{assessment:approved,status:'approved',approvedAt:now,
  approvalEvidenceUrl:evidenceUrl,approvalRationale:rationale}});
 if(!changed.modifiedCount)return res.status(409).json({error:'Review changed during approval. Refresh.'});
 await db().collection('recognition_audit').insertOne({
  action:'research-review-approved',reference,evidenceUrl,rationale,createdAt:now,
  result:'shortlist-eligible-only',emailEnabled:false});
 res.json({ok:true,status:'approved',recognitionActivated:false,emailEnabled:false});
}catch(e){next(e);}});
adminRouter.get('/reviews',async(req,res,next)=>{try{
 const items=await db().collection('recognition_reviews').find({},
  {projection:{reference:1,assessment:1,metadata:1,status:1,reviewedAt:1,model:1}})
  .sort({reviewedAt:-1}).limit(30).toArray();
 res.set('Cache-Control','no-store').json({emailEnabled:false,items});
}catch(e){next(e);}});
adminRouter.get('/scorecard',async(req,res)=>res.json({programme:'WRRP-001',mode:'rule-based-provisional',
 maxScore:MAX_SCORE,weights:{relevance:25,technical:20,practical:20,evidence:15,originality:10,timeliness:10},
 warning:'This provisional text matching engine is not yet an AI technical-quality evaluation. Review before full production activation.'}));
let schedulerBusy=false;
// Conservative automated retraction response: only explicit authoritative
// Crossref retraction notices cause withdrawal. No notice never means "cleared".
async function checkIntegrityNotices(){
 const now=new Date(),cutoff=new Date(now.getTime()-24*3600000);
 const selections=await db().collection('recognition_selections')
  .find({status:{$in:['active','archived']}},{projection:{_id:1,title:1,reference:1,source:1}}).toArray();
 const records=await db().collection('recognition_integrity_checks')
  .find({_id:{$in:selections.map(x=>x._id)}},{projection:{_id:1,checkedAt:1}}).toArray();
 const checked=new Map(records.map(x=>[x._id,x]));
 const todo=selections.filter(x=>!checked.has(x._id)||new Date(checked.get(x._id).checkedAt)<cutoff)
  .slice(0,3);
 for(const paper of todo){
  const result=await integrityMonitor.inspect(paper);
  await db().collection('recognition_integrity_checks').updateOne({_id:paper._id},
   {$set:{checkedAt:new Date(),result:result.state,evidenceUrl:result.evidenceUrl||null}},{upsert:true});
  if(result.state!=='explicit-retraction')continue;
  const reason='Confirmed Crossref retraction notice; see '+result.evidenceUrl;
  const session=await mongoose.connection.startSession();
  try{
   await session.withTransaction(async()=>{
    const changed=await db().collection('recognition_selections').updateOne({
     _id:paper._id,status:{$in:['active','archived']}},
     {$set:{status:'withdrawn',withdrawnAt:new Date(),withdrawalReason:reason,
      integrityEvidenceUrl:result.evidenceUrl,automaticRetractionNotice:true}},{session});
    if(!changed.modifiedCount)return;
    await db().collection('recognition_certificates').updateMany({selectionId:paper._id},
     {$set:{status:'withdrawn',withdrawnAt:new Date()}},{session});
    await db().collection('recognition_audit').insertOne({action:'verified-crossref-retraction-withdrawal',
     selectionId:paper._id,evidenceUrl:result.evidenceUrl,createdAt:new Date(),emailEnabled:false},{session});
    await db().collection('recognition_integrity_alerts').updateOne({_id:paper._id},
     {$setOnInsert:{title:paper.title,evidenceUrl:result.evidenceUrl,
      status:'pending',createdAt:new Date()}},{upsert:true,session});
   });
  }finally{await session.endSession();}
 }
 await sendPendingIntegrityAlerts();
}
async function sendPendingIntegrityAlerts(){
 if(process.env.OIL_RECOGNITION_ADMIN_ALERTS_ENABLED!=='true')return;
 const user=String(process.env.OIL_RECOGNITION_SMTP_USER||'m.zurix@oilandgas.eu.com').trim();
 const password=process.env.OIL_RECOGNITION_SMTP_PASSWORD;
 if(user!=='m.zurix@oilandgas.eu.com'||!password)return;
 const rows=await db().collection('recognition_integrity_alerts').find({status:'pending'}).limit(3).toArray();
 for(const alert of rows){
  const claim=await db().collection('recognition_integrity_alerts').updateOne({_id:alert._id,status:'pending'},
   {$set:{status:'sending',claimedAt:new Date()}});
  if(!claim.modifiedCount)continue;
  try{
   const port=Number(process.env.OIL_RECOGNITION_SMTP_PORT||465);
   if(![465,587].includes(port))throw Error('Invalid SMTP port');
   const smtp=require('nodemailer').createTransport({host:'smtp.hostinger.com',port,
    secure:port===465,requireTLS:port===587,auth:{user,pass:password},
    connectionTimeout:10000,socketTimeout:20000});
   const safe=x=>String(x||'').replace(/[&<>"']/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
   const html='<table role="presentation" style="width:100%;max-width:620px;border-collapse:collapse;font:14px Arial,sans-serif">'+
    '<tr><td style="background:#242c29;color:white;padding:24px;font-size:24px;font-weight:700">oil &amp; gas<span style="color:#f66520">.</span></td></tr>'+
    '<tr><td style="background:#c19a52;padding:13px 24px;font-weight:700">URGENT EDITORIAL INTEGRITY NOTICE</td></tr>'+
    '<tr><td style="padding:24px"><h2 style="color:#9b2925">Research Recognition Withdrawn</h2>'+
    '<p><strong>'+safe(alert.title)+'</strong></p><p>A verified Crossref retraction notice triggered suspension of this recognition and withdrawal of its co-author letters.</p>'+
    '<p>Evidence: <a href="'+safe(alert.evidenceUrl)+'">'+safe(alert.evidenceUrl)+'</a></p>'+
    '<p>Review the recognition record in your Editor’s Desk.</p></td></tr></table>';
   const sent=await smtp.sendMail({from:{name:'Oil & Gas Research Recognition',address:user},
    to:user,subject:'[ACTION REQUIRED] Research recognition withdrawn — '+String(alert._id),
    html,text:'Research recognition withdrawn: '+alert.title+'\nEvidence: '+alert.evidenceUrl,
    headers:{'X-OilAndGas-Integrity-Notice':String(alert._id)}});
   if(!sent.accepted?.includes(user))throw Error('SMTP recipient not accepted');
   await db().collection('recognition_integrity_alerts').updateOne({_id:alert._id,status:'sending'},
    {$set:{status:'sent',sentAt:new Date()}});
  }catch(e){
   await db().collection('recognition_integrity_alerts').updateOne({_id:alert._id,status:'sending'},
    {$set:{status:'pending',lastFailureAt:new Date()}});
   console.error('Recognition integrity alert SMTP failed:',e.code||e.name);
  }
 }
}
adminRouter.get('/integrity-monitor',async(req,res,next)=>{try{
 const checks=await db().collection('recognition_integrity_checks').find({}).sort({checkedAt:-1}).limit(30).toArray();
 const alerts=await db().collection('recognition_integrity_alerts').find({}).sort({createdAt:-1}).limit(30).toArray();
 res.set('Cache-Control','private,no-store').json({checks:checks.map(x=>({
  selectionId:x._id,checkedAt:x.checkedAt,result:x.result,evidenceUrl:x.evidenceUrl})),
  alerts:alerts.map(x=>({selectionId:x._id,status:x.status,title:x.title,createdAt:x.createdAt})),
  note:'Only explicit authoritative Crossref retraction notices cause automatic withdrawal. No notice is not an integrity guarantee.'});
}catch(e){next(e);}});
async function scheduledTick(){
 if(process.env.OIL_RECOGNITION_RULES_READY!=='true'||process.env.OIL_RECOGNITION_ACTIVATION_ENABLED!=='true'||process.env.OIL_RECOGNITION_AUTO!=='true'||schedulerBusy||mongoose.connection.readyState!==1)return;
 schedulerBusy=true;
 try{
  await checkIntegrityNotices();
  if(await recognitionPaused())return;
  await discoverSourceAbstracts({max:5});
  await autoScreenSourceVerifiedCandidates({max:5});
  const now=new Date(),nextStart=adminAlert.plannedStart(now);
  const fridayTime=adminAlert.previewAt(nextStart);
  // Preview preparation starts Friday 09:00 MYT (exactly 72h before Monday 09:00).
  if(now>=fridayTime&&now<nextStart){
   const plan=await prepareFridayPreview(nextStart);
   await sendFridayAdminAlert(plan);
  }
  const start=weekStart(now);
  if(now>=start&&!await db().collection('recognition_cycles').findOne({_id:start.toISOString().slice(0,10)}))
   await activateCycle();
 }catch(err){console.error('Recognition schedule:',err.message);}
 finally{schedulerBusy=false;}
}
// All recognition launch flags default OFF. Only the separate, opt-in
// ADMIN notification channel can send Friday previews; authors remain OFF.
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
// This creates a tracking link for a VALID recognition letter only.
// It does not enqueue or send an email. The token is returned once, never stored in plaintext.
adminRouter.post('/letter-link/create',async(req,res,next)=>{try{
 const letterId=String(req.body?.letterId||'').trim();
 if(!/^OG-WRS-[A-Z0-9-]{8,64}$/.test(letterId))
  return res.status(400).json({error:'Valid recognition letter ID required'});
 const cert=await db().collection('recognition_certificates').findOne({_id:letterId,status:'valid'});
 if(!cert)return res.status(404).json({error:'No valid recognition letter was issued'});
 const token=crypto.randomBytes(32).toString('hex');
 const id=tokenDigest(token),now=new Date();
 await db().collection('recognition_letter_links').insertOne({_id:id,letterId,
  authorName:cert.authorName,selectionId:cert.selectionId,status:'enabled',
  createdAt:now,mode:'unsent-preview',emailStatus:'disabled',
  linkRequests:0,letterLoads:0});
 res.set('Cache-Control','no-store').json({ok:true,
  url:'https://mterm2026-559f9bf571b5.herokuapp.com/api/oilandgas/recognition/letter-link/'+token,
  warning:'Private preview link only. No email has been sent. Share only with the intended recipient.'});
}catch(e){next(e);}});
adminRouter.get('/letter-tracking',async(req,res,next)=>{try{
 const rows=await db().collection('recognition_letter_links').find({},
  {projection:{_id:0,letterId:1,authorName:1,selectionId:1,status:1,
   createdAt:1,mode:1,emailStatus:1,linkRequests:1,letterLoads:1,
   firstLinkRequestAt:1,lastLinkRequestAt:1,firstLetterLoadAt:1,lastLetterLoadAt:1}})
  .sort({createdAt:-1}).limit(100).toArray();
 res.set('Cache-Control','private, no-store').json({emailEnabled:false,items:rows,
  interpretation:'Link requested may be an email security scanner. Letter page loaded is not proof of human reading; neither establishes email open or download.'});
}catch(e){next(e);}});
adminRouter.get('/notifications',async(req,res)=>res.json({emailEnabled:false,mode:'placeholder',
 message:'No emails will be queued or sent. Notification system awaits acceptance testing and explicit approval.',
 queued:0,sent:0}));
module.exports={publicRouter,adminRouter,weekStart,scorePaper};
