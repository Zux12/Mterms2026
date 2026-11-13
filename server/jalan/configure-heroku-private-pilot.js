'use strict';
// Strictly limited to a dedicated Heroku pilot app. Never mutates mterm2026.
// Existing access secrets are preserved on repeated deploys; never print them.
const {randomBytes}=require('node:crypto');
const NAME='jalan-kl-private-pilot',ORIGINAL='mterm2026';
async function main(){
 const key=process.env.HEROKU_API_KEY;
 const uri=process.env.JALAN_READONLY_MONGODB_URI;
 if(!key||key.length<16||!uri)throw Error('Deployment credentials unavailable');
 let parsed;
 try{parsed=new URL(uri);}catch{throw Error('Invalid Atlas URI format');}
 if(!['mongodb:','mongodb+srv:'].includes(parsed.protocol)||
    decodeURIComponent(parsed.username)!=='jalan_readonly')
   throw Error('Expected the dedicated jalan_readonly MongoDB credential');
 const headers={Accept:'application/vnd.heroku+json; version=3',
  Authorization:'Bearer '+key,'Content-Type':'application/json'};
 const request=async(path,method='GET',body)=>{
  const r=await fetch('https://api.heroku.com'+path,{method,headers,
   body:body===undefined?undefined:JSON.stringify(body),
   redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw Error('Heroku API HTTP '+r.status+' while checking private pilot');
  return r.json();
 };
 const original=await request('/apps/'+ORIGINAL);
 const pilot=await request('/apps/'+NAME);
 if(!original?.id||!pilot?.id||pilot.id===original.id||pilot.name!==NAME)
  throw Error('Separate Heroku app identity not verified');
 const previous=await request('/apps/'+NAME+'/config-vars');
 if(previous.JALAN_READONLY_MONGODB_URI && previous.JALAN_READONLY_MONGODB_URI!==uri)
  throw Error('Existing pilot read-only MongoDB URI differs; refusing to overwrite');
 const password=previous.JALAN_PILOT_ACCESS_PASSWORD||randomBytes(32).toString('hex');
 const token=previous.JALAN_PREVIEW_TOKEN||randomBytes(32).toString('hex');
 if(password.length<32||token.length<32||password===token)
  throw Error('Existing pilot secret does not meet minimum requirements');
 const updates={
  JALAN_READONLY_MONGODB_URI:uri,
  JALAN_PILOT_ACCESS_PASSWORD:password,
  JALAN_PREVIEW_TOKEN:token,
  JALAN_PILOT_MODE:'EXPERIMENTAL_SEGMENT_ROUTE',
  JALAN_DATABASE_WRITES_ENABLED:'false',
  JALAN_TURN_ENFORCEMENT_ENABLED:'false',
  NODE_ENV:'production'
 };
 await request('/apps/'+NAME+'/config-vars','PATCH',updates);
 console.log('Dedicated Heroku pilot config set; read-only Atlas credential validated.');
 console.log('Private access credentials configured and preserved; no secret values printed.');
 console.log('Original mterm2026 app and its configuration untouched.');
 console.log('Access password and API preview token can be revealed only in the private pilot Heroku Settings > Config Vars.');
}
if(require.main===module)main().catch(e=>{
 console.error('Private pilot configuration halted: '+String(e.message).slice(0,180));
 process.exitCode=1;
});
module.exports={main};
