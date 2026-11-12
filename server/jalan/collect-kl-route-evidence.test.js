'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {collectEvidence,validateCases,endpointUrl}=require('./collect-kl-route-evidence');
const base={caseId:'kl-test-01',journeyType:'short-urban',expectedReachable:true,
 startLat:3.14,startLng:101.69,endLat:3.15,endLng:101.70};
const url='https://experimental.example.invalid/api/jalan/kl/route';
const good={
 ok:true,mode:'EXPERIMENTAL_SEGMENT_ROUTE',graphVersion:'road_graph_edges_v495',graphEdges:168221,routingActivated:false,
 databaseWrites:0,trafficAware:false,legalDrivingRouteVerified:false,
 accessRestrictionsEnforced:false,turnRestrictionsEnforced:false,
 distanceMeters:1571,edgeCount:1,startSnapMeters:0,endSnapMeters:0,
 geometry:{type:'LineString',coordinates:[[101.69,3.14],[101.70,3.15]]},
 geometryGapReviewAvailable:true,geometryGapCountOverThreshold:0,geometryGapThresholdMeters:2,
 geometryGapTransitionsInspected:0,geometryMaxGapMeters:0,geometryGapAdvisoryOnly:true,
 potentialAccessReviewEdges:1,potentialTurnRestrictionReviewCount:0,
 startSnapAmbiguous:false,endSnapAmbiguous:true
};
const noPath={ok:false,mode:'EXPERIMENTAL_SEGMENT_ROUTE',graphVersion:'road_graph_edges_v495',graphEdges:168221,
 error:'No directed path found',routingActivated:false,databaseWrites:0,
 trafficAware:false,timingMs:{graphLoad:12.25,snapping:3.45,pathSearch:78.65,total:94.35}};
