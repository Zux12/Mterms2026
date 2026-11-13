'use strict';
// Read-only Heroku pilot runtime diagnostics; no secrets or dyno logs exported.
const key=process.env.HEROKU_API_KEY;
const APP='jalan-kl-private-pilot';
async function main(){
 if(!key||key.length<16)throw Error('Missing Heroku secret');
 const headers={Accept:'application/vnd.heroku+json; version=3',
  Authorization:'Bearer '+key};
 async function get(path){
  const r=await fetch('https://api.heroku.com'+path,{
   headers,signal:AbortSignal.timeout(15000),redirect:'error'});
  if(!r.ok)throw Error('Heroku runtime API HTTP '+r.status);
  return r.json();
 }
 const app=await get('/apps/'+APP);
 const dynos=await get('/apps/'+APP+'/dynos');
 const formations=await get('/apps/'+APP+'/formation');
 const releases=await get('/apps/'+APP+'/releases');
 if(app.name!==APP)throw Error('Unexpected runtime application');
 console.log('Heroku pilot: '+APP+', region: '+(app.region?.name||'unknown'));
 console.log('Latest release status: '+(Array.isArray(releases)?releases[0]?.status:'unknown'));
 console.log('Formation: '+JSON.stringify(Array.isArray(formations)?formations.map(x=>({type:x.type,quantity:x.quantity,size:x.size})):[]));
 console.log('Dynos: '+JSON.stringify(Array.isArray(dynos)?dynos.map(x=>({type:x.type,state:x.state})):[]));
 const canonical=new URL(app.web_url);
 if(canonical.protocol!=='https:'||!/^[a-z0-9-]+\.herokuapp\.com$/.test(canonical.hostname))
  throw Error('Unexpected Heroku app canonical URL');
 console.log('Canonical pilot URL: '+canonical.origin);
 const result=await fetch(canonical.origin+'/',{
  signal:AbortSignal.timeout(15000),redirect:'manual'});
 console.log('Unauthenticated HTTP status: '+result.status);
 if(result.status!==401)process.exitCode=2;
}
if(require.main===module)main().catch(e=>{
 console.error('JALAN Heroku runtime probe: '+String(e.message).slice(0,160));
 process.exitCode=1;
});
