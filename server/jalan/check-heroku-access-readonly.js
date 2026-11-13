'use strict';
// Strictly read-only owner Heroku authentication probe, intended for GitHub Actions.
// Does not deploy, create apps, set config, or output secret values.
const key=process.env.HEROKU_API_KEY;
async function main(){
 if(typeof key!=='string'||key.length<16)throw Error('HEROKU_API_KEY unavailable in this workflow');
 const headers={Accept:'application/vnd.heroku+json; version=3',Authorization:'Bearer '+key};
 const signal=AbortSignal.timeout(15000);
 async function get(url){
  const res=await fetch(url,{headers,signal,redirect:'error'});
  if(res.status!==200&&res.status!==404)throw Error('Heroku returned HTTP '+res.status);
  return res;
 }
 const account=await get('https://api.heroku.com/account');
 if(account.status!==200)throw Error('Heroku API authentication failed');
 const data=await account.json();
 if(!data?.id)throw Error('Heroku account record missing');
 console.log('Heroku API authenticated. Probe is read-only.');
 const apps=[];
 for(const name of ['mterm2026','mterms2026']){
  const result=await get('https://api.heroku.com/apps/'+encodeURIComponent(name));
  if(result.status===200){apps.push(name);console.log('Existing app accessible: '+name);}
  else console.log('App alias not visible: '+name);
 }
 if(apps.length===0)throw Error('Neither expected original MTERMS app alias was visible. Inspect before deployment.');
 console.log('Verified account access and existing application visibility; no mutations performed.');
}
if(require.main===module)main().catch(e=>{
 console.error('Heroku read-only verification failed: '+String(e.message).slice(0,160));
 process.exitCode=1;
});
module.exports={main};
