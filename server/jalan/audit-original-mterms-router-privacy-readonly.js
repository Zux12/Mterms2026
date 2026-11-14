'use strict';
// Read-only inspection of original Mterms Heroku router privacy configuration.
// Never fetch log records, query strings, private coordinates or config vars.
const ORIGINAL_NAMES=['mterm2026','mterms2026'];
const FEATURE='http-router-no-log-query';
async function audit({key=process.env.HEROKU_API_KEY,fetcher=fetch,log=console.log}={}){
 if(!key||key.length<16)throw Error('Heroku API authentication not configured');
 const headers={Authorization:'Bearer '+key,
  Accept:'application/vnd.heroku+json; version=3'};
 async function get(path,allow404=false){
  const r=await fetcher('https://api.heroku.com'+path,{
   method:'GET',headers,redirect:'error',signal:AbortSignal.timeout(15000)});
  if(allow404&&r.status===404)return null;
  if(!r.ok)throw Error('Heroku privacy audit unavailable (HTTP '+r.status+')');
  return r.json();
 }
 const matches=[];
 for(const name of ORIGINAL_NAMES){
  const app=await get('/apps/'+name,true);
  if(app){
   if(app.name!==name||typeof app.id!=='string'||!app.id)
    throw Error('Unexpected original app identity');
   matches.push(app);
  }
 }
 if(matches.length!==1)throw Error('Original Mterms app identity ambiguous or not accessible');
 const app=matches[0];
 const feature=await get('/apps/'+app.name+'/features/'+FEATURE,true);
 const drains=await get('/apps/'+app.name+'/log-drains');
 if(!Array.isArray(drains))throw Error('Invalid log-drain inventory');
 const state=feature===null?'unavailable':feature.name===FEATURE&&typeof feature.enabled==='boolean'
  ?feature.enabled?'enabled':'disabled':'unknown';
 if(state==='unknown')throw Error('Unexpected feature response');
 // Only report original app alias, boolean feature state, and count of drains;
 // log drain records can contain destinations/tokens, so never print them.
 log('Original Mterms query redaction feature: '+state);
 log('Original Mterms log-drain count: '+drains.length+' (destinations not logged)');
 log('Log contents and retention NOT audited; no HTTP requests to app routes.');
 return {state,drainCount:drains.length,appName:app.name};
}
if(require.main===module)audit().catch(()=>{
 console.error('Read-only original Mterms router privacy audit unavailable; gate remains blocked.');
 process.exitCode=1;
});
module.exports={audit};
