'use strict';
// Isolated, authenticated Railway pilot; experimental map only, NOT live navigation.
// Requires dedicated Atlas READ-ONLY credentials and independent access secrets.
// Do not run this service in the MTERMS2026 production environment.
const path=require('node:path');
const {timingSafeEqual}=require('node:crypto');
const express=require('express');
const mongoose=require('mongoose');
const {router}=require('./kl-segment-v4102');
const uri=process.env.JALAN_READONLY_MONGODB_URI;
const token=process.env.JALAN_PREVIEW_TOKEN;
const password=process.env.JALAN_PILOT_ACCESS_PASSWORD;
const port=Number(process.env.PORT||8080);
function eq(a,b){
 if(typeof a!=='string'||typeof b!=='string')return false;
 const x=Buffer.from(a),y=Buffer.from(b);
 return x.length===y.length&&timingSafeEqual(x,y);
}
function basic(req){
 const h=req.get('authorization')||'';
 if(!h.startsWith('Basic ')||h.length>1024)return false;
 let decoded;
 try{decoded=Buffer.from(h.slice(6),'base64').toString('utf8');}catch{return false;}
 const split=decoded.indexOf(':');
 return split>0&&eq(decoded.slice(0,split),'jalan-pilot')&&eq(decoded.slice(split+1),password);
}
async function main(){
 if(!uri||!token||token.length<32||!password||password.length<32||
  token===password||!Number.isSafeInteger(port)||port<1024||port>65535)
  throw Error('KL pilot requires distinct strong credentials and valid port');
 await mongoose.connect(uri,{serverSelectionTimeoutMS:15000,readPreference:'secondaryPreferred'});
 const db=mongoose.connection.useDb('jalan_navigation',{useCache:true}).db;
 if(await db.collection('road_graph_edges_v495').countDocuments()!==168221)
  throw Error('KL pilot graph version mismatch');
 const app=express();
 app.disable('x-powered-by');
 app.use((req,res,next)=>{
  res.set('Cache-Control','no-store');
  res.set('X-Content-Type-Options','nosniff');
  res.set('Referrer-Policy','no-referrer');
  res.set('X-Frame-Options','DENY');
  res.set('Content-Security-Policy',"default-src 'none'; style-src 'self' 'unsafe-inline' https://unpkg.com; script-src 'self' 'unsafe-inline' https://unpkg.com; img-src 'self' data: https://*.tile.openstreetmap.org; connect-src 'self'; frame-ancestors 'none';");
  next();
 });
 // Railway health probe reveals no route, DB fields, or authentication state.
 app.get('/_railway_health',(_req,res)=>res.status(200).type('text').send('ok'));
 app.use((req,res,next)=>{
  if(basic(req))return next();
  res.set('WWW-Authenticate','Basic realm="JALAN experimental pilot", charset="UTF-8"');
  return res.status(401).type('text').send('Private JALAN pilot: authentication required');
 });
 app.get('/',(_req,res)=>res.sendFile(path.join(__dirname,'kl-pilot-preview.html')));
 const history=new Map();let active=0;
 app.use('/api/jalan/kl',(req,res,next)=>{
  if(!eq(req.get('x-jalan-preview-token'),token))
   return res.status(401).json({ok:false,error:'Pilot token required'});
  if(req.path==='/route'){
   const now=Date.now();
   for(const [ip,times] of history)if(!times.length||now-times[times.length-1]>=60000)history.delete(ip);
   const ip=req.ip||'unknown',times=(history.get(ip)||[]).filter(t=>now-t<60000);
   if(times.length>=12||active>=1)
    return res.status(429).json({ok:false,error:'Pilot route busy or rate limited'});
   times.push(now);history.set(ip,times);active++;
   let released=false;
   const release=()=>{if(!released){released=true;active--;}};
   res.once('close',release);res.once('finish',release);
  }
  next();
 },router);
 const server=app.listen(port,'0.0.0.0',()=>process.stdout.write('Private experimental JALAN pilot listening; no production routing.\n'));
 const stop=async()=>{server.close();await mongoose.disconnect();};
 process.once('SIGTERM',stop);process.once('SIGINT',stop);
}
if(require.main===module)main().catch(()=>{
 process.stderr.write('Private JALAN pilot initialization failed; details suppressed.\n');
 process.exitCode=1;
});
module.exports={basic};
