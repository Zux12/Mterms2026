'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {enableQueryRedaction}=require('./enable-heroku-router-redaction-operator');
const KEY='test-only-redacted-key-not-a-heroku-secret';
function response(status,data,etag='"W/123"'){
 return {status,ok:status>=200&&status<300,headers:{get:x=>x.toLowerCase()==='etag'?etag:null},json:async()=>data};
}
function setup({original=false,enabled=false,featureEtag='"W/123"',afterEnabled=true,
 patchStatus=200,ambiguous=false}={}){
 const calls=[],messages=[];
 const originalName='mterm2026';
 let patchCount=0;
 const fetcher=async(url,opts)=>{
  const u=new URL(url),method=opts.method;
  calls.push({path:u.pathname,method,body:opts.body,headers:opts.headers,redirect:opts.redirect});
  assert.equal(u.origin,'https://api.heroku.com');
  assert.equal(opts.redirect,'error');
  if(u.pathname==='/apps/jalan-kl-private-pilot')
   return original?response(404,{}):response(200,{id:'pilot-uuid',name:'jalan-kl-private-pilot'});
  if(u.pathname==='/apps/mterm2026')
   return original?response(200,{id:'original-uuid',name:originalName}):response(404,{});
  if(u.pathname==='/apps/mterms2026')
   return ambiguous?response(200,{id:'other-uuid',name:'mterms2026'}):response(404,{});
  if(u.pathname.endsWith('/features/http-router-no-log-query')){
   if(method==='GET')return response(200,{name:'http-router-no-log-query',
    enabled:patchCount>0?afterEnabled:enabled},featureEtag);
   if(method==='PATCH'){
    patchCount++;
    assert.equal(opts.headers['If-Match'],featureEtag);
    assert.equal(opts.headers['Content-Type'],'application/json');
    assert.deepEqual(JSON.parse(opts.body),{enabled:true});
    return response(patchStatus,{name:'http-router-no-log-query',enabled:true});
   }
  }
  throw Error('Unexpected request '+method+' '+u.pathname);
 };
 return {fetcher,calls,messages,log:m=>messages.push(m),get patches(){return patchCount}};
}
test('dry-run private only does not mutate or request route, location, config or log records',async()=>{
 const h=setup();
 const r=await enableQueryRedaction({target:'private',key:KEY,fetcher:h.fetcher,log:h.log});
 assert.equal(r.state,'disabled');
 assert.equal(r.changed,false);
 assert.equal(h.patches,0);
 assert.equal(h.calls.length,3);
 assert(h.calls.every(c=>c.method==='GET'&&!/route|log-drain|config|\?/.test(c.path)));
 assert(h.messages.every(m=>!m.includes(KEY)));
});
test('explicit private approval updates only the identified private app and verifies GET',async()=>{
 const h=setup();
 const r=await enableQueryRedaction({target:'private',apply:true,
  confirmation:'ENABLE_QUERY_REDACTION_PRIVATE',key:KEY,fetcher:h.fetcher,log:h.log});
 assert.deepEqual(r,{target:'private',state:'enabled',changed:true});
 assert.equal(h.patches,1);
 assert.equal(h.calls.filter(c=>c.method==='GET').length,3);
 assert(h.calls.every(c=>c.path.startsWith('/apps/jalan-kl-private-pilot')));
});
test('already enabled is idempotent and still verified',async()=>{
 const h=setup({enabled:true});
 const r=await enableQueryRedaction({target:'private',apply:true,
  confirmation:'ENABLE_QUERY_REDACTION_PRIVATE',key:KEY,fetcher:h.fetcher,log:h.log});
 assert.equal(r.changed,false);
 assert.equal(r.state,'enabled');
 assert.equal(h.patches,0);
});
test('confirmation mismatch fails before any authenticated call',async()=>{
 const h=setup();
 await assert.rejects(enableQueryRedaction({target:'private',apply:true,
  confirmation:'ENABLE_QUERY_REDACTION_ORIGINAL',key:KEY,fetcher:h.fetcher,log:h.log}),/confirmation/);
 assert.equal(h.calls.length,0);
});
test('original alias discovered uniquely; no pilot request or code mutation',async()=>{
 const h=setup({original:true});
 const r=await enableQueryRedaction({target:'original',apply:true,
  confirmation:'ENABLE_QUERY_REDACTION_ORIGINAL',key:KEY,fetcher:h.fetcher,log:h.log});
 assert.equal(r.changed,true);
 assert.equal(h.patches,1);
 assert(h.calls.every(c=>!c.path.includes('jalan-kl-private-pilot')));
});
test('ambiguous original identity refuses PATCH',async()=>{
 const h=setup({original:true,ambiguous:true});
 await assert.rejects(enableQueryRedaction({target:'original',apply:true,
  confirmation:'ENABLE_QUERY_REDACTION_ORIGINAL',key:KEY,fetcher:h.fetcher,log:h.log}),/ambiguous/);
 assert.equal(h.patches,0);
});
test('a concurrent ETag conflict or failed GET verification never reports success',async()=>{
 const h=setup({patchStatus:412});
 await assert.rejects(enableQueryRedaction({target:'private',apply:true,
  confirmation:'ENABLE_QUERY_REDACTION_PRIVATE',key:KEY,fetcher:h.fetcher,log:h.log}),/not confirmed/);
 const h2=setup({afterEnabled:false});
 await assert.rejects(enableQueryRedaction({target:'private',apply:true,
  confirmation:'ENABLE_QUERY_REDACTION_PRIVATE',key:KEY,fetcher:h2.fetcher,log:h2.log}),/verification failed/);
 assert.equal(h2.patches,1);
});
test('unsupported target and absent auth fail closed',async()=>{
 const h=setup();
 await assert.rejects(enableQueryRedaction({target:'all',key:KEY,fetcher:h.fetcher,log:h.log}),/Unsupported/);
 await assert.rejects(enableQueryRedaction({target:'private',key:'',fetcher:h.fetcher,log:h.log}),/authentication/);
 assert.equal(h.calls.length,0);
});
