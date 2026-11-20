'use strict';
// Dedicated JALAN collections only. No location in request URLs or application logs.
const crypto=require('node:crypto'),P=require('./report-policy');
const {createFlowService,segmentOk}=require('./community-reports-flow');
const publicEvent=e=>({id:e.id,type:e.type,...(segmentOk(e.segment)?{segment:e.segment}:{}),...(e.trafficSeverity?{trafficSeverity:e.trafficSeverity}:{}),position:e.position,heading:e.heading,road:e.road,createdAt:e.createdAt,updatedAt:e.updatedAt,expiresAt:e.expiresAt,contributors:Array.isArray(e.contributors)?e.contributors.length:e.contributors,active:e.active,...(e.type==='traffic'?{status:(Array.isArray(e.contributors)?e.contributors.length:e.contributors)>1?'confirmed':'reported'}:{})});
function createService({repository,secret,now=Date.now,id=()=>crypto.randomUUID()}){
 const hash=value=>crypto.createHmac('sha256',secret).update(value).digest('hex');
 const token=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{20,80}$/.test(value);
 function validate(input){if(!P.types[input?.type]||!P.coord(input.position)||!Number.isFinite(input.accuracy)||input.accuracy<0||input.accuracy>35||!Number.isFinite(input.fixAt)||now()-input.fixAt>10000||input.fixAt-now()>5000||!token(input.actor)||!token(input.submissionId)||!(input.heading===null||P.heading(input.heading))||!(input.road===null||P.road(input.road)))throw Object.assign(Error('A fresh accurate location is required.'),{status:400});}
 async function change(key,fn){for(let attempt=0;attempt<8;attempt++){const record=await repository.get(key),revision=record?.revision??0;const events=(record?.events||[]).filter(e=>P.alive(e,now()));const result=fn(events);if(await repository.cas(key,revision,{events,revision:revision+1,expiresAt:new Date(Math.max(now()+60000,...events.map(e=>e.expiresAt)))}))return result;}throw Object.assign(Error('Please retry your report.'),{status:409});}
 return {
  async submit(input){validate(input);
   if(input.trafficSeverity!==undefined&&(input.type!=='traffic'||!P.trafficLevels.includes(input.trafficSeverity))){
    throw Object.assign(Error('Invalid traffic severity.'),{status:400});
   }
   const actor=hash(input.actor),key=hash(input.type+'|'+(input.road?input.road.key+'|'+input.road.level:'unmatched|'+actor+'|'+input.submissionId));
   return change(key,events=>{let event=events.find(e=>e.submission===hash(input.actor+'|'+input.submissionId)||P.duplicate(e,input));const at=now();
    const newContributor=!event||!event.contributors.includes(actor);
    if(event){if(newContributor){if(event.contributors.length>=200)throw Object.assign(Error('Event contribution limit reached.'),{status:429});event.contributors.push(actor);event.updatedAt=at;event.expiresAt=at+P.types[event.type].minutes*60000;event.clears=[];}}
    else{event={id:key+'.'+id(),submission:hash(input.actor+'|'+input.submissionId),type:input.type,position:input.position,heading:input.heading,road:input.road,createdAt:at,updatedAt:at,expiresAt:at+P.types[input.type].minutes*60000,contributors:[actor],responses:[],clears:[],active:true};if(events.length>=100)throw Object.assign(Error('Too many active events on this road.'),{status:429});events.push(event);}
    // A retry cannot replace a newer assessment from a different contributor.
    if(input.type==='traffic'&&newContributor&&segmentOk(input.segment)&&!event.segment)event.segment=input.segment;
    if(input.trafficSeverity&&(newContributor||!event.trafficSeverity)&&
       input.fixAt>=(event.trafficSeverityAt||0)){
     event.trafficSeverity=input.trafficSeverity;
     event.trafficSeverityAt=input.fixAt;
    }
    return {event:publicEvent(event),merged:event.contributors.length>1};});
  },
  async clearFromFlow(key,segment,cutoff){
   const eligible=e=>e.active&&e.type==='traffic'&&e.segment===segment&&e.updatedAt<cutoff&&P.alive(e,now());
   if(!(await repository.get(key))?.events?.some(eligible))return;
   await change(key,events=>{for(const e of events)if(eligible(e))e.active=false;});
  },
  async nearby(position){if(!P.coord(position))throw Object.assign(Error('Invalid location.'),{status:400});const events=await repository.nearby(position,now());return events.filter(e=>P.alive(e,now())&&P.distance(e.position,position)<=20000).slice(0,200).map(publicEvent);},
  async respond(input){if(!token(input?.actor)||!token(input?.journey)||!['still','cleared'].includes(input?.answer)||typeof input?.id!=='string'||!/^[a-f0-9]{64}\.[a-zA-Z0-9-]{1,80}$/.test(input.id)||!P.coord(input.position)||!P.heading(input.heading)||!P.road(input.road)||!Number.isFinite(input.accuracy)||input.accuracy>35||input.accuracy<0||!Number.isFinite(input.fixAt)||now()-input.fixAt>10000||input.fixAt-now()>5000)throw Object.assign(Error('Invalid confirmation.'),{status:400});
   return change(input.id.split('.')[0],events=>{const e=events.find(e=>e.id===input.id);if(!e)throw Object.assign(Error('Report has expired.'),{status:410});
    if(!P.sameRoad(e.road,input.road)||!P.heading(e.heading)||P.delta(e.heading,input.heading)>40||P.distance(e.position,input.position)>150)throw Object.assign(Error('Confirmation must be near the event on the same road and direction.'),{status:400});
    const actor=hash(input.actor),vote=hash(input.actor+'|'+input.journey);if(e.responses.includes(vote)||(e.type==='traffic'&&input.answer==='still'&&e.contributors.includes(actor)))return {event:publicEvent(e),duplicate:true};
    if(e.responses.length>=300)throw Object.assign(Error('Event response limit reached.'),{status:429});e.responses.push(vote);
    if(input.answer==='still'){if(e.type==='traffic')e.contributors.push(actor);e.updatedAt=now();e.expiresAt=now()+P.types[e.type].minutes*60000;e.clears=[];}
    else if(!e.clears.includes(actor)){e.clears.push(actor);if(e.clears.length>=2)e.active=false;}
    return {event:publicEvent(e),removed:!e.active};});
  }
 };
}
function createRouter({express,mongoose,env=process.env}){
 const router=express.Router(),buckets=new Map(),db=mongoose.connection.useDb('jalan_navigation',{useCache:true});
 const schema=new mongoose.Schema({_id:String,revision:Number,events:[mongoose.Schema.Types.Mixed],expiresAt:Date},{versionKey:false,collection:'community_report_buckets'});schema.index({expiresAt:1},{expireAfterSeconds:0});
 const Model=db.models.CommunityReportBucket||db.model('CommunityReportBucket',schema);
 const repository={get:key=>Model.findById(key).lean(),async cas(key,revision,value){try{const r=await Model.updateOne({_id:key,revision},{$set:value},{upsert:revision===0});return r.modifiedCount===1||r.upsertedCount===1;}catch(e){if(e.code===11000)return false;throw e;}},async nearby(position,at){
  // Filter individual events in Mongo; do not load whole contributor/vote buckets.
  const rows=await Model.aggregate([
   {$match:{expiresAt:{$gt:new Date(at)}}},{$unwind:'$events'},
   {$match:{'events.active':true,'events.expiresAt':{$gt:at},'events.position.0':{$gte:position[0]-.25,$lte:position[0]+.25},'events.position.1':{$gte:position[1]-.2,$lte:position[1]+.2}}},
   {$project:{_id:0,event:{id:'$events.id',type:'$events.type',segment:'$events.segment',trafficSeverity:'$events.trafficSeverity',position:'$events.position',heading:'$events.heading',road:'$events.road',createdAt:'$events.createdAt',updatedAt:'$events.updatedAt',expiresAt:'$events.expiresAt',active:'$events.active',contributors:{$size:'$events.contributors'}}}},{$limit:200}
  ]);return rows.map(r=>r.event);
 }};
 router.use((req,res,next)=>{res.set('Cache-Control','no-store');if(req.query&&Object.keys(req.query).length)return res.status(400).json({error:'Use JSON body; location query parameters are not accepted.'});if(req.get('origin')&&!['https://zux12.github.io','https://mterms2026.com','https://www.mterms2026.com'].includes(req.get('origin')))return res.status(403).json({error:'Origin not allowed.'});next();});
 router.get('/health',(_req,res)=>res.json({ok:true,service:'jalan-community-reports',version:3}));
 router.use(express.json({limit:'12kb'}));
 router.use((req,res,next)=>{const at=Date.now();for(const [key,b]of buckets)if(b.until<=at)buckets.delete(key);const key=req.ip||'unknown',b=buckets.get(key)||{n:0,until:at+60000};if(buckets.size>=10000&&!buckets.has(key))return res.status(429).json({error:'Please try again shortly.'});buckets.set(key,b);if(++b.n>60)return res.status(429).json({error:'Please try again shortly.'});if(!env.JALAN_HASH_SECRET||env.JALAN_HASH_SECRET.length<32)return res.status(503).json({error:'Reporting service is not configured.'});if(Buffer.byteLength(JSON.stringify(req.body||{}))>12000)return res.status(413).json({error:'Report is too large.'});next();});
 const service=()=>createService({repository,secret:env.JALAN_HASH_SECRET});
 const flowSchema=new mongoose.Schema({_id:String,revision:Number,segment:String,region:String,samples:[mongoose.Schema.Types.Mixed],baseline:mongoose.Schema.Types.Mixed,state:mongoose.Schema.Types.Mixed,expiresAt:Date},{versionKey:false,collection:'community_flow_segments'});
 flowSchema.index({expiresAt:1},{expireAfterSeconds:0});flowSchema.index({region:1,'state.expiresAt':1});
 const Flow=db.models.CommunityFlowSegment||db.model('CommunityFlowSegment',flowSchema);
 const store={get:key=>Flow.findById(key).lean(),async cas(key,revision,value){
  try{const r=await Flow.updateOne({_id:key,revision},{$set:value},{upsert:revision===0});return !!(r.modifiedCount||r.upsertedCount);}
  catch(e){if(e.code===11000)return false;throw e;}
 },read:(regions,at)=>Flow.find({region:{$in:regions},'state.expiresAt':{$gt:at}},{segment:1,state:1,_id:0}).limit(3000).lean()};
 for(const method of ['read','observe'])router.post('/flow/'+method,async(req,res)=>{
  try{const flow=createFlowService({store,secret:env.JALAN_HASH_SECRET,clear:service().clearFromFlow});res.json(await flow[method](req.body));}
  catch(e){res.status(e.status||503).json({error:e.status?e.message:'Traffic service unavailable.'});}
 });
 for(const [path,method]of [['/submit','submit'],['/nearby','nearby'],['/respond','respond']])router.post(path,async(req,res)=>{try{const value=await service()[method](method==='nearby'?req.body?.position:req.body);res.status(method==='submit'?201:200).json(method==='nearby'?{events:value}:value);}catch(e){res.status(e.status||503).json({error:e.status?e.message:'Reporting service unavailable. Please try again.'});}});
 return router;
}
module.exports={createService,createRouter};
