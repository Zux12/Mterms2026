'use strict';
// Synthetic evidence only. These tests do NOT validate actual KL journeys.
const test=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const cli=path.join(__dirname,'validate-kl-pilot.js');
const types=['short-urban','long-corridor','one-way','overpass','disconnected'];
function sample(i){
 const journeyType=types[i%types.length],ok=journeyType!=='disconnected';
 return {caseId:'synthetic_'+i,journeyType,expectedReachable:ok,ok,
  elapsedMs:23+i,...(ok?{distanceMeters:800+i,startSnapMeters:5,endSnapMeters:6,
   geometryContinuous:true}:{disconnectionReviewed:true})};
}
function run(cases){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'jalan-gate-'));
 const file=path.join(dir,'cases.json');
 try{
  fs.writeFileSync(file,JSON.stringify(cases));
  const proc=spawnSync(process.execPath,[cli,file],{encoding:'utf8',timeout:10000});
  assert.equal(proc.error,undefined);
  return {status:proc.status,summary:proc.stdout?JSON.parse(proc.stdout):null,stderr:proc.stderr};
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
test('20 structurally complete synthetic cases clear only the evidence gate, not production routing',()=>{
 const r=run(Array.from({length:20},(_,i)=>sample(i)));
 assert.equal(r.status,0);
 assert.equal(r.summary.automatedEvidenceGatePassed,true);
 assert.equal(r.summary.manualRoadSafetyReviewRequired,true);
 assert.equal(r.summary.productionRoutingAuthorized,false);
 assert.equal(r.summary.expectedNoPath,4);
 assert.equal(r.summary.unexpectedNoPath,0);
 assert.equal(r.summary.successful,16);
 assert.equal(r.summary.snapMedianMeters,5);
 assert.equal(r.summary.snapP95Meters,6);
 assert.deepEqual(r.summary.missingJourneyTypes,[]);
});
test('one case with valid structure remains incomplete, exit code 2',()=>{
 const r=run([sample(0)]);
 assert.equal(r.status,2);
 assert.equal(r.summary.automatedEvidenceGatePassed,false);
 assert.equal(r.summary.minimumCases,20);
 assert.equal(r.summary.validationErrors.length,0);
 assert.equal(r.summary.missingJourneyTypes.length,4);
});
test('all five journey categories with fewer than 20 cases remains incomplete',()=>{
 const r=run(Array.from({length:5},(_,i)=>sample(i)));
 assert.equal(r.status,2);
 assert.deepEqual(r.summary.missingJourneyTypes,[]);
 assert.equal(r.summary.automatedEvidenceGatePassed,false);
});
test('duplicate case IDs cannot inflate coverage',()=>{
 const cases=Array.from({length:20},(_,i)=>sample(i));
 cases[1].caseId=cases[0].caseId;
 const r=run(cases);
 assert.equal(r.status,1);
 assert.ok(r.summary.validationErrors.some(x=>x.includes('duplicate ID')));
 assert.equal(r.summary.automatedEvidenceGatePassed,false);
});
test('unexpected no-path cannot be treated as acceptable',()=>{
 const cases=Array.from({length:20},(_,i)=>sample(i));
 cases[0].ok=false;
 const r=run(cases);
 assert.equal(r.status,1);
 assert.equal(r.summary.unexpectedNoPath,1);
 assert.ok(r.summary.validationErrors.some(x=>x.includes('reachability differs')));
});
test('expected no-path needs independent disconnected-road review',()=>{
 const cases=Array.from({length:20},(_,i)=>sample(i));
 delete cases[4].disconnectionReviewed;
 const r=run(cases);
 assert.equal(r.status,1);
 assert.ok(r.summary.validationErrors.some(x=>x.includes('disconnection review')));
});
test('successful routes snapped beyond preview 200m bound fail evidence gate',()=>{
 const cases=Array.from({length:20},(_,i)=>sample(i));
 cases[0].endSnapMeters=201;
 const r=run(cases);
 assert.equal(r.status,1);
 assert.equal(r.summary.snapOver200Meters,1);
 assert.ok(r.summary.validationErrors.some(x=>x.includes('exceeds 200 m')));
});
test('missing geometry review and malformed numerical observations fail closed',()=>{
 const cases=Array.from({length:20},(_,i)=>sample(i));
 cases[0].geometryContinuous=false;
 cases[1].elapsedMs=-2;
 cases[2].distanceMeters=null;
 const r=run(cases);
 assert.equal(r.status,1);
 assert.ok(r.summary.validationErrors.some(x=>x.includes('geometry continuity')));
 assert.ok(r.summary.validationErrors.some(x=>x.includes('invalid elapsedMs')));
 assert.ok(r.summary.validationErrors.some(x=>x.includes('invalid distanceMeters')));
});
test('empty evidence input cannot report a passing gate',()=>{
 const r=run([]);
 assert.notEqual(r.status,0);
 assert.equal(r.summary,null);
});
