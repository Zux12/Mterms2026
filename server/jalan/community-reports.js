'use strict';
// Dedicated JALAN collections only. No location in request URLs or application logs.
const crypto=require('node:crypto'),P=require('./report-policy');
const publicEvent=e=>({id:e.id,type:e.type,position:e.position,heading:e.heading,road:e.road,createdAt:e.createdAt,updatedAt:e.updatedAt,expiresAt:e.expiresAt,contributors:e.contributors.length,active:e.active});
function createService({repository,secret,now=Date.now,id=()=>crypto.randomUUID()}){
 const hash=value=>crypto.createHmac('sha256',secret).update(value).digest('hex');
 const token=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{20,80}$/.test(value);
 function validate(input){if(!P.types[input?.type]||!P.coord(input.position)||!Number.isFinite(input.accuracy)||input.accuracy<0||input.accuracy>35||!Number.isFinite(input.fixAt)||now()-input.fixAt>10000||input.fixAt-now()>5000||!token(input.actor)||!(input.heading===null||P.heading(input.heading))||!(input.road===null||P.road(input.road)))throw Object.assign(Error('A fresh accurate location is required.'),{status:400});}
 async function change(key,fn){for(let attempt=0;attempt<8;attempt++){const record=await repository.get(key),revision=record?.revision??0;const events=(record?.events||[]).filter(e=>P.alive(e,now()));const result=fn(events);if(await repository.cas(key,revision,{events,revision:revision+1,expiresAt:new Date(Math.max(now()+60000,...events.map(e=>e.expiresAt)))}))return result;}throw Object.assign(Error('Please retry your report.'),{status:409});}
 return {
  async submit(input){validate(input);const actor=hash(input.actor),key=hash(input.type+'|'+(input.road?input.road.key+'|'+input.road.level:'unmatched|'+id()));
   return change(key,events=>{let event=events.find(e=>P.duplicate(e,input));const at=now();
    if(event){if(!event.contributors.includes(actor)){if(event.contributors.length>=500)throw Object.assign(Error('Event contribution limit reached.'),{status:429});event.contributors.push(actor);event.updatedAt=at;event.expiresAt=at+P.types[event.type].minutes*60000;event.clears=[];}}
    else{event={id:key+'.'+id(),type:input.type,position:input.position,heading:input.heading,road:input.road,createdAt:at,updatedAt:at,expiresAt:at+P.types[input.type].minutes*60000,contributors:[actor],responses:[],clears:[],active:true};if(events.length>=500)throw Object.assign(Error('Too many active events on this road.'),{status:429});events.push(event);}
    return {event:publicEvent(event),merged:event.contributors.length>1};});
  },
  async nearby(position){if(!P.coord(position))throw Object.assign(Error('Invalid location.'),{status:400});const events=await repository.nearby(position,now());return events.filter(e=>P.alive(e,now())&&P.distance(e.position,position)<=20000).slice(0,200).map(publicEvent);},
  async respond(input){if(!token(input?.actor)||!token(input?.journey)||!['still','cleared'].includes(input?.answer)||typeof input?.id!=='string'||!/^[a-f0-9]{64}\.[a-zA-Z0-9-]{1,80}$/.test(input.id)||!P.coord(input.position)||!P.heading(input.heading)||!P.road(input.road)||!Number.isFinite(input.accuracy)||input.accuracy>35||input.accuracy<0||!Number.isFinite(input.fixAt)||now()-input.fixAt>10000||input.fixAt-now()>5000)throw Object.assign(Error('Invalid confirmation.'),{status:400});
   return change(input.id.split('.')[0],events=>{const e=events.find(e=>e.id===input.id);if(!e)throw Object.assign(Error('Report has expired.'),{status:410});
    if(!P.sameRoad(e.road,input.road)||!P.heading(e.heading)||P.delta(e.heading,input.heading)>40||P.distance(e.position,input.position)>150)throw Object.assign(Error('Confirmation must be near the event on the same road and direction.'),{status:400});
    const actor=hash(input.actor),vote=hash(input.actor+'|'+input.journey);if(e.responses.includes(vote))return {event:publicEvent(e),duplicate:true};
    if(e.responses.length>=1000)throw Object.assign(Error('Event response limit reached.'),{status:429});e.responses.push(vote);
    if(input.answer==='still'){e.updatedAt=now();e.expiresAt=now()+P.types[e.type].minutes*60000;e.clears=[];}
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
  // Bounded read; expiresAt index excludes stale buckets. The event filter is authoritative, not TTL timing.
  const rows=await Model.find({expiresAt:{$gt:new Date(at)},'events.position.0':{$gte:position[0]-.25,$lte:position[0]+.25},'events.position.1':{$gte:position[1]-.2,$lte:position[1]+.2}}).limit(300).lean();return rows.flatMap(r=>r.events);
 }};
 router.use((req,res,next)=>{res.set('Cache-Control','no-store');if(req.query&&Object.keys(req.query).length)return res.status(400).json({error:'Use JSON body; location query parameters are not accepted.'});if(req.get('origin')&&!['https://zux12.github.io','https://mterms2026.com','https://www.mterms2026.com'].includes(req.get('origin')))return res.status(403).json({error:'Origin not allowed.'});next();});
 router.get('/health',(_req,res)=>res.json({ok:true,service:'jalan-community-reports',version:1}));
 router.use(express.json({limit:'12kb'}));
 router.use((req,res,next)=>{const at=Date.now();for(const [key,b]of buckets)if(b.until<=at)buckets.delete(key);const key=req.ip||'unknown',b=buckets.get(key)||{n:0,until:at+60000};if(buckets.size>=10000&&!buckets.has(key))return res.status(429).json({error:'Please try again shortly.'});buckets.set(key,b);if(++b.n>60)return res.status(429).json({error:'Please try again shortly.'});if(!env.JALAN_HASH_SECRET||env.JALAN_HASH_SECRET.length<32)return res.status(503).json({error:'Reporting service is not configured.'});if(Buffer.byteLength(JSON.stringify(req.body||{}))>12000)return res.status(413).json({error:'Report is too large.'});next();});
 const service=()=>createService({repository,secret:env.JALAN_HASH_SECRET});
 for(const [path,method]of [['/submit','submit'],['/nearby','nearby'],['/respond','respond']])router.post(path,async(req,res)=>{try{const value=await service()[method](method==='nearby'?req.body?.position:req.body);res.status(method==='submit'?201:200).json(method==='nearby'?{events:value}:value);}catch(e){res.status(e.status||503).json({error:e.status?e.message:'Reporting service unavailable. Please try again.'});}});
 return router;
}
module.exports={createService,createRouter};
