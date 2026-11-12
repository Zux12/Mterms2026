'use strict';
// Owner-operated, loopback-only experimental preview. No deployment, no DB writes.
// Requires JALAN_READONLY_MONGODB_URI and JALAN_PREVIEW_TOKEN from environment.
// The token is entered in the browser and never placed in URLs or logs.
const path=require('node:path');
const {timingSafeEqual}=require('node:crypto');
const express=require('express');
const mongoose=require('mongoose');
const {router}=require('./kl-segment-v4102');
const token=process.env.JALAN_PREVIEW_TOKEN;
const uri=process.env.JALAN_READONLY_MONGODB_URI;
const host='127.0.0.1';
const port=Number(process.env.JALAN_PREVIEW_PORT||8765);
function authorized(received){
 if(typeof received!=='string'||typeof token!=='string')return false;
 const a=Buffer.from(received),b=Buffer.from(token);
 return a.length===b.length&&timingSafeEqual(a,b);
}
async function main(){
 if(!uri||!token||token.length<24||!Number.isSafeInteger(port)||port<1024||port>65535)
  throw Error('Missing read-only credentials, preview token or valid port');
 await mongoose.connect(uri,{serverSelectionTimeoutMS:15000,readPreference:'secondaryPreferred'});
 const db=mongoose.connection.useDb('jalan_navigation',{useCache:true}).db;
 if(await db.collection('road_graph_edges_v495').countDocuments()!==168221){
  await mongoose.disconnect();
  throw Error('KL graph count mismatch');
 }
 const app=express();
 app.disable('x-powered-by');
 app.use((req,res,next)=>{
  res.set('Cache-Control','no-store');
  res.set('Content-Security-Policy',"default-src 'none'; style-src 'self' 'unsafe-inline' https://unpkg.com; script-src 'self' 'unsafe-inline' https://unpkg.com; img-src 'self' data: https://*.tile.openstreetmap.org; connect-src 'self';");
  next();
 });
 app.get('/',(req,res)=>res.sendFile(path.join(__dirname,'kl-pilot-preview.html')));
 app.use('/api/jalan/kl',(req,res,next)=>{
  if(!authorized(req.get('x-jalan-preview-token')))return res.status(401).json({ok:false,error:'Preview token required'});
  next();
 },router);
 const server=app.listen(port,host,()=>process.stdout.write('KL diagnostic preview listening on loopback port '+port+'; no production deployment.\n'));
 const shutdown=async()=>{server.close();await mongoose.disconnect();};
 process.once('SIGINT',shutdown);process.once('SIGTERM',shutdown);
}
if(require.main===module)main().catch(()=>{
 process.stderr.write('KL preview initialization failed; credentials and connection details suppressed.\n');
 process.exitCode=1;
});
