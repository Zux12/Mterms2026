'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {compatibility,audit}=require('./audit-heroku-pilot-release-config-readonly');
const uri='mongodb+srv://jalan_readonly:dummy@example.mongodb.net/jalan_navigation';
function config(){return {
 JALAN_READONLY_MONGODB_URI:uri,JALAN_PILOT_ACCESS_PASSWORD:'P'.repeat(50),
 JALAN_PREVIEW_TOKEN:'T'.repeat(50),JALAN_PILOT_MODE:'EXPERIMENTAL_SEGMENT_ROUTE',
 JALAN_DATABASE_WRITES_ENABLED:'false',JALAN_TURN_ENFORCEMENT_ENABLED:'false',
 NODE_ENV:'production'};
}
test('matching read-only and auth/config snapshot is compatible without restore',()=>{
 assert.deepEqual(compatibility(config(),config(),uri),{compatible:true,reasons:[]});
});
test('prior secret and mode differences block rollback compatibility',()=>{
 const old={...config(),JALAN_PREVIEW_TOKEN:'X'.repeat(50),
  JALAN_DATABASE_WRITES_ENABLED:'true'};
 const c=compatibility(config(),old,uri);
 assert.equal(c.compatible,false);
 assert.ok(c.reasons.includes('jalan_preview_token-mismatch'));
 assert.ok(c.reasons.includes('safety-jalan_database_writes_enabled-mismatch'));
 assert.doesNotMatch(JSON.stringify(c),/dummy@example|XXXXXXXX/);
});
test('pilot release history and versioned configs are fetched with GET only',async()=>{
 const calls=[],logs=[];
 const fetcher=async(url,opts)=>{
  const path=new URL(url).pathname;calls.push({path,method:opts.method,body:opts.body});
  let data;
  if(path==='/apps/jalan-kl-private-pilot')data={id:'pilot-id',name:'jalan-kl-private-pilot'};
  else if(path==='/apps/jalan-kl-private-pilot/releases')data=[
   {id:'current',version:15,status:'succeeded',slug:{id:'slug-v15'}},
   {id:'previous',version:14,status:'succeeded',slug:{id:'slug-v14'},eligible_for_rollback:true}];
  else if(/\/releases\/(current|previous)\/config-vars$/.test(path))data=config();
  else throw Error('unexpected endpoint '+path);
  return {ok:true,json:async()=>data};
 };
 const r=await audit({fetcher,key:'K'.repeat(40),expectedUri:uri,log:x=>logs.push(x)});
 assert.equal(r.compatible,true);assert.equal(r.eligible,'confirmed');
 assert.equal(r.restoreTested,false);
 assert.deepEqual(calls.map(x=>x.method),['GET','GET','GET','GET']);
 assert.ok(calls.every(x=>x.body===undefined));
 assert.doesNotMatch(logs.join(' '),/dummy@example|PPPPP|TTTTT/);
});
test('unknown Heroku eligibility cannot be claimed approved',async()=>{
 const calls=[];
 const fetcher=async(url,opts)=>{
  const p=new URL(url).pathname;calls.push(p);
  const data=p==='/apps/jalan-kl-private-pilot'?{id:'pilot',name:'jalan-kl-private-pilot'}:
   p==='/apps/jalan-kl-private-pilot/releases'?[
    {id:'current',version:15,status:'succeeded',slug:{id:'v15'}},
    {id:'prior',version:14,status:'succeeded',slug:{id:'v14'}}]:config();
  return {ok:true,json:async()=>data};
 };
 const r=await audit({fetcher,key:'K'.repeat(40),expectedUri:uri,log:()=>{}});
 assert.equal(r.eligible,'unknown');
});
