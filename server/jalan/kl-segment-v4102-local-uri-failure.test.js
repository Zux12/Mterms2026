'use strict';
// Failure-path regression for the isolated, read-only KL full-graph runner.
// Uses only deliberately invalid dummy URIs and public OSM-node fixtures.
// Never contacts Atlas, opens a route endpoint, or writes database records.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const runner=path.join(__dirname,'run-kl-local-readonly.js');

function runFailureCase(uri){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'jalan-readonly-uri-'));
 const input=path.join(dir,'public-osm-case.json');
 const output=path.join(dir,'evidence.json');
 // This is a static public OSM-node fixture, never a driver's GPS trace.
 const sample=[{caseId:'public_osm_failure_preflight',journeyType:'short-urban',
   expectedReachable:true,startLat:3.1315707,startLng:101.7038508,
   endLat:3.1314573,endLng:101.7038951}];
 try{
  fs.writeFileSync(input,JSON.stringify(sample),{mode:0o600});
  const env={...process.env};
  if(uri===null)delete env.JALAN_READONLY_MONGODB_URI;
  else env.JALAN_READONLY_MONGODB_URI=uri;
  const result=spawnSync(process.execPath,[runner,input,output],{
   encoding:'utf8',env,timeout:8000,maxBuffer:1024*1024
  });
  return {...result,evidenceCreated:fs.existsSync(output)};
 }finally{
  fs.rmSync(dir,{recursive:true,force:true});
 }
}
test('malformed Mongo URI produces a fixed category without disclosing secret or coordinates',()=>{
 const secret='TEST_SECRET_MUST_NEVER_APPEAR_128';
 const result=runFailureCase('invalid-scheme://'+secret);
 assert.equal(result.error,undefined);
 assert.equal(result.signal,null);
 assert.equal(result.status,1);
 assert.match(result.stderr,/stage: mongodb-connect; category: connection-uri-format \(missing-mongodb-uri-scheme\)/);
 assert.doesNotMatch(result.stderr,new RegExp(secret));
 assert.doesNotMatch(result.stderr,/3\.1315707|101\.7038508/);
 assert.doesNotMatch(result.stderr,/mongodb\+srv:\/\/|MongoParseError:|at .*run-kl-local-readonly\.js/);
 assert.equal(result.evidenceCreated,false);
});
test('surrounding shell quotation marks are classified without revealing URI text',()=>{
 const secret='TEST_SECRET_MUST_NOT_BE_ECHOED_129';
 const uri='"mongodb+srv://readuser:'+secret+'@example.invalid/jalan_navigation"';
 const result=runFailureCase(uri);
 assert.equal(result.error,undefined);
 assert.equal(result.status,1);
 assert.match(result.stderr,/category: connection-uri-format \(surrounding-quotation-marks\)/);
 assert.doesNotMatch(result.stderr,new RegExp(secret));
 assert.equal(result.evidenceCreated,false);
});
test('missing read-only URI fails before database use or evidence creation',()=>{
 const result=runFailureCase(null);
 assert.equal(result.error,undefined);
 assert.equal(result.status,1);
 assert.match(result.stderr,/stage: initialization/);
 assert.doesNotMatch(result.stderr,/mongodb\+srv:\/\/|3\.1315707|101\.7038508/);
 assert.equal(result.evidenceCreated,false);
});
