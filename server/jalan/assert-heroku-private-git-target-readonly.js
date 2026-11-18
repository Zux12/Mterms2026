'use strict';
// Fail-closed GET-only check for the name-based Heroku Git remote.
// Heroku Git targets an app NAME, while the approved pilot identity is its UUID.
// A renamed/reused name must never silently redirect a manual code push.
const {APPS}=require('./audit-heroku-retention-metadata-readonly');
const PRIVATE=APPS.find(app=>app.role==='private');
async function verify({fetcher=fetch,key=process.env.HEROKU_API_KEY}={}){
 if(!PRIVATE||!PRIVATE.id||PRIVATE.name!=='jalan-kl-private-pilot'||
    typeof key!=='string'||key.length<16)
  throw Error('private-git-target-identity-unavailable');
 const headers={Authorization:'Bearer '+key,
   Accept:'application/vnd.heroku+json; version=3'};
 const retrieve=async identifier=>{
  const r=await fetcher('https://api.heroku.com/apps/'+encodeURIComponent(identifier),{
   method:'GET',headers,redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!r||r.status!==200)throw Error('private-git-target-identity-unavailable');
  return r.json();
 };
 // Checking just /apps/UUID cannot prove the mutable Git remote name resolves
 // to that same app. Check BOTH identifiers as close to the push as possible.
 const [byId,byName]=await Promise.all([retrieve(PRIVATE.id),retrieve(PRIVATE.name)]);
 if(byId?.id!==PRIVATE.id||byId?.name!==PRIVATE.name||
    byName?.id!==PRIVATE.id||byName?.name!==PRIVATE.name)
  throw Error('private-git-target-identity-mismatch');
 return byId;
}

/**
 * Just-in-time, read-only release fence. The earlier rollback eligibility
 * check and captured baseline can become stale during other operator actions.
 * A different release/slug or disabled router redaction MUST abort before
 * any name-addressed Heroku Git push. This does NOT execute a rollback.
 */
async function verifyPrePush({fetcher=fetch,key=process.env.HEROKU_API_KEY,baseline}={}){
 await verify({fetcher,key});
 if(!baseline||!Number.isInteger(baseline.version)||baseline.version<1||
    typeof baseline.id!=='string'||!baseline.id||
    typeof baseline.slugId!=='string'||!baseline.slugId)
  throw Error('private-prepush-baseline-invalid');
 const headers={Authorization:'Bearer '+key,Accept:'application/vnd.heroku+json; version=3'};
 async function get(suffix){
  const response=await fetcher('https://api.heroku.com/apps/'+encodeURIComponent(PRIVATE.id)+suffix,{
   method:'GET',headers,redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!response||response.status!==200||response.headers?.get?.('Next-Range'))
   throw Error('private-prepush-metadata-unavailable');
  return response.json();
 }
 const [feature,releases]=await Promise.all([
  get('/features/http-router-no-log-query'),get('/releases')]);
 if(feature?.name!=='http-router-no-log-query'||feature.enabled!==true)
  throw Error('private-prepush-router-redaction-not-enabled');
 if(!Array.isArray(releases)||!releases.length||
    releases.some(r=>!Number.isInteger(r?.version)))
  throw Error('private-prepush-releases-unverifiable');
 const latest=releases.reduce((a,b)=>a.version>b.version?a:b);
 if(latest.version!==baseline.version||latest.id!==baseline.id||
    latest.slug?.id!==baseline.slugId||latest.status!=='succeeded')
  throw Error('private-prepush-release-baseline-changed');
 return {appIdentityPinned:true,routerRedactionEnabled:true,baselineUnchanged:true};
}

if(require.main===module){
 const prepush=process.argv.includes('--prepush');
 const run=prepush
  ?()=>verifyPrePush({baseline:JSON.parse(require('node:fs').readFileSync(
    require('node:path').join(process.env.RUNNER_TEMP||'', 'jalan-pilot-release-baseline.json'),'utf8'))})
  :()=>verify();
 run().then(()=>{
  console.log(prepush
   ?'Private Heroku name/ID, query redaction and exact pre-push release baseline verified (GET only).'
   :'Private Heroku Git target name and approved immutable app ID agree (GET only).');
 }).catch(()=>{
  console.error('Manual private Git push BLOCKED: approved app identity, router privacy or release baseline unavailable/changed (no writes).');
  process.exitCode=1;
 });
}
module.exports={verify,verifyPrePush};
