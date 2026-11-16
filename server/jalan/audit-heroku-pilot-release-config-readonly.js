'use strict';
// Dedicated JALAN private Heroku pilot only. GET-only v14-v15 recovery
// configuration compatibility inspection. NEVER outputs config vars or URLs.
const APP='jalan-kl-private-pilot';
const UUID=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const HEADERS={Accept:'application/vnd.heroku+json; version=3'};
const REQUIRED={
 JALAN_PILOT_MODE:'EXPERIMENTAL_SEGMENT_ROUTE',
 JALAN_DATABASE_WRITES_ENABLED:'false',
 JALAN_TURN_ENFORCEMENT_ENABLED:'false',
 NODE_ENV:'production'
};
function compatibility(current,previous,expectedUri){
 if(!current||!previous||typeof current!=='object'||typeof previous!=='object')
  return {compatible:false,reasons:['config-unavailable']};
 const reasons=[];
 for(const k of ['JALAN_READONLY_MONGODB_URI','JALAN_PILOT_ACCESS_PASSWORD',
  'JALAN_PREVIEW_TOKEN']){
  if(typeof current[k]!=='string'||current[k].length<16||
     typeof previous[k]!=='string'||previous[k]!==current[k])
   reasons.push(k.toLowerCase()+'-mismatch');
 }
 if(current.JALAN_READONLY_MONGODB_URI!==expectedUri)
  reasons.push('current-readonly-uri-unexpected');
 if(typeof current.JALAN_PILOT_ACCESS_PASSWORD==='string'&&
    typeof current.JALAN_PREVIEW_TOKEN==='string'&&
    current.JALAN_PILOT_ACCESS_PASSWORD===current.JALAN_PREVIEW_TOKEN)
  reasons.push('current-auth-secrets-not-distinct');
 for(const [k,v] of Object.entries(REQUIRED))
  if(previous[k]!==v||current[k]!==v)reasons.push('safety-'+k.toLowerCase()+'-mismatch');
 return {compatible:reasons.length===0,reasons};
}
async function audit({fetcher=fetch,key=process.env.HEROKU_API_KEY,
 expectedUri=process.env.JALAN_READONLY_MONGODB_URI,log=console.log,appId=APP}={}){
 if(typeof key!=='string'||key.length<16||typeof expectedUri!=='string'||!expectedUri)
  throw Error('protected-heroku-credentials-not-available');
 if(appId!==APP&&!UUID.test(appId))throw Error('invalid-private-app-identity');
 const headers={...HEADERS,Authorization:'Bearer '+key};
 const get=async path=>{
  const r=await fetcher('https://api.heroku.com'+path,{
   method:'GET',headers,redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw Error('heroku-release-config-audit-http-'+r.status);
  return r.json();
 };
 const base='/apps/'+encodeURIComponent(appId);
 const app=await get(base);
 if(app?.name!==APP||!app.id||(appId!==APP&&app.id!==appId))
  throw Error('unexpected-pilot-application');
 const releases=await get(base+'/releases');
 if(!Array.isArray(releases)||releases.length<2)throw Error('release-list-unavailable');
 const sorted=releases.filter(x=>Number.isInteger(x.version)).sort((a,b)=>b.version-a.version);
 const current=sorted[0];
 if(current?.status!=='succeeded'||!current.slug?.id)
  throw Error('current-pilot-code-release-not-verified');
 const previous=sorted.find(x=>x.version<current.version&&x.status==='succeeded'&&
  x.slug?.id&&x.slug.id!==current.slug.id);
 if(!previous)throw Error('no-previous-distinct-code-release');
 const curConfig=await get(base+'/releases/'+encodeURIComponent(current.id)+'/config-vars');
 const prevConfig=await get(base+'/releases/'+encodeURIComponent(previous.id)+'/config-vars');
 const c=compatibility(curConfig,prevConfig,expectedUri);
 const eligible=previous.eligible_for_rollback===true?'confirmed':
  previous.eligible_for_rollback===false?'denied':'unknown';
 log('Private pilot rollback candidate: current v'+current.version+
  ', previous different-code v'+previous.version);
 log('Previous release eligible_for_rollback: '+eligible);
 log('Previous/current required config compatible: '+c.compatible);
 log('Rollback config discrepancies: '+(c.reasons.join(',')||'none'));
 log('Release restore NOT executed; external data and historical secrets NOT inspected.');
 return {currentVersion:current.version,previousVersion:previous.version,
   eligible,compatible:c.compatible,reasons:c.reasons,restoreTested:false};
}
if(require.main===module)audit().catch(()=>{
 console.error('Private pilot rollback config audit unavailable; no restore or secret disclosure.');
 process.exitCode=1;
});
module.exports={compatibility,audit};
