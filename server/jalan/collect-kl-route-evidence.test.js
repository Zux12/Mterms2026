'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {collectEvidence,validateCases,endpointUrl}=require('./collect-kl-route-evidence');
const base={caseId:'kl-test-01',journeyType:'short-urban',expectedReachable:true,
 startLat:3.14,startLng:101.69,endLat:3.15,endLng:101.70};
const url='https://experimental.example.invalid/api/jalan/kl/route';
const good={
 ok:true,mode:'EXPERIMENTAL_SEGMENT_ROUTE',routingActivated:false,
 databaseWrites:0,trafficAware:false,legalDrivingRouteVerified:false,
 accessRestrictionsEnforced:false,turnRestrictionsEnforced:false,
 distanceMeters:1571,startSnapMeters:0,endSnapMeters:0,
 geometry:{type:'LineString',coordinates:[[101.69,3.14],[101.70,3.15]]},
 geometryGapReviewAvailable:true,geometryGapCountOverThreshold:0,geometryGapThresholdMeters:2,
 potentialAccessReviewEdges:1,potentialTurnRestrictionReviewCount:0,
 startSnapAmbiguous:false,endSnapAmbiguous:true
};
const noPath={ok:false,mode:'EXPERIMENTAL_SEGMENT_ROUTE',
 error:'No directed path found',routingActivated:false,databaseWrites:0,
 trafficAware:false,timingMs:{graphLoad:12.25,snapping:3.45,pathSearch:78.65,total:94.35}};
const reply=(status,body)=>async()=>({status,json:async()=>body});
test('collects actual experimental response metadata but never writes coordinates or secrets to evidence',async()=>{
 let request;
 const out=await collectEvidence([base],url,{fetchImpl:async(u,o)=>{
  request={u,o};return {status:200,json:async()=>good};
 },authHeader:'Authorization',authValue:'Bearer secret-local-only'});
 assert.equal(out.length,1);assert.equal(out[0].responseStatus,200);assert.equal(out[0].ok,true);
 assert.equal(out[0].geometryContinuous,true);
 assert.equal(out[0].endSnapAmbiguous,true);
 assert.equal(request.o.headers.Authorization,'Bearer secret-local-only');
 assert.equal(request.o.redirect,'error');assert.ok(request.u.includes('startLat=3.14'));
 const serialized=JSON.stringify(out);
 assert.ok(!serialized.includes('101.69'));assert.ok(!serialized.includes('secret-local-only'));
 assert.ok(!serialized.includes('coordinates'));
 assert.ok(!serialized.includes('experimental.example'));
});
test('recognized no-path 404 is accepted only with pre-existing independent review',async()=>{
 const c={...base,caseId:'kl-unreachable',journeyType:'disconnected',
  expectedReachable:false,disconnectionReviewed:true};
 const out=await collectEvidence([c],url,{fetchImpl:reply(404,noPath)});
 assert.equal(out[0].responseStatus,404);assert.equal(out[0].ok,false);
 assert.equal(out[0].disconnectionReviewed,true);
 assert.equal(out[0].noPathModeVerified,true);
 assert.equal(out[0].pathSearchMs,78.7);
 assert.equal(out[0].serverTotalMs,94.4);
});
test('generic HTTP 404 cannot be mistaken for a disconnected road',async()=>{
 const c={...base,expectedReachable:false,disconnectionReviewed:true};
 const out=await collectEvidence([c],url,{fetchImpl:reply(404,{error:'Not Found'})});
 assert.equal(out[0].responseStatus,0);assert.equal(out[0].ok,false);
 assert.equal(out[0].failureClass,'unverified-experimental-response');
});
test('API outages, authentication failures, snap failures are not no-path evidence',async()=>{
 const c={...base,expectedReachable:false,disconnectionReviewed:true};
 for(const code of [401,403,422,500,503]){
  const out=await collectEvidence([c],url,{fetchImpl:reply(code,{error:'No directed path found'})});
  assert.equal(out[0].responseStatus,code);assert.equal(out[0].ok,false);
 }
});
test('non-experimental HTTP 200 cannot pass as a route',async()=>{
 const out=await collectEvidence([base],url,{fetchImpl:reply(200,{
  ...good,mode:'TOMTOM_PRODUCTION'
 })});
 assert.equal(out[0].ok,false);assert.equal(out[0].responseStatus,200);
 assert.equal(out[0].failureClass,'unverified-experimental-response');
});
test('route with a geometry gap remains incomplete evidence',async()=>{
 const out=await collectEvidence([base],url,{fetchImpl:reply(200,{...good,geometryGapCountOverThreshold:1})});
 assert.equal(out[0].ok,true);
 assert.equal(out[0].geometryContinuous,false);
});
test('network exceptions and HTTP redirects fail closed without exposing error',async()=>{
 const out=await collectEvidence([base],url,{fetchImpl:async()=>{throw Error('Authorization Bearer secret-local-only')}});
 assert.equal(out[0].responseStatus,0);assert.equal(out[0].ok,false);
 assert.ok(!JSON.stringify(out).includes('Bearer'));
});
test('invalid cases rejected before any fetch',async()=>{
 let called=0;
 await assert.rejects(()=>collectEvidence([{...base,startLat:99}],url,{fetchImpl:async()=>{called++;}}),/Coordinate/);
 assert.equal(called,0);
 await assert.rejects(()=>collectEvidence([{...base},{...base}],url),/duplicate/);
 await assert.rejects(()=>collectEvidence([{...base,expectedReachable:false}],url),/review/);
});
test('only HTTPS or loopback HTTP accepted for experimental endpoint',()=>{
 assert.throws(()=>endpointUrl('http://evil.example/route'),/HTTPS/);
 assert.throws(()=>endpointUrl('https://user:secret@example.test/route'),/credentials/);
 assert.equal(endpointUrl('http://127.0.0.1:3000/route').hostname,'127.0.0.1');
 assert.throws(()=>endpointUrl('https://example.test/health'),/route/);
});

