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
    geometryContinuous:true
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
