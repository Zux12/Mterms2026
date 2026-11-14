'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {evaluateConfig,audit}=require('./audit-heroku-pilot-config-readonly');
const uri='mongodb+srv://jalan_readonly:fakepass@example.mongodb.net/jalan_navigation';
const basic='B'.repeat(64),token='T'.repeat(64);
function config(){return {JALAN_READONLY_MONGODB_URI:uri,
 JALAN_PILOT_ACCESS_PASSWORD:basic,JALAN_PREVIEW_TOKEN:token,
 JALAN_PILOT_MODE:'EXPERIMENTAL_SEGMENT_ROUTE',
 JALAN_DATABASE_WRITES_ENABLED:'false',
 JALAN_TURN_ENFORCEMENT_ENABLED:'false',NODE_ENV:'production'};}
test('compliant private app config is a read-only release candidate',()=>{
 assert.deepEqual(evaluateConfig(config(),uri),{ready:true,failures:[]});
});
test('wrong read-only URI and missing safety flags block readiness without revealing values',()=>{
 const c={...config(),JALAN_READONLY_MONGODB_URI:'different-secret',JALAN_DATABASE_WRITES_ENABLED:'true'};
 const x=evaluateConfig(c,uri);
 assert.equal(x.ready,false);
 assert.ok(x.failures.includes('readonly-uri-mismatch'));
 assert.ok(x.failures.includes('flag-jalan_database_writes_enabled-mismatch'));
 assert.ok(!JSON.stringify(x).includes('different-secret'));
});
test('missing/identical authentication and invalid expected readonly URI are blocked',()=>{
 const c={...config(),JALAN_PILOT_ACCESS_PASSWORD:'short',JALAN_PREVIEW_TOKEN:'short'};
 assert.equal(evaluateConfig(c,uri).ready,false);
 assert.ok(evaluateConfig(config(),'mongodb+srv://writer:password@example.mongodb.net').failures.includes('expected-readonly-credential-invalid'));
});
test('audit calls only expected Heroku GET endpoints and keeps secrets out of output',async()=>{
 const calls=[],logs=[];
 const fetcher=async(url,opts)=>{
  const p=new URL(url).pathname;
  calls.push({path:p,method:opts.method,body:opts.body});
  const data=p==='/apps/mterm2026'?{id:'original'}:
   p==='/apps/jalan-kl-private-pilot'?{id:'separate',name:'jalan-kl-private-pilot'}:
   p==='/apps/jalan-kl-private-pilot/config-vars'?config():
   (()=>{throw Error('Unexpected endpoint')})();
  return {ok:true,json:async()=>data};
 };
 const result=await audit({fetcher,key:'A'.repeat(32),expectedUri:uri,log:x=>logs.push(x)});
 assert.equal(result.ready,true);
 assert.deepEqual(calls.map(c=>c.method),['GET','GET','GET']);
 assert.ok(calls.every(c=>c.body===undefined));
 const printed=logs.join(' ');
 for(const secret of [uri,basic,token,'fakepass'])assert.ok(!printed.includes(secret));
});
