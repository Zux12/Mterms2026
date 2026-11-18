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
if(require.main===module)verify().then(()=>{
 console.log('Private Heroku Git target name and approved immutable app ID agree (GET only).');
}).catch(()=>{
 console.error('Manual private Git push BLOCKED: dedicated app ID/name mismatch or inaccessible (no writes).');
 process.exitCode=1;
});
module.exports={verify};
