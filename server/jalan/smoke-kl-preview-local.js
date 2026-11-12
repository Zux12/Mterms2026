'use strict';
// CI-only end-to-end HTTP smoke for the loopback preview, using public OSM
// coordinates and the read-only database credential. No Heroku or DB writes.
const {spawn}=require('node:child_process');
const {randomBytes}=require('node:crypto');
const {setTimeout:delay}=require('node:timers/promises');
const {geometryMatchesJourney,verifiedGeometry}=require('./collect-kl-route-evidence');
// These are public OSM coordinates for one KL pilot smoke, never user GPS.
const SMOKE_JOURNEY=Object.freeze({startLat:3.1315707,startLng:101.7038508,
 endLat:3.1314573,endLng:101.7038951});

// Pure HTTP-contract predicates also exercised without Atlas by node:test.
// These checks are smoke diagnostics, not independent road-legality approval.
function secureHeaders(response) {
 return response?.headers?.get('cache-control')==='no-store' &&
  response.headers.get('x-powered-by')===null;
}
function previewDenied(response,body) {
 return secureHeaders(response)&&response.status===401&&body?.ok===false&&
  body.error==='Preview token required';
}
function previewHealthVerified(response,body) {
 return secureHeaders(response)&&response.status===200&&body?.ok===true&&
  body.readOnly===true&&body.liveRouting===false&&body.graphEdges===168221;
}
function previewRouteVerified(response,body,journey=SMOKE_JOURNEY) {
 const coords=body?.geometry?.coordinates;
 return secureHeaders(response)&&response.status===200&&body?.ok===true&&
  body.mode==='EXPERIMENTAL_SEGMENT_ROUTE'&&
  body.graphEdges===168221&&body.graphVersion==='road_graph_edges_v495'&&
  body.routingActivated===false&&body.legalDrivingRouteVerified===false&&
  body.accessRestrictionsEnforced===false&&body.turnRestrictionsEnforced===false&&
  body.trafficAware===false&&body.databaseWrites===0&&
  body.geometry?.type==='LineString'&&Array.isArray(coords)&&coords.length>=2&&
  coords.every(p=>Array.isArray(p)&&p.length===2&&
    Number.isFinite(p[0])&&Math.abs(p[0])<=180&&
    Number.isFinite(p[1])&&Math.abs(p[1])<=90)&&
  body.distanceMeters===17&&
  // Public OSM fixture points are actual graph nodes: a 17 m route snapped
  // to a different road 10+ m away is not valid smoke evidence, even if
  // the reported snap distances accurately describe that wrong road.
  Number.isFinite(body.startSnapMeters)&&body.startSnapMeters>=0&&body.startSnapMeters<=2&&
  Number.isFinite(body.endSnapMeters)&&body.endSnapMeters>=0&&body.endSnapMeters<=2&&
  // Require the complete gap audit, not just a self-reported zero count.
  body.geometryGapAdvisoryOnly===true&&
  Number.isSafeInteger(body.geometryGapTransitionsInspected)&&
  body.geometryGapTransitionsInspected>=0&&
  Number.isFinite(body.geometryGapThresholdMeters)&&
  body.geometryGapThresholdMeters>=0&&body.geometryGapThresholdMeters<=2&&
  Number.isFinite(body.geometryMaxGapMeters)&&body.geometryMaxGapMeters>=0&&
  body.geometryMaxGapMeters<=body.geometryGapThresholdMeters&&
  // Cross-check reported snap distances and route length against actual
  // GeoJSON, instead of trusting a syntactically valid unrelated polyline.
  verifiedGeometry(body)&&geometryMatchesJourney(body,journey);
}
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
  const unauthHealth=await get('/api/jalan/kl/health');
  if(!previewDenied(unauthHealth,await unauthHealth.json()))
   throw Error('Unauthenticated preview health was accessible');
  const health=await get('/api/jalan/kl/health',{headers});
  if(!previewHealthVerified(health,await health.json()))
   throw Error('Preview graph health or response hardening failed');
  const q=new URLSearchParams(Object.entries(SMOKE_JOURNEY).map(([k,v])=>[k,String(v)]));
  const routePath='/api/jalan/kl/route?'+q;
  const unauthRoute=await get(routePath);
  if(!previewDenied(unauthRoute,await unauthRoute.json()))
   throw Error('Unauthenticated preview route was accessible');
  const wrongTokenRoute=await get(routePath,{headers:{'x-jalan-preview-token':'invalid-token'}});
  if(!previewDenied(wrongTokenRoute,await wrongTokenRoute.json()))
   throw Error('Incorrect preview token was accepted');
  const response=await get(routePath,{headers});
  if(!previewRouteVerified(response,await response.json()))
   throw Error('Preview route provenance, safety, geometry or response hardening failed');
  process.stdout.write('KL preview UI, authentication, health and read-only route HTTP smoke passed.\n');
 }finally{
  child.kill('SIGTERM');
  await Promise.race([new Promise(resolve=>child.once('exit',resolve)),delay(4000)]);
  if(child.exitCode===null)child.kill('SIGKILL');
 }
}
if(require.main===module)main().catch(()=>{process.stderr.write('KL preview HTTP smoke failed (details suppressed).\n');process.exitCode=1;});
module.exports={secureHeaders,previewDenied,previewHealthVerified,previewRouteVerified};
