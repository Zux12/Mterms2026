'use strict';
// Offline operator-side read-only collector for the isolated KL experimental
// route endpoint. Does not deploy, touch MongoDB, or switch production TomTom.
// Private origin/destination coordinates remain in the INPUT file only.
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {performance}=require('node:perf_hooks');
const TYPES=new Set(['short-urban','long-corridor','one-way','overpass','disconnected']);
function endpointUrl(raw){
 if(typeof raw!=='string'||!raw.trim())throw Error('JALAN_EXPERIMENTAL_ROUTE_URL is required');
 const u=new URL(raw);
 const local=(u.hostname==='localhost'||u.hostname==='127.0.0.1'||u.hostname==='[::1]');
 if(u.protocol!=='https:'&&!(u.protocol==='http:'&&local))throw Error('Use HTTPS (or loopback HTTP)');
 if(!u.pathname.endsWith('/route'))throw Error('Endpoint must end in /route');
 if(u.username||u.password)throw Error('Do not put credentials in the URL');
 return u;
}
function validCoord(lat,lng){return Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=2.5&&lat<=3.8&&lng>=100.8&&lng<=102.3;}
function validateCases(cases){
 if(!Array.isArray(cases)||cases.length<1||cases.length>100)throw Error('Expected 1-100 journey cases');
 const ids=new Set();
 for(const c of cases){
  if(!c||typeof c!=='object'||Array.isArray(c)||typeof c.caseId!=='string'||
    !/^[a-zA-Z0-9_-]{1,80}$/.test(c.caseId)||ids.has(c.caseId))throw Error('Invalid or duplicate caseId');
  ids.add(c.caseId);
  if(!TYPES.has(c.journeyType)||typeof c.expectedReachable!=='boolean')throw Error('Invalid journey type or expectation');
  if(!validCoord(c.startLat,c.startLng)||!validCoord(c.endLat,c.endLng))throw Error('Coordinate outside KL pilot bounds');
  if(c.expectedReachable===false&&c.disconnectionReviewed!==true)
   throw Error('Expected unreachable journey requires prior independent disconnection review');
 }
 return cases;
}
function verifiedGeometry(body){
 const g=body?.geometry?.coordinates;
 return body?.geometry?.type==='LineString'&&Array.isArray(g)&&g.length>=2&&
  g.every(p=>Array.isArray(p)&&p.length===2&&Number.isFinite(p[0])&&Number.isFinite(p[1]))&&
  body.geometryGapReviewAvailable===true&&body.geometryGapCountOverThreshold===0&&
  Number.isFinite(body.geometryGapThresholdMeters)&&body.geometryGapThresholdMeters<=2;
}
// Independently cross-check experimental GeoJSON against the private input
// coordinates while they are in memory. Never serialize those coordinates.
// This guards against a well-formed but wrong/shortened/swapped route even
// if a server's own geometry-gap advisory reports no gaps.
function haversineLngLat(a,b){
 const rad=Math.PI/180,R=6371000,dy=(b[1]-a[1])*rad,dx=(b[0]-a[0])*rad;
 const h=Math.sin(dy/2)**2+Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin(dx/2)**2;
 return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));
}
function geometryMatchesJourney(body,c){
 const points=body?.geometry?.coordinates;
 if(!Array.isArray(points)||points.length<2||!c||
    !points.every(p=>Array.isArray(p)&&p.length===2&&
      Number.isFinite(p[0])&&Number.isFinite(p[1])&&
      Math.abs(p[0])<=180&&Math.abs(p[1])<=90))return false;
 if(!validCoord(c.startLat,c.startLng)||!validCoord(c.endLat,c.endLng))return false;
 if(!['startSnapMeters','endSnapMeters','distanceMeters'].every(k=>
   Number.isFinite(body[k])&&body[k]>=0))return false;
 const origin=[c.startLng,c.startLat],destination=[c.endLng,c.endLat];
 const first=haversineLngLat(origin,points[0]);
 const last=haversineLngLat(destination,points[points.length-1]);
 // The preview rounds snap and path lengths to whole metres. Allow a small
 // additional numeric tolerance for serialized GeoJSON coordinates.
 const toleranceMeters=2;
 if(Math.abs(first-body.startSnapMeters)>toleranceMeters||
    Math.abs(last-body.endSnapMeters)>toleranceMeters)return false;
 let length=0;
 for(let i=1;i<points.length;i++)length+=haversineLngLat(points[i-1],points[i]);
 return Number.isFinite(length)&&Math.abs(length-body.distanceMeters)<=toleranceMeters;
}
function routeReply(body){
 return !!body&&body.ok===true&&body.mode==='EXPERIMENTAL_SEGMENT_ROUTE'&&
  body.routingActivated===false&&body.databaseWrites===0&&body.trafficAware===false&&
  body.legalDrivingRouteVerified===false&&body.accessRestrictionsEnforced===false&&
  body.turnRestrictionsEnforced===false;
}
// The response body is untrusted diagnostic input. Keep only scalar fields
// of the expected type in the durable evidence file, never opaque strings,
// objects or arrays that may accidentally contain URL/GPS/token material.
// Missing or malformed required metrics deliberately fail the validator.
function evidenceNonnegativeNumber(v){return Number.isFinite(v)&&v>=0?v:null;}
function evidenceCount(v){return Number.isSafeInteger(v)&&v>=0?v:null;}
function evidenceBoolean(v){return typeof v==='boolean'?v:null;}
// Stage timings are advisory only: preserve measured processing costs even for
// a legitimate directed no-path outcome, without copying URL, GPS or secrets.
function appendServerTiming(row,body){
 const timing=body?.timingMs;
 if(timing&&['graphLoad','snapping','pathSearch','total'].every(k=>Number.isFinite(timing[k])&&timing[k]>=0)){
  // The route handler measures consecutive intervals with one monotonic
  // clock. Inconsistent stage sums are not trustworthy performance evidence.
  // Check unrounded source values before rounding each exported metric.
  const stages=timing.graphLoad+timing.snapping+timing.pathSearch;
  // Collector requests are capped at 60 s. Bigger values cannot be credible
  // completed response timings and could overflow Math.round(value*10).
  if(!Number.isFinite(stages)||timing.total>60000||
     Math.abs(stages-timing.total)>0.05)return;
  row.graphLoadMs=Math.round(timing.graphLoad*10)/10;
  row.snappingMs=Math.round(timing.snapping*10)/10;
  row.pathSearchMs=Math.round(timing.pathSearch*10)/10;
  row.serverTotalMs=Math.round(timing.total*10)/10;
 }
}
async function collectEvidence(cases,rawEndpoint,{fetchImpl=globalThis.fetch,authHeader,authValue,timeoutMs=20000}={}){
 validateCases(cases);const endpoint=endpointUrl(rawEndpoint),out=[];
 if((authHeader&&!authValue)||(!authHeader&&authValue))throw Error('Both authentication header name and value must be supplied');
 if(authHeader&&!/^[a-zA-Z0-9-]+$/.test(authHeader))throw Error('Invalid header name');
 if(!Number.isFinite(timeoutMs)||timeoutMs<1000||timeoutMs>60000)throw Error('Invalid request timeout');
 for(const c of cases){ // Sequential to avoid load spikes against experimental graph.
  const u=new URL(endpoint);
  for(const k of ['startLat','startLng','endLat','endLng'])u.searchParams.set(k,String(c[k]));
  const headers={accept:'application/json'};
  if(authHeader)headers[authHeader]=authValue;
  const row={caseId:c.caseId,journeyType:c.journeyType,expectedReachable:c.expectedReachable};
  const start=performance.now();
  try{
   const res=await fetchImpl(u.toString(),{method:'GET',headers,redirect:'error',signal:AbortSignal.timeout(timeoutMs)});
   let body=null;try{body=await res.json();}catch(_){} // Do not log response bodies.
   row.elapsedMs=Math.round((performance.now()-start)*10)/10;
   if(res.status===200&&routeReply(body)){
    row.responseStatus=200;row.ok=true;
    row.distanceMeters=evidenceNonnegativeNumber(body.distanceMeters);
    row.startSnapMeters=evidenceNonnegativeNumber(body.startSnapMeters);
    row.endSnapMeters=evidenceNonnegativeNumber(body.endSnapMeters);
    // Requires graph transition gap diagnostic, NOT merely valid GeoJSON.
    row.geometryMetricsVerified=geometryMatchesJourney(body,c);
    row.geometryContinuous=verifiedGeometry(body)&&row.geometryMetricsVerified;
    row.routeModeVerified=true;
    row.graphCacheHit=evidenceBoolean(body.graphCacheHit);
    appendServerTiming(row,body);
    row.potentialAccessReviewEdges=evidenceCount(body.potentialAccessReviewEdges);
    row.potentialTurnRestrictionReviewCount=evidenceCount(body.potentialTurnRestrictionReviewCount);
    row.startSnapAmbiguous=evidenceBoolean(body.startSnapAmbiguous);
    row.endSnapAmbiguous=evidenceBoolean(body.endSnapAmbiguous);
   }else if(res.status===404&&body?.ok===false&&body.mode==='EXPERIMENTAL_SEGMENT_ROUTE'&&body.routingActivated===false&&body.databaseWrites===0&&body.trafficAware===false&&body.error==='No directed path found'){
    row.responseStatus=404;row.ok=false;
    row.disconnectionReviewed=c.disconnectionReviewed===true;
    // Confirm a recognized experimental no-path response, not just HTTP 404.
    row.noPathModeVerified=true;
    appendServerTiming(row,body);
   }else if(res.status===422&&body?.ok===false&&body.mode==='EXPERIMENTAL_SEGMENT_ROUTE'&&
    body.routingActivated===false&&body.databaseWrites===0&&body.trafficAware===false&&
    body.error==='No nearby directed graph segment within 200 m'){
    // A snap failure is NOT a directed no-path finding. Preserve only sanitized
    // measurements; the existing acceptance validator must reject this case.
    row.responseStatus=422;row.ok=false;row.failureClass='snap-out-of-range';
    row.startSnapMeters=evidenceNonnegativeNumber(body.startSnapMeters);
    row.endSnapMeters=evidenceNonnegativeNumber(body.endSnapMeters);
    appendServerTiming(row,body);
   }else{
    // Authentication failures, unrelated 422/404 responses, outages and
    // unrelated 404s can NEVER be counted as reviewed graph disconnections.
    row.responseStatus=res.status===404?0:res.status;
    row.ok=false;row.failureClass='unverified-experimental-response';
   }
  }catch(_){
   // Never print request URL, error stack or authentication header.
   row.elapsedMs=Math.round((performance.now()-start)*10)/10;
   row.responseStatus=0;row.ok=false;row.failureClass='request-failed';
  }
  out.push(row);
 }
 return out;
}
async function main(){
 const [input,output]=process.argv.slice(2);
 if(!input||!output)throw Error('Usage: node collect-kl-route-evidence.js CASES_PRIVATE_JSON OUTPUT_SANITIZED_JSON');
 if(path.resolve(input)===path.resolve(output))throw Error('Input and output paths must differ');
 const cases=JSON.parse(fs.readFileSync(input,'utf8'));
 const rows=await collectEvidence(cases,process.env.JALAN_EXPERIMENTAL_ROUTE_URL,{
  authHeader:process.env.JALAN_AUTH_HEADER,authValue:process.env.JALAN_AUTH_VALUE
 });
 // Exclusive creation protects previous evidence; 0600 avoids permissive reads.
 fs.writeFileSync(output,JSON.stringify(rows,null,2)+'\n',{flag:'wx',mode:0o600});
 const child=spawnSync(process.execPath,[path.join(__dirname,'validate-kl-pilot.js'),output],
  {encoding:'utf8',timeout:10000});
 if(child.stdout)process.stdout.write(child.stdout);
 if(child.stderr)process.stderr.write('Acceptance validator reported an error.\n');
 process.exitCode=child.status===null?1:child.status;
}
if(require.main===module)main().catch(e=>{
 // Avoid printing raw URL, HTTP response, token or private coordinates.
 process.stderr.write('KL evidence collection failed: '+(
  /^(Usage:|Expected |Invalid |Coordinate |Both |Input and output|Do not |Endpoint |Use HTTPS|JALAN_EXPERIMENTAL_ROUTE_URL|Authentication)/.test(e.message)?e.message:'check local configuration and file permissions')+'\n');
 process.exitCode=1;
});
module.exports={endpointUrl,validateCases,verifiedGeometry,routeReply,collectEvidence};
