'use strict';
// KL pilot acceptance must never mistake synthetic or incomplete evidence for
// a production-ready navigation engine.
const test=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const script=path.join(__dirname,'validate-kl-pilot.js');
function run(cases){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'jalan-gate-'));
 try{
  const file=path.join(dir,'cases.json');fs.writeFileSync(file,JSON.stringify(cases));
  const r=spawnSync(process.execPath,[script,file],{encoding:'utf8'});
  return {code:r.status,summary:JSON.parse(r.stdout)};
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
const types=['short-urban','long-corridor','one-way','overpass','disconnected'];
function sample(i){
 const journeyType=types[i%types.length],reachable=journeyType!=='disconnected';
 return {caseId:'kl_'+i,journeyType,expectedReachable:reachable,ok:reachable,
 elapsedMs:12, ...(reachable?{distanceMeters:1200,startSnapMeters:4,endSnapMeters:5,geometryContinuous:true}:{disconnectionReviewed:true})};
}
test('20 complete records clear structural gate but never authorize production',()=>{
 const result=run(Array.from({length:20},(_,i)=>sample(i)));
 assert.equal(result.code,0);
 assert.equal(result.summary.automatedEvidenceGatePassed,true);
 assert.equal(result.summary.productionRoutingAuthorized,false);
 assert.equal(result.summary.manualRoadSafetyReviewRequired,true);
});
test('unexpected no-path in otherwise complete batch fails gate',()=>{
 const cases=Array.from({length:20},(_,i)=>sample(i));
 cases[0].ok=false;
 const result=run(cases);
 assert.equal(result.code,1);
 assert.equal(result.summary.automatedEvidenceGatePassed,false);
 assert.equal(result.summary.unexpectedNoPath,1);
});
