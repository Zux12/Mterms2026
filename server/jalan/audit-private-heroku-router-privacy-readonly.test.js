'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {audit,requireEnabledForCodePromotion,mayRunLegacyCoordinateGet}=require('./audit-private-heroku-router-privacy-readonly');
const key='K'.repeat(32);
function fixture({enabled=true,featureStatus=200,drains=1,appName='jalan-kl-private-pilot'}={}){
 const calls=[],output=[];
 const fetcher=async(url,opts)=>{
  const path=new URL(url).pathname;
  calls.push({path,method:opts.method,body:opts.body});
  if(opts.method!=='GET'||opts.body!==undefined)throw Error('unexpected-heroku-mutation');
  let status=200,data;
  if(path==='/apps/jalan-kl-private-pilot')data={name:appName,id:'test-pilot-id'};
  else if(path==='/apps/jalan-kl-private-pilot/features/http-router-no-log-query'){
   if(featureStatus===404)status=404;
   else data={name:'http-router-no-log-query',enabled};
  }else if(path==='/apps/jalan-kl-private-pilot/log-drains'){
   data=Array.from({length:drains},(_,i)=>({url:'https://private-sink-'+i+'.invalid',token:'TEST_SECRET_'+i}));
  }else throw Error('Unexpected API path '+path);
  return {status,ok:status===200,json:async()=>data};
 };
 return {calls,output,fetcher};
}
test('enabled private-pilot router flag is observed by three GETs with no secret output',async()=>{
 const f=fixture();
 const r=await audit({fetcher:f.fetcher,key,log:x=>f.output.push(x)});
 assert.deepEqual(r,{state:'enabled',drainCount:1});
 assert.deepEqual(f.calls.map(c=>c.method),['GET','GET','GET']);
 assert.ok(f.calls.every(c=>c.body===undefined));
 assert.doesNotMatch(f.output.join(' '),/private-sink|TEST_SECRET/);
});
test('private router flag disabled is explicitly reported as not protected',async()=>{
 const f=fixture({enabled:false});
 const r=await audit({fetcher:f.fetcher,key,log:x=>f.output.push(x)});
 assert.equal(r.state,'disabled');
 assert.match(f.output.join(' '),/disabled/);
});
test('unsupported private feature is not claimed enabled',async()=>{
 const f=fixture({featureStatus:404,drains:0});
 const r=await audit({fetcher:f.fetcher,key,log:x=>f.output.push(x)});
 assert.equal(r.state,'unavailable');
});
test('manual code release gate refuses disabled, unsupported or unknown router redaction',()=>{
 for(const state of ['disabled','unavailable',undefined]){
  assert.throws(()=>requireEnabledForCodePromotion({state}),/redaction-not-enabled/);
 }
 assert.equal(requireEnabledForCodePromotion({state:'enabled'}),true);
});
test('pilot app identity mismatch stops before feature or drains can be read',async()=>{
 const f=fixture({appName:'mterm2026'});
 await assert.rejects(audit({fetcher:f.fetcher,key,log:()=>{}}),/identity/);
 assert.equal(f.calls.length,1);
});

test('legacy URL-coordinate smoke is blocked unless private router redaction is explicitly enabled',()=>{
 for(const state of ['disabled','unavailable','unknown',undefined])
  assert.equal(mayRunLegacyCoordinateGet({state}),false);
 assert.equal(mayRunLegacyCoordinateGet(null),false);
 assert.equal(mayRunLegacyCoordinateGet({state:'enabled'}),true);
});
