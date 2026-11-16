'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {audit,APPS}=require('./audit-heroku-retention-metadata-readonly');
const SECRET='https://secret.invalid/with-private-token-and-coordinates';
const uuid=/^[0-9a-f-]{36}$/;
function mock({wrongId=false,redaction=true,invalidGeneration=false,paginated=false,broken=false}={}){
  const calls=[];
  const fetcher=async(url,opts)=>{
    calls.push({url,method:opts.method,redirect:opts.redirect});
    assert.equal(opts.method,'GET');assert.equal(opts.redirect,'error');
    assert.ok(url.startsWith('https://api.heroku.com/apps/'));
    const path=new URL(url).pathname.split('/').filter(Boolean);
    assert.equal(path[0],'apps'); assert.match(path[1],uuid);
    const entry=APPS.find(x=>x.id===path[1]);assert.ok(entry);
    let payload;
    if(path.length===2)payload={id:wrongId?'00000000-0000-0000-0000-000000000000':entry.id,
      name:entry.name,generation:{name:invalidGeneration?'unknown':'cedar'},owner:{email:SECRET}};
    else if(path[2]==='features')payload={name:'http-router-no-log-query',enabled:redaction};
    else if(path[2]==='log-drains')payload=[];
    else if(path[2]==='addons')payload=[{name:SECRET,config:SECRET}];
    else throw Error('unknown mock path');
    return {status:broken?503:200,headers:{get:k=>paginated&&k==='Next-Range'?'id 222..':null},json:async()=>payload};
  };
  return {fetcher,calls};
}
test('pinned read-only GET inventory redacts provider payloads and always leaves retention unverified',async()=>{
  const {fetcher,calls}=mock();const lines=[];
  const r=await audit({key:'k'.repeat(20),fetcher,log:x=>lines.push(x)});
  assert.equal(r.length,2);assert.equal(calls.length,8);
  assert.ok(calls.every(x=>x.method==='GET'));
  assert.ok(r.every(x=>x.queryRedactionEnabled&&x.drainCount===0&&x.addonCount===1));
  assert.ok(r.every(x=>x.historyAndThirdPartyRetention==='unverified'));
  assert.ok(!lines.join(' ').includes(SECRET));
  assert.ok(!lines.join(' ').includes(APPS[0].id));
});
test('app substitution fails before reading other app metadata',async()=>{
  const {fetcher,calls}=mock({wrongId:true});
  await assert.rejects(audit({key:'k'.repeat(20),fetcher,log:()=>{}}),/pinned-app-identity-mismatch/);
  assert.equal(calls.length,1);
});
test('redaction disabled is never a pass',async()=>{
  const {fetcher}=mock({redaction:false});
  await assert.rejects(audit({key:'k'.repeat(20),fetcher,log:()=>{}}),/query-redaction-not-enabled/);
});
test('unknown generation fails closed and does not invent Logplex retention',async()=>{
  const {fetcher}=mock({invalidGeneration:true});
  await assert.rejects(audit({key:'k'.repeat(20),fetcher,log:()=>{}}),/unsupported-generation/);
});
test('incomplete pagination or HTTP failures cannot be called zero drains',async()=>{
  for(const options of [{paginated:true},{broken:true}]){
    const {fetcher}=mock(options);
    await assert.rejects(audit({key:'k'.repeat(20),fetcher,log:()=>{}}));
  }
});
test('no credential means no provider request',async()=>{
  let calls=0;
  await assert.rejects(audit({key:'',fetcher:()=>{calls++;},log:()=>{}}),/missing-heroku-access/);
  assert.equal(calls,0);
});