const reply=(status,body,headers={'cache-control':'no-store'})=>async()=>({
 status,headers:new Headers(headers),json:async()=>body
});
test('collects actual experimental response metadata but never writes coordinates or secrets to evidence',async()=>{
 let request;
 const out=await collectEvidence([base],url,{fetchImpl:async(u,o)=>{
  request={u,o};return {status:200,headers:new Headers({'cache-control':'no-store'}),json:async()=>good};
 },authHeader:'Authorization',authValue:'Bearer secret-local-only'});
 assert.equal(out.length,1);assert.equal(out[0].responseStatus,200);assert.equal(out[0].ok,true);
 assert.equal(out[0].geometryContinuous,true);
 assert.equal(out[0].endSnapAmbiguous,true);
 assert.equal(request.o.headers.Authorization,'Bearer secret-local-only');
 assert.equal(request.o.redirect,'error');assert.equal(request.o.cache,'no-store');
 assert.equal(request.o.headers['cache-control'],'no-store');
 assert.ok(request.u.includes('startLat=3.14'));
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

test('even internally consistent but impossible stage durations are not archived',async()=>{
 for(const total of [60000.1,1e308]){
  const out=await collectEvidence([base],url,{fetchImpl:reply(200,{
   ...good,timingMs:{graphLoad:total,snapping:0,pathSearch:0,total}
  })});
  assert.equal(out[0].ok,true);
  assert.equal(out[0].geometryMetricsVerified,true);
  assert.equal(out[0].graphLoadMs,undefined);
  assert.equal(out[0].serverTotalMs,undefined);
 }
});

test('verified 422 snap miss is distinct from no-path and preserves bounded timing',async()=>{
 const body={ok:false,mode:'EXPERIMENTAL_SEGMENT_ROUTE',
  error:'No nearby directed graph segment within 200 m',
  routingActivated:false,databaseWrites:0,trafficAware:false,
  graphVersion:'road_graph_edges_v495',graphEdges:168221,graphCacheHit:false,
  legalDrivingRouteVerified:false,accessRestrictionsEnforced:false,
  turnRestrictionsEnforced:false,
  startSnapMeters:240,endSnapMeters:null,
  timingMs:{graphLoad:12,snapping:4,pathSearch:0,total:16}};
 const out=await collectEvidence([base],url,{fetchImpl:reply(422,body)});
 assert.equal(out[0].responseStatus,422);
 assert.equal(out[0].failureClass,'snap-out-of-range');
 assert.equal(out[0].graphEvidenceVerified,true);
 assert.equal(out[0].graphCacheHit,false);
 assert.equal(out[0].ok,false);
 assert.equal(out[0].noPathModeVerified,undefined);
 assert.equal(out[0].startSnapMeters,240);
 assert.equal(out[0].serverTotalMs,16);
});
test('untrusted 422 response cannot masquerade as verified snap failure',async()=>{
 const out=await collectEvidence([base],url,{fetchImpl:reply(422,{
  ok:false,error:'No nearby directed graph segment within 200 m',
  startSnapMeters:{secret:'DO_NOT_PERSIST'}
 })});
 assert.equal(out[0].failureClass,'unverified-experimental-response');
 assert.equal(out[0].startSnapMeters,undefined);
 assert.ok(!JSON.stringify(out).includes('DO_NOT_PERSIST'));
});

test('records only boolean cold versus cached graph metadata',async()=>{
 const cold=await collectEvidence([base],url,{fetchImpl:reply(200,{...good,graphCacheHit:false})});
 const warm=await collectEvidence([base],url,{fetchImpl:reply(200,{...good,graphCacheHit:true})});
 const malformed=await collectEvidence([base],url,{fetchImpl:reply(200,{...good,graphCacheHit:{secret:'DO_NOT_STORE'}})});
 assert.equal(cold[0].graphCacheHit,false);
 assert.equal(warm[0].graphCacheHit,true);
 assert.equal(malformed[0].graphCacheHit,null);
 assert.ok(!JSON.stringify(malformed).includes('DO_NOT_STORE'));
});
test('contradictory disconnected category is blocked before issuing HTTP requests',async()=>{
 let calls=0;
 await assert.rejects(()=>collectEvidence([{
  ...base,caseId:'kl-contradiction',journeyType:'disconnected',
  expectedReachable:true,disconnectionReviewed:true
 }],url,{fetchImpl:async()=>{calls++;return reply(200,good)();}}),/Disconnected journey/);
 assert.equal(calls,0);
});

test('only a bounded integer no-path search breadth is kept in private evidence',async()=>{
 const c={...base,caseId:'kl-visited',expectedReachable:false,
  journeyType:'disconnected',disconnectionReviewed:true};
 const goodCount=await collectEvidence([c],url,{fetchImpl:reply(404,{...noPath,searchVisitedNodes:157})});
 assert.equal(goodCount[0].searchVisitedNodes,157);
 assert.equal(goodCount[0].noPathModeVerified,true);
 for(const invalid of ['Bearer SECRET_ROUTE_TOKEN',{},[],NaN,-1,1.5,400001,Infinity]){
  const out=await collectEvidence([c],url,{fetchImpl:reply(404,{...noPath,searchVisitedNodes:invalid})});
  assert.equal(out[0].responseStatus,404);
  assert.equal(out[0].searchVisitedNodes,null);
  assert.ok(!JSON.stringify(out).includes('SECRET_ROUTE_TOKEN'));
 }
});
test('unknown service responses do not produce search-visit evidence',async()=>{
 const c={...base,caseId:'kl-bad-visited',expectedReachable:false,
  journeyType:'disconnected',disconnectionReviewed:true};
 const out=await collectEvidence([c],url,{fetchImpl:reply(404,{
  ...noPath,mode:'UNRELATED_SERVICE',searchVisitedNodes:15
 })});
 assert.equal(out[0].responseStatus,0);
 assert.equal(out[0].searchVisitedNodes,undefined);
});

test('accepted routes preserve a full-v495 provenance marker without recording graph metadata strings',async()=>{
 const out=await collectEvidence([base],url,{fetchImpl:reply(200,good)});
 assert.equal(out[0].graphEvidenceVerified,true);
 assert.ok(!JSON.stringify(out).includes('road_graph_edges_v495'));
});
test('incomplete or wrong-version graph cannot supply accepted route evidence',async()=>{
 for(const body of [
  {...good,graphEdges:1000},
  {...good,graphEdges:undefined},
  {...good,graphVersion:'road_graph_edges_v493'},
  {...good,graphEdges:'168221'}
 ]){
  const out=await collectEvidence([base],url,{fetchImpl:reply(200,body)});
  assert.equal(out[0].ok,false);
  assert.equal(out[0].failureClass,'unverified-experimental-response');
  assert.equal(out[0].graphEvidenceVerified,undefined);
  assert.equal(out[0].geometryMetricsVerified,undefined);
 }
});
test('incomplete-graph HTTP 404 cannot masquerade as reviewed KL disconnection',async()=>{
 const c={...base,caseId:'kl-incomplete-no-path',journeyType:'disconnected',
  expectedReachable:false,disconnectionReviewed:true};
 for(const body of [{...noPath,graphEdges:1000},{...noPath,graphVersion:'stale'}]){
  const out=await collectEvidence([c],url,{fetchImpl:reply(404,body)});
  assert.equal(out[0].responseStatus,0);
  assert.equal(out[0].noPathModeVerified,undefined);
  assert.equal(out[0].graphEvidenceVerified,undefined);
 }
});

test('reviewed no-path replies preserve only boolean cache-state diagnostics',async()=>{
 const c={...base,caseId:'kl-no-path-cache',journeyType:'disconnected',
  expectedReachable:false,disconnectionReviewed:true};
 for(const cached of [false,true]){
  const out=await collectEvidence([c],url,{fetchImpl:reply(404,{...noPath,graphCacheHit:cached})});
  assert.equal(out[0].responseStatus,404);
  assert.equal(out[0].graphCacheHit,cached);
  assert.equal(out[0].noPathModeVerified,true);
 }
 const bad=await collectEvidence([c],url,{fetchImpl:reply(404,{
  ...noPath,graphCacheHit:{secret:'SECRET_CACHE_METADATA'}
 })});
 assert.equal(bad[0].graphCacheHit,null);
 assert.ok(!JSON.stringify(bad).includes('SECRET_CACHE_METADATA'));
 const unrelated=await collectEvidence([c],url,{fetchImpl:reply(404,{
  ...noPath,mode:'NOT_JALAN',graphCacheHit:true
 })});
 assert.equal(unrelated[0].graphCacheHit,undefined);
});

// A syntactically valid route with matching endpoints is not complete pilot
// evidence if its server-side geometry gap audit is missing or inconsistent.
test('KL collector rejects missing geometry gap audit fields as continuity evidence',async()=>{
 for(const changed of [
  {geometryGapAdvisoryOnly:undefined},{geometryGapTransitionsInspected:undefined},
  {geometryMaxGapMeters:undefined},{geometryGapThresholdMeters:undefined},
  {geometryGapReviewAvailable:false}
 ]){
  const out=await collectEvidence([base],url,{fetchImpl:reply(200,{...good,...changed})});
  assert.equal(out[0].responseStatus,200);
  assert.equal(out[0].geometryMetricsVerified,true,'endpoint/distance cross-check remains independent');
  assert.equal(out[0].geometryContinuous,false,JSON.stringify(changed));
 }
});
test('KL collector rejects contradictory geometry-gap audits even with clean geometry',async()=>{
 for(const changed of [
  {geometryGapAdvisoryOnly:false},{geometryGapTransitionsInspected:-1},
  {geometryGapTransitionsInspected:0.5},{geometryGapThresholdMeters:-1},
  {geometryGapThresholdMeters:3},{geometryMaxGapMeters:-0.1},
  {geometryMaxGapMeters:3},{geometryGapCountOverThreshold:1}
 ]){
  const out=await collectEvidence([base],url,{fetchImpl:reply(200,{...good,...changed})});
  assert.equal(out[0].geometryContinuous,false,JSON.stringify(changed));
 }
});
test('KL collector does not persist arbitrary malformed geometry audit metadata',async()=>{
 const secret='PRIVATE_KL_GAP_REVIEW_TOKEN';
 const body={...good,geometryGapTransitionsInspected:{secret},
  geometryMaxGapMeters:[secret],geometryGapAdvisoryOnly:secret};
 const out=await collectEvidence([base],url,{fetchImpl:reply(200,body)});
 assert.equal(out[0].geometryContinuous,false);
 assert.equal(out[0].geometryMetricsVerified,true);
 assert.ok(!JSON.stringify(out).includes(secret));
});

test('cacheable or server-identifying successful replies cannot supply private KL route evidence',async()=>{
 for(const headers of [{},{'cache-control':'public, max-age=300'},
   {'cache-control':'no-store','x-powered-by':'Express'}]){
  const out=await collectEvidence([base],url,{fetchImpl:reply(200,good,headers)});
  assert.equal(out[0].ok,false);
  assert.equal(out[0].failureClass,'unverified-experimental-response');
  assert.equal(out[0].geometryMetricsVerified,undefined);
  assert.equal(out[0].distanceMeters,undefined);
  assert.ok(!JSON.stringify(out).includes('101.69'));
 }
});

test('cacheable disconnected-road HTTP 404 cannot count as independently reviewed no-path',async()=>{
 const c={...base,journeyType:'disconnected',expectedReachable:false,disconnectionReviewed:true};
 for(const headers of [{},{'cache-control':'max-age=60'},
   {'cache-control':'no-store','x-powered-by':'Express'}]){
  const out=await collectEvidence([c],url,{fetchImpl:reply(404,noPath,headers)});
  assert.equal(out[0].responseStatus,0);
  assert.equal(out[0].noPathModeVerified,undefined);
  assert.equal(out[0].graphEvidenceVerified,undefined);
  assert.equal(out[0].failureClass,'unverified-experimental-response');
 }
});

test('cacheable GPS-snap HTTP 422 cannot supply trusted failure diagnostics',async()=>{
 const miss={ok:false,mode:'EXPERIMENTAL_SEGMENT_ROUTE',
  error:'No nearby directed graph segment within 200 m',
  routingActivated:false,databaseWrites:0,trafficAware:false,
  startSnapMeters:240};
 for(const headers of [{},{'cache-control':'public, max-age=60'},
   {'cache-control':'no-store','x-powered-by':'Express'}]){
  const out=await collectEvidence([base],url,{fetchImpl:reply(422,miss,headers)});
  assert.equal(out[0].ok,false);
  assert.equal(out[0].failureClass,'unverified-experimental-response');
  assert.equal(out[0].startSnapMeters,undefined);
 }
});

test('KL collector rejects incomplete geometry transition coverage and invalid edge counts',async()=>{
 for(const changed of [
  {edgeCount:undefined},{edgeCount:0},{edgeCount:2},{edgeCount:'1'},
  {edgeCount:1.5},{edgeCount:168224},{geometryGapTransitionsInspected:1}
 ]){
  const out=await collectEvidence([base],url,{fetchImpl:reply(200,{...good,...changed})});
  assert.equal(out[0].responseStatus,200);
  assert.equal(out[0].geometryMetricsVerified,true,'geographic cross-check is independent');
  assert.equal(out[0].geometryContinuous,false,JSON.stringify(changed));
 }
});
test('KL collector accepts complete transition coverage for multi-edge routes',async()=>{
 const out=await collectEvidence([base],url,{fetchImpl:reply(200,{
  ...good,edgeCount:3,geometryGapTransitionsInspected:2
 })});
 assert.equal(out[0].geometryMetricsVerified,true);
 assert.equal(out[0].geometryContinuous,true);
});

test('KL 422 snap diagnostic refuses incomplete or stale graph provenance',async()=>{
 const snap={ok:false,mode:'EXPERIMENTAL_SEGMENT_ROUTE',
  error:'No nearby directed graph segment within 200 m',
  routingActivated:false,databaseWrites:0,trafficAware:false,
  legalDrivingRouteVerified:false,accessRestrictionsEnforced:false,turnRestrictionsEnforced:false,
  graphVersion:'road_graph_edges_v495',graphEdges:168221,
  startSnapMeters:241,endSnapMeters:null};
 for(const change of [
  {graphEdges:1000},{graphEdges:null},{graphEdges:'168221'},
  {graphVersion:'road_graph_edges_v493'},{graphVersion:undefined}
 ]){
  const out=await collectEvidence([base],url,{fetchImpl:reply(422,{...snap,...change})});
  assert.equal(out[0].failureClass,'unverified-experimental-response');
  assert.equal(out[0].graphEvidenceVerified,undefined);
  assert.equal(out[0].startSnapMeters,undefined);
 }
});
test('KL 422 snap diagnostic refuses unsupported or missing road safety flags',async()=>{
 const snap={ok:false,mode:'EXPERIMENTAL_SEGMENT_ROUTE',
  error:'No nearby directed graph segment within 200 m',
  routingActivated:false,databaseWrites:0,trafficAware:false,
  legalDrivingRouteVerified:false,accessRestrictionsEnforced:false,turnRestrictionsEnforced:false,
  graphVersion:'road_graph_edges_v495',graphEdges:168221,startSnapMeters:241,endSnapMeters:null};
 for(const flag of ['legalDrivingRouteVerified','accessRestrictionsEnforced','turnRestrictionsEnforced'])
  for(const value of [true,undefined]){
   const out=await collectEvidence([base],url,{fetchImpl:reply(422,{...snap,[flag]:value})});
   assert.equal(out[0].failureClass,'unverified-experimental-response');
   assert.equal(out[0].startSnapMeters,undefined);
  }
});
test('KL 422 evidence retains only sanitized boolean graph cache state',async()=>{
 const snap={ok:false,mode:'EXPERIMENTAL_SEGMENT_ROUTE',
  error:'No nearby directed graph segment within 200 m',
  routingActivated:false,databaseWrites:0,trafficAware:false,
  legalDrivingRouteVerified:false,accessRestrictionsEnforced:false,turnRestrictionsEnforced:false,
  graphVersion:'road_graph_edges_v495',graphEdges:168221,startSnapMeters:241,endSnapMeters:null};
 const out=await collectEvidence([base],url,{fetchImpl:reply(422,{
  ...snap,graphCacheHit:{secret:'PRIVATE_SNAP_CACHE_TOKEN'}
 })});
 assert.equal(out[0].failureClass,'snap-out-of-range');
 assert.equal(out[0].graphEvidenceVerified,true);
 assert.equal(out[0].graphCacheHit,null);
 assert.ok(!JSON.stringify(out).includes('PRIVATE_SNAP_CACHE_TOKEN'));
});

test('KL 422 snap evidence rejects responses with both reported snaps inside the 200 m boundary',async()=>{
 const snap={ok:false,mode:'EXPERIMENTAL_SEGMENT_ROUTE',
  error:'No nearby directed graph segment within 200 m',
  routingActivated:false,databaseWrites:0,trafficAware:false,
  legalDrivingRouteVerified:false,accessRestrictionsEnforced:false,turnRestrictionsEnforced:false,
  graphVersion:'road_graph_edges_v495',graphEdges:168221,
  startSnapMeters:0,endSnapMeters:199};
 for(const metrics of [
  {},{startSnapMeters:199,endSnapMeters:199},
  {startSnapMeters:null,endSnapMeters:null},
  {startSnapMeters:undefined,endSnapMeters:100}
 ]){
  const out=await collectEvidence([base],url,{fetchImpl:reply(422,{...snap,...metrics})});
  assert.equal(out[0].failureClass,'unverified-experimental-response');
  assert.equal(out[0].graphEvidenceVerified,undefined);
  assert.equal(out[0].startSnapMeters,undefined);
 }
});

test('KL 422 snap evidence allows rounded 200 m miss and either endpoint beyond threshold',async()=>{
 const snap={ok:false,mode:'EXPERIMENTAL_SEGMENT_ROUTE',
  error:'No nearby directed graph segment within 200 m',
  routingActivated:false,databaseWrites:0,trafficAware:false,
  legalDrivingRouteVerified:false,accessRestrictionsEnforced:false,turnRestrictionsEnforced:false,
  graphVersion:'road_graph_edges_v495',graphEdges:168221};
 for(const metrics of [
  {startSnapMeters:200,endSnapMeters:0},
  {startSnapMeters:0,endSnapMeters:201},
  {startSnapMeters:280,endSnapMeters:null}
 ]){
  const out=await collectEvidence([base],url,{fetchImpl:reply(422,{...snap,...metrics})});
  assert.equal(out[0].failureClass,'snap-out-of-range');
  assert.equal(out[0].responseStatus,422);
  assert.equal(out[0].graphEvidenceVerified,true);
  assert.equal(out[0].noPathModeVerified,undefined);
  assert.equal(out[0].ok,false);
 }
});

test('KL 422 snap evidence rejects malformed or implausible distance metrics without leaking metadata',async()=>{
 const snap={ok:false,mode:'EXPERIMENTAL_SEGMENT_ROUTE',
  error:'No nearby directed graph segment within 200 m',
  routingActivated:false,databaseWrites:0,trafficAware:false,
  legalDrivingRouteVerified:false,accessRestrictionsEnforced:false,turnRestrictionsEnforced:false,
  graphVersion:'road_graph_edges_v495',graphEdges:168221,
  startSnapMeters:250,endSnapMeters:0};
 for(const metrics of [
  {startSnapMeters:'250'},
  {startSnapMeters:Infinity},
  {startSnapMeters:-1,endSnapMeters:230},
  {startSnapMeters:{secret:'DO_NOT_COPY_422'},endSnapMeters:250},
  {startSnapMeters:400001},
  {endSnapMeters:undefined}
 ]){
  const out=await collectEvidence([base],url,{fetchImpl:reply(422,{...snap,...metrics})});
  assert.equal(out[0].failureClass,'unverified-experimental-response');
  assert.equal(out[0].graphEvidenceVerified,undefined);
  assert.ok(!JSON.stringify(out).includes('DO_NOT_COPY_422'));
 }
});