test('captures valid stage timings without leaking private coordinates',async()=>{
 const body={...good,timingMs:{graphLoad:120.25,snapping:35.19,pathSearch:8.31,total:163.75}};
 const out=await collectEvidence([base],url,{fetchImpl:reply(200,body)});
 assert.equal(out[0].graphLoadMs,120.3);
 assert.equal(out[0].snappingMs,35.2);
 assert.equal(out[0].pathSearchMs,8.3);
 assert.equal(out[0].serverTotalMs,163.8);
 assert.equal(out[0].startLat,undefined);
});
test('rejects malformed stage timings without losing valid route evidence',async()=>{
 const body={...good,timingMs:{graphLoad:-1,snapping:2,pathSearch:3,total:4}};
 const out=await collectEvidence([base],url,{fetchImpl:reply(200,body)});
 assert.equal(out[0].ok,true);
 assert.equal(out[0].graphLoadMs,undefined);
});

test('spoofed no-path 404 from another route service never becomes reviewed disconnection',async()=>{
 const c={...base,caseId:'kl-spoof',journeyType:'disconnected',
  expectedReachable:false,disconnectionReviewed:true};
 for(const body of [
  {...noPath,mode:'TOMTOM_PRODUCTION'},
  {...noPath,mode:undefined},
  {...noPath,routingActivated:true},
  {...noPath,databaseWrites:1},
  {...noPath,trafficAware:true}
 ]){
  const out=await collectEvidence([c],url,{fetchImpl:reply(404,body)});
  assert.equal(out[0].ok,false);
  assert.equal(out[0].responseStatus,0);
  assert.equal(out[0].failureClass,'unverified-experimental-response');
  assert.equal(out[0].disconnectionReviewed,undefined);
  assert.equal(out[0].noPathModeVerified,undefined);
 }
});
test('malformed no-path timing does not contaminate sanitized evidence',async()=>{
 const c={...base,caseId:'kl-invalid-timing',journeyType:'disconnected',
  expectedReachable:false,disconnectionReviewed:true};
 const out=await collectEvidence([c],url,{fetchImpl:reply(404,{
  ...noPath,timingMs:{...noPath.timingMs,pathSearch:-2}
 })});
 assert.equal(out[0].responseStatus,404);
 assert.equal(out[0].serverTotalMs,undefined);
 assert.ok(!JSON.stringify(out).includes('startLat'));
});

test('independent geometry metric check accepts correct route endpoints and distance',async()=>{
 const out=await collectEvidence([base],url,{fetchImpl:reply(200,good)});
 assert.equal(out[0].geometryMetricsVerified,true);
 assert.equal(out[0].geometryContinuous,true);
});
test('route reporting an impossible distance fails geometry evidence despite clean gap advisory',async()=>{
 const out=await collectEvidence([base],url,{fetchImpl:reply(200,{...good,distanceMeters:200})});
 assert.equal(out[0].ok,true);
 assert.equal(out[0].geometryMetricsVerified,false);
 assert.equal(out[0].geometryContinuous,false);
});
test('geographically displaced route fails even when polyline length is plausible',async()=>{
 const shifted={...good,geometry:{type:'LineString',
  coordinates:[[101.69,3.141],[101.70,3.151]]}};
 const out=await collectEvidence([base],url,{fetchImpl:reply(200,shifted)});
 assert.equal(out[0].geometryMetricsVerified,false);
 assert.equal(out[0].geometryContinuous,false);
});
test('reversed GeoJSON coordinate order fails independent journey check',async()=>{
 const swapped={...good,geometry:{type:'LineString',
  coordinates:[[3.14,101.69],[3.15,101.70]]}};
 const out=await collectEvidence([base],url,{fetchImpl:reply(200,swapped)});
 assert.equal(out[0].geometryMetricsVerified,false);
 assert.equal(out[0].geometryContinuous,false);
});
test('zero-distance same-point route remains valid geometry',async()=>{
 const same={...base,endLat:base.startLat,endLng:base.startLng};
 const body={...good,distanceMeters:0,geometry:{type:'LineString',
  coordinates:[[base.startLng,base.startLat],[base.startLng,base.startLat]]}};
 const out=await collectEvidence([same],url,{fetchImpl:reply(200,body)});
 assert.equal(out[0].geometryMetricsVerified,true);
 assert.equal(out[0].geometryContinuous,true);
});

