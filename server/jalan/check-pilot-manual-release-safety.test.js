'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {preflight}=require('./check-pilot-manual-release-safety');
const {APPS}=require('./audit-heroku-retention-metadata-readonly');
const privateId=APPS.find(x=>x.role==='private').id;
const uri='mongodb+srv://jalan_readonly:dummy@example.mongodb.net/jalan_navigation';
const validConfig=()=>({
 JALAN_READONLY_MONGODB_URI:uri,JALAN_PILOT_ACCESS_PASSWORD:'P'.repeat(50),
 JALAN_PREVIEW_TOKEN:'T'.repeat(50),JALAN_PILOT_MODE:'EXPERIMENTAL_SEGMENT_ROUTE',
 JALAN_DATABASE_WRITES_ENABLED:'false',JALAN_TURN_ENFORCEMENT_ENABLED:'false',
 NODE_ENV:'production'
});
function fixture({eligible=true,priorConfig=validConfig(),wrongIdentity=false,versionDrift=false}={}){
 const calls=[],releases=[
  {id:'new',version:15,status:'succeeded',slug:{id:'newslug'}},
  {id:'old',version:14,status:'succeeded',slug:{id:'oldslug'},eligible_for_rollback:eligible}
 ];
 let releaseReads=0;
 const fetcher=async(url,options)=>{
  const path=new URL(url).pathname;
  calls.push({path,method:options.method||'GET',body:options.body});
  let data;
  if(path==='/apps/'+privateId)data={id:wrongIdentity?'wrong':privateId,name:'jalan-kl-private-pilot'};
  else if(path==='/apps/jalan-kl-private-pilot')data={id:privateId,name:'jalan-kl-private-pilot'};
  else if(path==='/apps/jalan-kl-private-pilot/releases'){
   releaseReads++;
   data=versionDrift&&releaseReads>1?[
    {id:'next',version:16,status:'succeeded',slug:{id:'nextslug'}},...releases
   ]:releases;
  }
  else if(path.endsWith('/slugs/newslug'))data={id:'newslug',commit:'a'.repeat(40)};
  else if(path.endsWith('/slugs/oldslug'))data={id:'oldslug',commit:'b'.repeat(40)};
  else if(path.endsWith('/releases/new/config-vars'))data=validConfig();
  else if(path.endsWith('/releases/next/config-vars'))data=validConfig();
  else if(path.endsWith('/releases/old/config-vars'))data=priorConfig;
  else throw Error('unexpected preflight request '+path);
  return {ok:true,status:200,json:async()=>data};
 };
 return {fetcher,calls};
}
test('eligible identical-config code snapshot passes without touching Heroku',async()=>{
 const f=fixture(),logs=[];
 const out=await preflight({fetcher:f.fetcher,key:'K'.repeat(40),expectedUri:uri,log:s=>logs.push(s)});
 assert.equal(out.appIdentityPinned,true);
 assert.equal(out.priorVersion,14);
 assert.equal(out.restoreTested,false);
 assert.ok(f.calls.length>=7);
 assert.ok(f.calls.every(x=>x.method==='GET'&&x.body===undefined));
 assert.doesNotMatch(logs.join(' '),/dummy@example|PPPP|TTTT|newslug|oldslug|Bearer/);
});
test('unknown or denied rollback eligibility cannot authorize deployment',async()=>{
 for(const eligible of [false,undefined]){
  const f=fixture({eligible});
  await assert.rejects(preflight({fetcher:f.fetcher,key:'K'.repeat(40),expectedUri:uri,log:()=>{}}),
   /restore-not-verified/);
  assert.ok(f.calls.every(x=>x.method==='GET'));
 }
});
test('prior different preview token blocks despite a valid slug',async()=>{
 const f=fixture({priorConfig:{...validConfig(),JALAN_PREVIEW_TOKEN:'X'.repeat(50)}});
 await assert.rejects(preflight({fetcher:f.fetcher,key:'K'.repeat(40),expectedUri:uri,log:()=>{}}),
  /restore-not-verified/);
});
test('wrong immutable app identity stops before release queries',async()=>{
 const f=fixture({wrongIdentity:true});
 await assert.rejects(preflight({fetcher:f.fetcher,key:'K'.repeat(40),expectedUri:uri,log:()=>{}}),
  /identity-mismatch/);
 assert.equal(f.calls.length,1);
});
test('release-version race across separate reads is rejected',async()=>{
 const f=fixture({versionDrift:true});
 await assert.rejects(preflight({fetcher:f.fetcher,key:'K'.repeat(40),expectedUri:uri,log:()=>{}}),
  /restore-not-verified/);
});
