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
 distanceMeters:1300,startSnapMeters:2,endSnapMeters:6,
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
