'use strict';
// CI-only end-to-end HTTP smoke for the loopback preview, using public OSM
// coordinates and the read-only database credential. No Heroku or DB writes.
const {spawn}=require('node:child_process');
const {randomBytes}=require('node:crypto');
const {setTimeout:delay}=require('node:timers/promises');
async function main(){
 if(!process.env.JALAN_READONLY_MONGODB_URI)throw Error('Read-only connection missing');
 const port=18865,token=randomBytes(32).toString('hex');
 const child=spawn(process.execPath,[require('node:path').join(__dirname,'run-kl-preview-local.js')],{
  env:{...process.env,JALAN_PREVIEW_PORT:String(port),JALAN_PREVIEW_TOKEN:token},
  stdio:'ignore'});
 const base='http://127.0.0.1:'+port;
 const headers={'x-jalan-preview-token':token};
 const get=async(path,opts={})=>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);
  try{return await fetch(base+path,{...opts,signal:controller.signal});}
  finally{clearTimeout(timer);}
 };
 try{
  let ready=false;
  for(let i=0;i<45;i++){
   if(child.exitCode!==null)throw Error('Preview exited during startup');
   try{const r=await get('/');if(r.ok){ready=true;break;}}catch(_){}
   await delay(1000);
  }
  if(!ready)throw Error('Preview did not start');
  const html=await (await get('/')).text();
  if(!html.includes('EXPERIMENTAL ONLY')||!html.includes('Check graph connection'))
   throw Error('Expected experimental UI not served');
  if((await get('/api/jalan/kl/health')).status!==401)
   throw Error('Unauthenticated preview health was accessible');
  const health=await get('/api/jalan/kl/health',{headers});
  const h=await health.json();
  if(health.status!==200||h.ok!==true||h.readOnly!==true||
    h.liveRouting!==false||h.graphEdges!==168221)throw Error('Preview graph health contract failed');
  const q=new URLSearchParams({startLat:'3.1315707',startLng:'101.7038508',
   endLat:'3.1314573',endLng:'101.7038951'});
  const response=await get('/api/jalan/kl/route?'+q,{headers});
  const route=await response.json();
  if(response.status!==200||route.ok!==true||
    route.mode!=='EXPERIMENTAL_SEGMENT_ROUTE'||
    route.routingActivated!==false||route.legalDrivingRouteVerified!==false||
    route.turnRestrictionsEnforced!==false||route.databaseWrites!==0||
    route.geometry?.type!=='LineString'||route.distanceMeters!==17)
   throw Error('Preview route safety/geometry contract failed');
  process.stdout.write('KL preview UI, authentication, health and read-only route HTTP smoke passed.\n');
 }finally{
  child.kill('SIGTERM');
  await Promise.race([new Promise(resolve=>child.once('exit',resolve)),delay(4000)]);
  if(child.exitCode===null)child.kill('SIGKILL');
 }
}
main().catch(()=>{process.stderr.write('KL preview HTTP smoke failed (details suppressed).\n');process.exitCode=1;});
