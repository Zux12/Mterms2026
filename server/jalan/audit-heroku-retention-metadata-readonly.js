'use strict';
// Metadata-only audit for exactly the two owner-approved JALAN-related Heroku apps.
// Do not request logs, locations, log sessions, token-bearing drain URLs or config values.
const ROOT='https://api.heroku.com';
const UUID=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
// Independently recorded in the authenticated 17 Nov 2026 app identity check.
const APPS=Object.freeze([
  {role:'original',id:'bf28046d-aa40-4409-b60c-0c6d1c575ec0',name:'mterm2026'},
  {role:'private',id:'c32184f4-9427-454e-b445-103a33fdec16',name:'jalan-kl-private-pilot'}
]);
function validateList(rows,label){
  if(!Array.isArray(rows)||rows.length>=200)throw Error('incomplete-'+label+'-inventory');
  return rows.length;
}
async function audit({key=process.env.HEROKU_API_KEY,fetcher=fetch,log=console.log}={}){
  if(typeof key!=='string'||key.length<16)throw Error('missing-heroku-access');
  const headers={Accept:'application/vnd.heroku+json; version=3',Authorization:'Bearer '+key};
  const result=[];
  async function get(path){
    const r=await fetcher(ROOT+path,{method:'GET',headers,redirect:'error',signal:AbortSignal.timeout(15000)});
    if(!r||r.status!==200)throw Error('heroku-metadata-unavailable');
    // The API uses paged lists; never mistake an incomplete first page for zero drains.
    if(r.headers?.get?.('Next-Range'))throw Error('incomplete-heroku-pagination');
    return r.json();
  }
  for(const entry of APPS){
    if(!UUID.test(entry.id))throw Error('invalid-approved-app-id');
    const app=await get('/apps/'+entry.id);
    if(app?.id!==entry.id||app.name!==entry.name)throw Error('pinned-app-identity-mismatch');
    const generation=app.generation?.name;
    if(!['cedar','fir'].includes(generation))throw Error('unsupported-generation-needs-review');
    const flag=await get('/apps/'+entry.id+'/features/http-router-no-log-query');
    if(flag?.name!=='http-router-no-log-query'||typeof flag.enabled!=='boolean')
      throw Error('router-redaction-state-unverified');
    const drains=await get('/apps/'+entry.id+'/'+(generation==='fir'?'telemetry-drains':'log-drains'));
    const addons=await get('/apps/'+entry.id+'/addons');
    const drainCount=validateList(drains,'drain');
    const addonCount=validateList(addons,'addon');
    const row={role:entry.role,generation,queryRedactionEnabled:flag.enabled,
      drainCount,addonCount,historyAndThirdPartyRetention:'unverified'};
    // Never print raw provider objects: may contain contacts, URLs, tokens or secret-bearing config.
    log('JALAN Heroku retention metadata: '+JSON.stringify(row));
    result.push(row);
  }
  log('Read-only metadata only. No logs, locations or config values fetched. Historical erasure, application logs, attached add-ons and provider retention are NOT cleared.');
  if(result.some(x=>!x.queryRedactionEnabled))throw Error('query-redaction-not-enabled');
  return result;
}
if(require.main===module)audit().catch(()=>{
  console.error('JALAN retention metadata audit unavailable; no retention clearance granted.');
  process.exitCode=1;
});
module.exports={audit,validateList,APPS};
