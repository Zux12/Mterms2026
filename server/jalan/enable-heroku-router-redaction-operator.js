'use strict';
// Operator-only, manually invoked platform security action. No release, routes,
// GPS, logs, config vars, Atlas, or original Mterms application code touched.
const FEATURE='http-router-no-log-query';
const NAMES={private:['jalan-kl-private-pilot'],original:['mterm2026','mterms2026']};
const ACK={private:'ENABLE_QUERY_REDACTION_PRIVATE',original:'ENABLE_QUERY_REDACTION_ORIGINAL'};
const ACCEPT='application/vnd.heroku+json; version=3';
// Heroku's platform API supports immutable app IDs; fail closed on malformed IDs.
const APP_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function enableQueryRedaction({target,apply=false,confirmation='',expectedAppId='',key=process.env.HEROKU_API_KEY,
 fetcher=fetch,log=console.log}={}){
 if(!Object.hasOwn(NAMES,target))throw Error('Unsupported target; private or original only');
 if(typeof key!=='string'||key.length<16)throw Error('Heroku operator authentication unavailable');
 if(apply && confirmation!==ACK[target])throw Error('Operator confirmation required; no mutation performed');
 if(typeof expectedAppId!=='string'||(expectedAppId!==''&&!APP_UUID.test(expectedAppId))||
    (apply&&!APP_UUID.test(expectedAppId)))
  throw Error('A valid independently checked expected app ID is required for apply');
 const headers={Accept:ACCEPT,Authorization:'Bearer '+key};
 async function request(method,path,options={}){
  const r=await fetcher('https://api.heroku.com'+path,{
   method,headers:{...headers,...(options.headers||{})},
   ...(options.body?{body:options.body}:{}),redirect:'error',
   signal:AbortSignal.timeout(15000)
  });
  return r;
 }
 const apps=[];
 for(const candidate of NAMES[target]){
  const r=await request('GET','/apps/'+candidate);
  if(r.status===404)continue;
  if(!r.ok)throw Error('Heroku app identity lookup failed: HTTP '+r.status);
  const data=await r.json();
  if(data?.name!==candidate||typeof data.id!=='string'||!APP_UUID.test(data.id))
   throw Error('Unexpected Heroku app identity');
  apps.push(data);
 }
 if(apps.length!==1)throw Error('Heroku target identity missing or ambiguous');
 // Resolve by name only for initial discovery; bind every feature read/write to
 // the immutable verified app ID to avoid a rename/reuse race.
 const appId=apps[0].id;
 // A valid UUID discovered from a familiar name is not proof that the operator
 // approved that app. Bind the run to the identity checked before dispatch.
 if(expectedAppId&&appId.toLowerCase()!==expectedAppId.toLowerCase())
  throw Error('Heroku target does not match the independently checked app ID');
 const path='/apps/'+appId+'/features/'+FEATURE;
 async function readFeature(){
  const r=await request('GET',path);
  if(!r.ok)throw Error('Heroku query redaction unavailable: HTTP '+r.status);
  const data=await r.json();
  if(data?.name!==FEATURE||typeof data.enabled!=='boolean')
   throw Error('Unexpected Heroku redaction feature response');
  return {enabled:data.enabled,etag:r.headers?.get?.('etag')||null};
 }
 const before=await readFeature();
 if(apply&&!before.enabled){
  if(!before.etag)throw Error('Missing feature ETag; refusing concurrent update risk');
  const r=await request('PATCH',path,{headers:{'Content-Type':'application/json','If-Match':before.etag},
   body:JSON.stringify({enabled:true})});
  if(!r.ok)throw Error('Heroku feature update not confirmed: HTTP '+r.status);
  const body=await r.json();
  if(body?.name!==FEATURE||body.enabled!==true)
   throw Error('Heroku feature update acknowledgement invalid');
 }
 // Never consider PATCH success sufficient without another read-only verify.
 const after=await readFeature();
 if(apply&&!after.enabled)throw Error('Heroku redaction verification failed');
 log('JALAN Heroku query-string router redaction: '+target+
  ' before='+String(before.enabled)+' after='+String(after.enabled)+
  ' identityPinned='+String(Boolean(expectedAppId))+
  ' changed='+String(Boolean(apply&&!before.enabled&&after.enabled)));
 log('No code release, route/location request, historical-log purge or retention audit performed.');
 return {target,state:after.enabled?'enabled':'disabled',changed:Boolean(apply&&!before.enabled&&after.enabled)};
}
if(require.main===module){
 const args=process.argv.slice(2);
 const target=args.find(x=>x.startsWith('--target='))?.slice('--target='.length);
 const apply=args.includes('--apply');
 const confirmation=process.env.JALAN_ROUTER_PRIVACY_CONFIRMATION||'';
 const expectedAppId=process.env.JALAN_EXPECTED_APP_ID||'';
 enableQueryRedaction({target,apply,confirmation,expectedAppId}).catch(()=>{
  console.error('Heroku operator redaction was not verified; no release gate clearance.');
  process.exitCode=1;
 });
}
module.exports={enableQueryRedaction};
