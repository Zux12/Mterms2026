'use strict';
// Read-only KL validation quality gate: check actual case evidence without contacting the backend.
const test=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const fs=require('node:fs'),os=require('node:os');
const script=path.join(__dirname,'validate-kl-pilot.js');
function check(cases){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'jalan-validation-'));
 try{const file=path.join(dir,'cases.json');fs.writeFileSync(file,JSON.stringify(cases));
 const r=spawnSync(process.execPath,[script,file],{encoding:'utf8'});
 return {code:r.status,output:JSON.parse(r.stdout)};
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
test('pilot validation rejects duplicate case identifiers',()=>{
 const cases=[{caseId:'same',ok:false,elapsedMs:10},{caseId:'same',ok:false,elapsedMs:20}];
 const r=check(cases);assert.equal(r.code,1);assert.ok(r.output.validationErrors.some(x=>x.includes('duplicate')));
});
test('pilot validation refuses to publish snap or latency percentiles for incomplete journey metadata',()=>{
 const cases=[{caseId:'a',ok:true,elapsedMs:5,distanceMeters:100,startSnapMeters:3,endSnapMeters:8,geometryContinuous:true},
 {caseId:'b',ok:true,elapsedMs:6,distanceMeters:200,startSnapMeters:12,endSnapMeters:18,geometryContinuous:true}];
 const r=check(cases);assert.equal(r.code,1);assert.equal(r.output.snapMaxMeters,null);
 assert.equal(r.output.snapP95Meters,null);assert.equal(r.output.snapEndpointSamples,0);
 assert.equal(r.output.latencySamples,0);assert.equal(r.output.latencyP50Ms,null);
 assert.equal(r.output.successful,2);
 assert.equal(r.output.automatedEvidenceGatePassed,false);
});
test('pilot validation rejects missing geometry continuity confirmation',()=>{
 const r=check([{caseId:'bad',ok:true,elapsedMs:5,distanceMeters:100,startSnapMeters:1,endSnapMeters:2}]);
 assert.equal(r.code,1);assert.ok(r.output.validationErrors.some(x=>x.includes('continuity')));
});
