'use strict';
// One-time, idempotent provisioning of an EMPTY Heroku app for the JALAN private pilot.
// Does not deploy, set credentials, start dynos, create add-ons, or touch mterm2026.
// Called only by the experimental branch push workflow, not pull requests.
const key=process.env.HEROKU_API_KEY;
const NAME='jalan-kl-private-pilot', ORIGINAL='mterm2026';
async function main(){
 if(typeof key!=='string'||key.length<16)throw Error('HEROKU_API_KEY missing');
 const headers={Accept:'application/vnd.heroku+json; version=3',
  Authorization:'Bearer '+key,'Content-Type':'application/json'};
 const request=async(path,method='GET',body)=>{
  const res=await fetch('https://api.heroku.com'+path,{
   method,headers,body:body&&JSON.stringify(body),redirect:'error',
   signal:AbortSignal.timeout(20000)});
  // Never print response bodies: they can contain account data.
  return {status:res.status,data:res.ok?await res.json():null};
 };
 const old=await request('/apps/'+ORIGINAL);
 if(old.status!==200||!old.data?.id||!old.data?.region?.name)
  throw Error('Original MTERMS app/region not accessible; no changes performed');
 const existing=await request('/apps/'+NAME);
 if(existing.status===200){
  if(existing.data?.name!==NAME)throw Error('Unexpected pilot app identity');
  console.log('Separate JALAN pilot app already exists; no duplicate created.');
  console.log('Pilot app: '+NAME+'; original MTERMS app untouched.');
  return;
 }
 if(existing.status!==404)throw Error('Pilot app lookup returned HTTP '+existing.status);
 const create=await request('/apps','POST',{name:NAME,region:old.data.region.name});
 if(create.status!==201&&create.status!==200)
  throw Error('Could not provision separate empty JALAN app; HTTP '+create.status);
 if(create.data?.name!==NAME||!create.data?.id)
  throw Error('Unexpected Heroku app create response');
 console.log('Created empty JALAN pilot app: '+NAME);
 console.log('No code deployed, no dynos, no credentials, no add-ons or domains configured.');
 console.log('Original MTERMS app untouched.');
}
if(require.main===module)main().catch(e=>{
 console.error('Heroku pilot provisioning stopped safely: '+String(e.message).slice(0,160));
 process.exitCode=1;
});
module.exports={main};