test('malformed advisory metadata never enters the sanitized evidence output',async()=>{
 const secret='Bearer PRIVATE_DIAGNOSTIC_TOKEN';
 const body={...good,
  potentialAccessReviewEdges:{message:secret,coordinate:101.69123},
  potentialTurnRestrictionReviewCount:['private',secret],
  startSnapAmbiguous:'private-coordinate-101.69123',
  endSnapAmbiguous:{secret}};
 const out=await collectEvidence([base],url,{fetchImpl:reply(200,body)});
 assert.equal(out[0].ok,true);
 assert.equal(out[0].geometryMetricsVerified,true);
 assert.equal(out[0].potentialAccessReviewEdges,null);
 assert.equal(out[0].potentialTurnRestrictionReviewCount,null);
 assert.equal(out[0].startSnapAmbiguous,null);
 assert.equal(out[0].endSnapAmbiguous,null);
 const persisted=JSON.stringify(out);
 assert.ok(!persisted.includes(secret));
 assert.ok(!persisted.includes('101.69123'));
 assert.ok(!persisted.includes('private-coordinate'));
});
test('malformed required route metrics fail closed without persisting response secrets',async()=>{
 const secret='PRIVATE_ORIGIN_BEARER_TOKEN';
 const body={...good,distanceMeters:{raw:secret},startSnapMeters:secret,
  endSnapMeters:[secret],potentialAccessReviewEdges:-2,
  potentialTurnRestrictionReviewCount:1.25};
 const out=await collectEvidence([base],url,{fetchImpl:reply(200,body)});
 assert.equal(out[0].routeModeVerified,true);
 assert.equal(out[0].distanceMeters,null);
 assert.equal(out[0].startSnapMeters,null);
 assert.equal(out[0].endSnapMeters,null);
 assert.equal(out[0].potentialAccessReviewEdges,null);
 assert.equal(out[0].potentialTurnRestrictionReviewCount,null);
 assert.equal(out[0].geometryMetricsVerified,false);
 assert.equal(out[0].geometryContinuous,false);
 assert.ok(!JSON.stringify(out).includes(secret));
});

test('inconsistent server stage timings are never archived as performance evidence',async()=>{
 for(const timingMs of [
  {graphLoad:100,snapping:25,pathSearch:10,total:7},
  {graphLoad:100,snapping:25,pathSearch:10,total:130},
  {graphLoad:1e308,snapping:1e308,pathSearch:0,total:1e308}
 ]){
  const out=await collectEvidence([base],url,{fetchImpl:reply(200,{...good,timingMs})});
  assert.equal(out[0].ok,true,'timing rejection does not reclassify route');
  for(const key of ['graphLoadMs','snappingMs','pathSearchMs','serverTotalMs'])
   assert.equal(out[0][key],undefined,'no incomplete stage metrics stored');
 }
});
test('accepts small monotonic-clock floating-point differences before rounding',async()=>{
 const out=await collectEvidence([base],url,{fetchImpl:reply(200,{
  ...good,timingMs:{graphLoad:12.34001,snapping:4.56001,pathSearch:9.10001,total:26}
 })});
 assert.equal(out[0].graphLoadMs,12.3);
 assert.equal(out[0].snappingMs,4.6);
 assert.equal(out[0].pathSearchMs,9.1);
 assert.equal(out[0].serverTotalMs,26);
});
test('inconsistent no-path stage timing does not undermine independently verified 404',async()=>{
 const c={...base,expectedReachable:false,disconnectionReviewed:true,journeyType:'disconnected'};
 const out=await collectEvidence([c],url,{fetchImpl:reply(404,{
  ...noPath,timingMs:{graphLoad:10,snapping:20,pathSearch:30,total:300}
 })});
 assert.equal(out[0].responseStatus,404);
 assert.equal(out[0].noPathModeVerified,true);
 assert.equal(out[0].graphLoadMs,undefined);
});
