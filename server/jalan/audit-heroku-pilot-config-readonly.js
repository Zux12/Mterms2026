'use strict';
// GET-only comparison of existing dedicated private pilot config against
// release safety requirements. Never print any config values or identifiers.
const APP='jalan-kl-private-pilot',ORIGINAL='mterm2026';
const ROOT='https://api.heroku.com';
const REQUIRED={
 JALAN_PILOT_MODE:'EXPERIMENTAL_SEGMENT_ROUTE',
 JALAN_DATABASE_WRITES_ENABLED:'false',
 JALAN_TURN_ENFORCEMENT_ENABLED:'false',
 NODE_ENV:'production'
};
function evaluateConfig(config,expectedUri){
 const failures=[];
 if(typeof config!=='object'||!config||Array.isArray(config))
  return {ready:false,failures:['invalid-config-response']};
 let parsed;
 try{parsed=new URL(expectedUri);}catch{}
 if(!parsed||!['mongodb:','mongodb+srv:'].includes(parsed.protocol)||
    decodeURIComponent(parsed.username)!=='jalan_readonly')
  return {ready:false,failures:['expected-readonly-credential-invalid']};
 const deployed=config.JALAN_READONLY_MONGODB_URI;
 if(typeof deployed!=='string'||!deployed)failures.push('readonly-uri-missing');
 else if(deployed!==expectedUri)failures.push('readonly-uri-mismatch');
 const pass=config.JALAN_PILOT_ACCESS_PASSWORD,token=config.JALAN_PREVIEW_TOKEN;
 if(typeof pass!=='string'||pass.length<32)failures.push('pilot-basic-secret-invalid');
 if(typeof token!=='string'||token.length<32)failures.push('pilot-api-token-invalid');
 if(typeof pass==='string'&&typeof token==='string'&&pass===token)
  failures.push('pilot-secrets-not-separated');
 for(const [key,value] of Object.entries(REQUIRED))
  if(config[key]!==value)failures.push('flag-'+key.toLowerCase()+'-mismatch');
 return {ready:failures.length===0,failures};
}
async function audit({fetcher=fetch,key=process.env.HEROKU_API_KEY,
 expectedUri=process.env.JALAN_READONLY_MONGODB_URI,log=console.log}={}){
 if(typeof key!=='string'||key.length<16)throw Error('missing-heroku-api-access');
 const headers={Authorization:'Bearer '+key,
  Accept:'application/vnd.heroku+json; version=3'};
 async function get(path){
  const result=await fetcher(ROOT+path,{method:'GET',headers,redirect:'error',
   signal:AbortSignal.timeout(15000)});
  if(!result.ok)throw Error('heroku-readonly-response-'+result.status);
  return result.json();
 }
 const [original,pilot]=await Promise.all([
  get('/apps/'+ORIGINAL),get('/apps/'+APP)
 ]);
 if(!original?.id||!pilot?.id||original.id===pilot.id||pilot.name!==APP)
  throw Error('app-identity-not-isolated');
 const config=await get('/apps/'+APP+'/config-vars');
 const result=evaluateConfig(config,expectedUri);
 // Report constant, non-secret reason identifiers only; never print any
 // credential, URI, token, config object, URL or sensitive user data.
 log('JALAN private pilot configuration release-ready: '+result.ready);
 log('JALAN private pilot config discrepancies: '+
     (result.failures.length?result.failures.join(','):'none'));
 log('Read-only config check only; no changes, route calls or rollback.');
 return result;
}
if(require.main===module)audit().catch(()=>{
 console.error('JALAN private config audit unavailable; credentials and details suppressed.');
 process.exitCode=1;
});
module.exports={evaluateConfig,audit};
