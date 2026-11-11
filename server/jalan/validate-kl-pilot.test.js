'use strict';
// Offline-only acceptance-gate regression tests. No GPS requests or DB connections.
const test=require('node:test'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {mkdtempSync,writeFileSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {join}=require('node:path');

const kinds=['short-urban','long-corridor','one-way','overpass','disconnected'];
function twentyValid(){
 return kinds.flatMap((kind,k)=>Array.from({length:4},(_,i)=>{
  const unreachable=kind==='disconnected';
  return {
   caseId:`kl-${k}-${i}`,journeyType:kind,expectedReachable:!unreachable,
   ok:!unreachable,responseStatus:unreachable?404:200,elapsedMs:k*100+i,
   ...(unreachable?{disconnectionReviewed:true,noPathModeVerified:true}:{
    routeModeVerified:true,distanceMeters:1000+k*100,startSnapMeters:5,endSnapMeters:8,
    geometryContinuous:true,geometryMetricsVerified:true
   })
  };
 }));
}
function run(cases){
 const dir=mkdtempSync(join(tmpdir(),'jalan-accept-'));
 try{
  const file=join(dir,'cases.json');writeFileSync(file,JSON.stringify(cases));
  const out=spawnSync(process.execPath,[join(__dirname,'validate-kl-pilot.js'),file],{encoding:'utf8',timeout:5000});
  assert.equal(out.error,undefined);assert.ok(out.stdout,'CLI did not return summary');
  return {status:out.status,summary:JSON.parse(out.stdout)};
 }finally{rmSync(dir,{recursive:true,force:true});}
}
test('exactly four independently reviewed journeys in each category satisfy structural gate',()=>{
 const {status,summary}=run(twentyValid());
 assert.equal(status,0);assert.equal(summary.automatedEvidenceGatePassed,true);
 assert.equal(summary.minimumPerJourneyType,4);
 assert.deepEqual(summary.insufficientJourneyTypes,[]);
 assert.equal(summary.expectedNoPath,4);
 assert.equal(summary.latencyP50Ms,201);
 assert.equal(summary.latencyP95Ms,402);
 assert.equal(summary.latencyMaxMs,403);
 assert.equal(summary.productionRoutingAuthorized,false);
});
test('20 cases with only one example in four categories cannot pass',()=>{
 const rows=twentyValid();
 // Keep the last example from each of four classes, but overweight urban.
 for(let k=1;k<5;k++)for(let i=0;i<3;i++)rows[k*4+i].journeyType='short-urban';
 const {status,summary}=run(rows);
 assert.equal(status,2);assert.equal(summary.cases,20);
 assert.equal(summary.automatedEvidenceGatePassed,false);
 assert.deepEqual(summary.insufficientJourneyTypes,kinds.slice(1));
 assert.equal(summary.journeyTypeCounts['short-urban'],16);
});
test('route 503 outage cannot masquerade as reviewed disconnection',()=>{
 const rows=twentyValid();rows[19].responseStatus=503;
 const {status,summary}=run(rows);
 assert.equal(status,1);
 assert.ok(summary.validationErrors.some(x=>x.includes('HTTP 404')));
 assert.equal(summary.automatedEvidenceGatePassed,false);
});
test('HTTP 422 snap failure cannot masquerade as reviewed disconnection',()=>{
 const rows=twentyValid();rows[19].responseStatus=422;
 const {status,summary}=run(rows);
 assert.equal(status,1);
 assert.equal(summary.automatedEvidenceGatePassed,false);
});
test('positive route requires HTTP 200 outcome',()=>{
 const rows=twentyValid();rows[0].responseStatus=302;
 const {status,summary}=run(rows);
 assert.equal(status,1);
 assert.equal(summary.automatedEvidenceGatePassed,false);
});
test('missing HTTP status is rejected rather than treated as evidence',()=>{
 const rows=twentyValid();delete rows[0].responseStatus;
 const {status,summary}=run(rows);
 assert.equal(status,1);
 assert.equal(summary.automatedEvidenceGatePassed,false);
});
test('review flag is required for every expected disconnected case',()=>{
 const rows=twentyValid();rows[16].disconnectionReviewed=false;
 const {status,summary}=run(rows);
 assert.equal(status,1);
 assert.ok(summary.validationErrors.some(x=>x.includes('disconnection review')));
});


test('structurally valid routes lacking experimental response verification fail closed',()=>{
 const rows=twentyValid();delete rows[0].routeModeVerified;
 const {status,summary}=run(rows);
 assert.equal(status,1);
 assert.equal(summary.automatedEvidenceGatePassed,false);
 assert.ok(summary.validationErrors.some(x=>x.includes('experimental route response not verified')));
});
test('reviewed HTTP 404 without experimental no-path verification cannot pass',()=>{
 const rows=twentyValid();delete rows[19].noPathModeVerified;
 const {status,summary}=run(rows);
 assert.equal(status,1);
 assert.equal(summary.automatedEvidenceGatePassed,false);
 assert.ok(summary.validationErrors.some(x=>x.includes('experimental no-path response not verified')));
});

test('asserted geometry continuity without independent endpoint/distance check cannot pass',()=>{
 const rows=twentyValid();
 delete rows[0].geometryMetricsVerified;
 const {status,summary}=run(rows);
 assert.equal(status,1);
 assert.equal(summary.automatedEvidenceGatePassed,false);
 assert.ok(summary.validationErrors.some(x=>x.includes('independent geometry metrics not verified')));
});
test('explicitly failed independent geometry metrics prevent acceptance even with clean continuity claim',()=>{
 const rows=twentyValid();
 rows[0].geometryMetricsVerified=false;
 rows[0].geometryContinuous=true;
 const {status,summary}=run(rows);
 assert.equal(status,1);
 assert.equal(summary.automatedEvidenceGatePassed,false);
 assert.ok(summary.validationErrors.some(x=>x.includes('independent geometry metrics not verified')));
});

test('reports server stage p50/p95/max only for consistent timing breakdowns',()=>{
 const rows=twentyValid();
 Object.assign(rows[0],{graphLoadMs:10,snappingMs:3,pathSearchMs:2,serverTotalMs:15});
 Object.assign(rows[1],{graphLoadMs:50,snappingMs:4,pathSearchMs:6,serverTotalMs:60});
 Object.assign(rows[2],{graphLoadMs:5,snappingMs:3,pathSearchMs:2,serverTotalMs:1});
 const {status,summary}=run(rows);
 assert.equal(status,0);
 assert.equal(summary.automatedEvidenceGatePassed,true);
 assert.equal(summary.serverTimingSamples,2);
 assert.deepEqual(summary.serverTimingByStageMs.graphLoadMs,{p50:10,p95:50,max:50});
 assert.deepEqual(summary.serverTimingByStageMs.pathSearchMs,{p50:2,p95:6,max:6});
 assert.deepEqual(summary.serverTimingByStageMs.serverTotalMs,{p50:15,p95:60,max:60});
});
test('no optional server timings yields null distributions instead of misleading zeros',()=>{
 const {status,summary}=run(twentyValid());
 assert.equal(status,0);
 assert.equal(summary.serverTimingSamples,0);
 assert.deepEqual(summary.serverTimingByStageMs.snappingMs,{p50:null,p95:null,max:null});
});
test('partial or nonfinite timings are not counted as complete measurements',()=>{
 const rows=twentyValid();
 Object.assign(rows[0],{graphLoadMs:5,snappingMs:3,pathSearchMs:2});
 Object.assign(rows[1],{graphLoadMs:-1,snappingMs:3,pathSearchMs:2,serverTotalMs:4});
 const {status,summary}=run(rows);
 assert.equal(status,0);
 assert.equal(summary.serverTimingSamples,0);
});

test('422 GPS snap failure timings cannot contaminate accepted route percentiles',()=>{
 const cases=twentyValid();
 for(const c of cases)Object.assign(c,{graphLoadMs:10,snappingMs:2,pathSearchMs:3,serverTotalMs:15});
 Object.assign(cases[0],{ok:false,responseStatus:422,routeModeVerified:false,
  failureClass:'snap-out-of-range',graphLoadMs:10000,snappingMs:2000,
  pathSearchMs:0,serverTotalMs:12000});
 const r=run(cases);
 assert.equal(r.status,1);
 assert.equal(r.summary.serverTimingSamples,19);
 assert.ok(r.summary.validationErrors.some(x=>x.includes('responseStatus')));
});

test('unverified geometry does not contaminate latency, snap or server timing distributions',()=>{
 const cases=twentyValid();
 for(const c of cases)Object.assign(c,{graphLoadMs:5,snappingMs:3,pathSearchMs:2,serverTotalMs:10});
 Object.assign(cases[0],{geometryMetricsVerified:false,elapsedMs:900000,
  startSnapMeters:199,endSnapMeters:199,
  graphLoadMs:10000,snappingMs:2000,pathSearchMs:3000,serverTotalMs:15000});
 const r=run(cases);
 assert.equal(r.status,1);
 assert.equal(r.summary.automatedEvidenceGatePassed,false);
 assert.equal(r.summary.latencySamples,19);
 assert.equal(r.summary.latencyMaxMs,403);
 assert.equal(r.summary.snapEndpointSamples,30); // 15 verified routes, two endpoints each
 assert.equal(r.summary.snapP95Meters,8);
 assert.equal(r.summary.serverTimingSamples,19);
 assert.equal(r.summary.serverTimingByStageMs.serverTotalMs.max,10);
});
test('unreviewed disconnected-road response is excluded from performance statistics',()=>{
 const cases=twentyValid();
 Object.assign(cases[19],{disconnectionReviewed:false,elapsedMs:500000,
  graphLoadMs:5000,snappingMs:1000,pathSearchMs:2000,serverTotalMs:8000});
 const r=run(cases);
 assert.equal(r.status,1);
 assert.equal(r.summary.latencySamples,19);
 assert.equal(r.summary.latencyMaxMs,402);
 assert.equal(r.summary.serverTimingSamples,0);
 assert.ok(r.summary.validationErrors.some(x=>x.includes('disconnection review')));
});
test('out-of-range snap is reported as an error without biasing accepted snap percentiles',()=>{
 const cases=twentyValid();
 Object.assign(cases[1],{startSnapMeters:241,endSnapMeters:5,elapsedMs:700000});
 const r=run(cases);
 assert.equal(r.status,1);
 assert.equal(r.summary.snapOver200Meters,1);
 assert.equal(r.summary.snapEndpointSamples,30); // 15 verified routes, two endpoints each
 assert.equal(r.summary.snapP95Meters,8);
 assert.equal(r.summary.latencySamples,19);
 assert.equal(r.summary.latencyMaxMs,403);
});
test('unreasonable server timing is never reported as an accepted performance sample',()=>{
 const cases=twentyValid();
 Object.assign(cases[0],{graphLoadMs:60001,snappingMs:0,pathSearchMs:0,serverTotalMs:60001});
 const r=run(cases);
 assert.equal(r.status,0);
 assert.equal(r.summary.serverTimingSamples,0);
 assert.equal(r.summary.serverTimingByStageMs.serverTotalMs.p95,null);
});

test('verified cold and warm routes have separate timing summaries',()=>{
 const cases=twentyValid();
 for(const c of cases)Object.assign(c,{graphLoadMs:8,snappingMs:2,pathSearchMs:1,serverTotalMs:11,graphCacheHit:true});
 Object.assign(cases[0],{graphLoadMs:100,snappingMs:2,pathSearchMs:1,serverTotalMs:103,graphCacheHit:false});
 const r=run(cases);
 assert.equal(r.status,0);
 assert.equal(r.summary.graphCacheTimingByStatusMs.cold.samples,1);
 assert.equal(r.summary.graphCacheTimingByStatusMs.cold.p50,103);
 assert.equal(r.summary.graphCacheTimingByStatusMs.warm.samples,19);
 assert.equal(r.summary.graphCacheTimingByStatusMs.warm.p95,11);
});
test('unverified route and malformed cache status never contaminate cold warm metrics',()=>{
 const cases=twentyValid();
 for(const c of cases)Object.assign(c,{graphLoadMs:8,snappingMs:2,pathSearchMs:1,serverTotalMs:11,graphCacheHit:'unknown'});
 Object.assign(cases[0],{graphCacheHit:false,geometryMetricsVerified:false,serverTotalMs:10003,graphLoadMs:10000});
 const r=run(cases);
 assert.equal(r.status,1);
 assert.equal(r.summary.graphCacheTimingByStatusMs.cold.samples,0);
 assert.equal(r.summary.graphCacheTimingByStatusMs.warm.samples,0);
 assert.equal(r.summary.graphCacheTimingByStatusMs.cold.p50,null);
});
