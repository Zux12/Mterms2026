'use strict';
// Exact dedicated private-pilot Heroku app only. GET-only metadata inspection.
// No route queries, log records, config values, coordinates, mutation or secrets output.
const APP='jalan-kl-private-pilot',FEATURE='http-router-no-log-query';
async function audit({fetcher=fetch,key=process.env.HEROKU_API_KEY,log=console.log}={}){
 if(typeof key!=='string'||key.length<16)throw Error('missing-heroku-api-key');
 const headers={Authorization:'Bearer '+key,Accept:'application/vnd.heroku+json; version=3'};
 const get=async(path,allow404=false)=>{
  const response=await fetcher('https://api.heroku.com'+path,{
   method:'GET',headers,redirect:'error',signal:AbortSignal.timeout(15000)});
  if(allow404&&response.status===404)return null;
  if(!response.ok)throw Error('heroku-private-router-audit-http-'+response.status);
  return response.json();
 };
 const app=await get('/apps/'+APP);
 if(app?.name!==APP||!app?.id)throw Error('unexpected-heroku-pilot-identity');
 const feature=await get('/apps/'+APP+'/features/'+FEATURE,true);
 const drains=await get('/apps/'+APP+'/log-drains');
 if(!Array.isArray(drains))throw Error('malformed-log-drain-inventory');
 const state=feature===null?'unavailable':
  feature?.name===FEATURE&&typeof feature.enabled==='boolean'?
   feature.enabled?'enabled':'disabled':'unknown';
 if(state==='unknown')throw Error('malformed-router-feature-response');
 log('Private JALAN pilot router query redaction: '+state);
 log('Private JALAN pilot external log drains: '+drains.length+' (destinations suppressed)');
 log('No route/GPS request, log content or retention inspected. Feature state is not historical log evidence.');
 return {state,drainCount:drains.length};
}
if(require.main===module)audit().catch(()=>{
 console.error('Private JALAN pilot router metadata audit unavailable; release privacy gate unresolved.');
 process.exitCode=1;
});
module.exports={audit};
