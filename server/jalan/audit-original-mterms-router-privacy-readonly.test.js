'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {audit}=require('./audit-original-mterms-router-privacy-readonly');
const key='K'.repeat(32);
function fixture({enabled=true,found=['mterm2026'],featureStatus=200,drains=2}={}){
 const requests=[],logs=[];
 const fetcher=async(url,opts)=>{
  const path=new URL(url).pathname;requests.push({path,method:opts.method});
  if(opts.method!=='GET'||opts.body!==undefined)throw Error('Mutation attempted');
  let status=200,data=null;
  if(path.startsWith('/apps/')&&!path.includes('/features/')&&!path.includes('/log-drains')){
   const name=path.slice('/apps/'.length);
   if(found.includes(name))data={id:'unique-'+name,name};else status=404;
  }else if(path.endsWith('/features/http-router-no-log-query')){
   if(featureStatus===404)status=404;
   else data={name:'http-router-no-log-query',enabled};
  }else if(path.endsWith('/log-drains'))data=Array.from({length:drains},(_,i)=>({
   url:'https://private-log-destination-'+i+'.invalid',token:'secret-'+i
  }));
  else throw Error('Unexpected access '+path);
  return {ok:status===200,status,json:async()=>data};
 };
 return {requests,logs,fetcher};
}
test('one original app with redaction enabled reports only boolean/count',async()=>{
 const f=fixture();
 const v=await audit({key,fetcher:f.fetcher,log:s=>f.logs.push(s)});
 assert.equal(v.state,'enabled');
 assert.equal(v.drainCount,2);
 assert.equal(f.requests.length,4);
 assert.ok(f.requests.every(x=>x.method==='GET'));
 assert.ok(!f.logs.join(' ').includes('private-log-destination'));
 assert.ok(!f.logs.join(' ').includes('secret-'));
});
test('disabled feature is an explicit blocker, not a false pass',async()=>{
 const f=fixture({enabled:false});
 const v=await audit({key,fetcher:f.fetcher,log:s=>f.logs.push(s)});
 assert.equal(v.state,'disabled');
});
test('missing feature remains unavailable and does not claim redaction',async()=>{
 const f=fixture({featureStatus:404,drains:0});
 const v=await audit({key,fetcher:f.fetcher,log:s=>f.logs.push(s)});
 assert.equal(v.state,'unavailable');
});
test('ambiguous original aliases fail before feature/log-drain inspection',async()=>{
 const f=fixture({found:['mterm2026','mterms2026']});
 await assert.rejects(audit({key,fetcher:f.fetcher,log:()=>{}}),/ambiguous/);
 assert.ok(f.requests.every(x=>!x.path.includes('log-drains')));
});
