'use strict';
// GET-only pre-deploy gate: do not mutate private Heroku if there is no
// independently pinned, compatible and eligible prior code release.
// This does NOT execute or certify a rollback.
const {APPS}=require('./audit-heroku-retention-metadata-readonly');
const {audit:auditCode}=require('./audit-heroku-pilot-rollback-readonly');
const {audit:auditConfig}=require('./audit-heroku-pilot-release-config-readonly');
const PRIVATE=APPS.find(app=>app.role==='private');
async function preflight({fetcher=fetch,key=process.env.HEROKU_API_KEY,
 expectedUri=process.env.JALAN_READONLY_MONGODB_URI,log=console.log}={}){
 if(!PRIVATE||typeof key!=='string'||key.length<16||
    typeof expectedUri!=='string'||!expectedUri)
  throw Error('private-release-preflight-access-unavailable');
 const response=await fetcher('https://api.heroku.com/apps/'+PRIVATE.id,{
  method:'GET',headers:{Authorization:'Bearer '+key,
   Accept:'application/vnd.heroku+json; version=3'},
  redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!response||response.status!==200)throw Error('private-app-identity-unavailable');
 const app=await response.json();
 if(app?.id!==PRIVATE.id||app?.name!==PRIVATE.name)
  throw Error('private-app-identity-mismatch');
 const code=await auditCode(fetcher,key);
 // All versioned config variables stay in memory, never in log or output.
 const cfg=await auditConfig({fetcher,key,expectedUri,log:()=>{}});
 if(code.state!=='previous-code-slug-metadata-verified'||
    cfg.eligible!=='confirmed'||cfg.compatible!==true||
    code.currentVersion!==cfg.currentVersion||
    code.previousVersion!==cfg.previousVersion)
  throw Error('prior-private-code-restore-not-verified');
 const info={appIdentityPinned:true,priorCodeSlugVerified:true,
  priorReleaseEligible:true,configCompatible:true,
  priorVersion:code.previousVersion,restoreTested:false};
 log('Private manual release preflight: prior code slug available, rollback eligibility and secret/config compatibility verified (GET only).');
 log('A future actual restore and authenticated post-restore smoke are still REQUIRED.');
 return info;
}
if(require.main===module)preflight().catch(()=>{
 console.error('Manual private deployment BLOCKED: restorable previous release preflight not verified. No preflight writes or secrets disclosed.');
 process.exitCode=1;
});
module.exports={preflight};
