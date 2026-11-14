'use strict';
// Read-only inventory of potential JALAN pilot rollback code slugs. No restore,
// no credential/config mutations, no route/GPS, and no original Mterms access.
const APP='jalan-kl-private-pilot';
const ROOT='https://api.heroku.com/apps/'+APP;
function choosePreviousCodeRelease(releases){
 if(!Array.isArray(releases))throw Error('release-history-malformed');
 const sorted=releases.filter(r=>Number.isInteger(r?.version)&&r.version>0)
  .sort((a,b)=>b.version-a.version);
 const current=sorted[0];
 if(!current||current.status!=='succeeded'||!current.slug?.id)
  return {state:'current-release-not-verified'};
 const previous=sorted.find(r=>r.version<current.version&&r.status==='succeeded'&&
  r.slug?.id&&r.slug.id!==current.slug.id);
 if(!previous)return {state:'no-previous-distinct-succeeded-code-slug',currentVersion:current.version};
 return {state:'candidate-found',currentVersion:current.version,
  previousVersion:previous.version,currentSlug:current.slug.id,
  candidateSlug:previous.slug.id};
}
async function audit(fetchImpl,token){
 if(!token||token.length<16)throw Error('missing-readonly-heroku-access');
 const headers={Authorization:'Bearer '+token,
  Accept:'application/vnd.heroku+json; version=3'};
 const get=async path=>{
  const r=await fetchImpl(ROOT+path,{headers,redirect:'error',
   signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw Error('heroku-readonly-api-http-'+r.status);
  return r.json();
 };
 const app=await get('');
 if(app.name!==APP)throw Error('unexpected-heroku-application');
 const list=await get('/releases');
 const result=choosePreviousCodeRelease(list);
 if(result.state!=='candidate-found')return result;
 // The candidate is only a recorded previous *code* slug, not a proven
 // deployable recovery point. Read its metadata without downloading slug code.
 const [current,candidate]=await Promise.all([
  get('/slugs/'+encodeURIComponent(result.currentSlug)),
  get('/slugs/'+encodeURIComponent(result.candidateSlug))
 ]);
 if(current.id!==result.currentSlug||candidate.id!==result.candidateSlug||
    !/^[a-f0-9]{40}$/.test(current.commit||'')||
    !/^[a-f0-9]{40}$/.test(candidate.commit||'')||
    current.commit===candidate.commit)
  return {state:'distinct-recovery-code-unverified',
    currentVersion:result.currentVersion,previousVersion:result.previousVersion};
 return {state:'previous-code-slug-metadata-verified',
   currentVersion:result.currentVersion,previousVersion:result.previousVersion,
   candidateDifferentGitCommit:true,restoreTested:false};
}
async function main(){
 const info=await audit(fetch,process.env.HEROKU_API_KEY);
 // No Heroku bearer secret, slug identifiers, raw URLs or coordinates logged.
 console.log('Private JALAN rollback read-only inventory: '+JSON.stringify(info));
 if(info.state!=='previous-code-slug-metadata-verified')process.exitCode=2;
}
if(require.main===module)main().catch(()=>{
 console.error('Private JALAN rollback inventory unavailable; details suppressed.');
 process.exitCode=1;
});
module.exports={choosePreviousCodeRelease,audit};
