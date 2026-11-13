'use strict';
// Read-only authenticated smoke of SEPARATE private Heroku pilot; no coords logged.
// The dedicated Heroku config and Basic auth secrets are never printed.
const APP='jalan-kl-private-pilot';
async function main(){
 const key=process.env.HEROKU_API_KEY;
 if(!key||key.length<16)throw Error('Heroku workflow credential is unavailable');
 const headers={Authorization:'Bearer '+key,
  Accept:'application/vnd.heroku+json; version=3'};
 const get=async(url)=>{
  const r=await fetch(url,{headers,redirect:'error',
   signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw Error('Heroku API returned HTTP '+r.status);
  return r.json();
 };
 const app=await get('https://api.heroku.com/apps/'+APP);
 const vars=await get('https://api.heroku.com/apps/'+APP+'/config-vars');
 if(app.name!==APP)throw Error('Unexpected target application');
 const url=new URL(app.web_url);
 if(url.protocol!=='https:'||!/^[a-z0-9-]+\.herokuapp\.com$/.test(url.hostname))
  throw Error('Unexpected canonical Heroku domain');
 const pw=vars.JALAN_PILOT_ACCESS_PASSWORD,token=vars.JALAN_PREVIEW_TOKEN;
 if(!pw||pw.length<32||!token||token.length<32||pw===token)
  throw Error('Private Heroku pilot credentials not provisioned');
 const auth='Basic '+Buffer.from('jalan-pilot:'+pw).toString('base64');
 const request=async(path,timeout=20000)=>{
  const result=await fetch(url.origin+path,{
   headers:{Authorization:auth,'x-jalan-preview-token':token},
   redirect:'manual',signal:AbortSignal.timeout(timeout)});
  if(!result.ok)throw Error('Authenticated pilot HTTP '+result.status);
  return result;
 };
 const page=await request('/');
 const html=await page.text();
 if(!html.includes('EXPERIMENTAL ONLY')||!html.includes('not verified for legal driving'))
  throw Error('Experimental driving restriction missing from pilot HTML');
 const health=await (await request('/api/jalan/kl/health')).json();
 if(health.ok!==true||health.graphEdges!==168221||health.readOnly!==true||
  health.liveRouting!==false)
  throw Error('Read-only imported graph health mismatch');
 console.log('Private JALAN authenticated page and full-graph health verified.');
 // Graph import and topology audits can exceed Heroku's 30-second HTTP deadline.
 // Poll the non-mutating health endpoint until startup warmup has completed.
 let ready=health.graphCached===true;
 for(let i=0;!ready&&i<24;i++){
  await new Promise(resolve=>setTimeout(resolve,8000));
  const check=await (await request('/api/jalan/kl/health')).json();
  if(check.ok!==true||check.graphEdges!==168221||check.readOnly!==true)
   throw Error('Graph health changed during warmup');
  ready=check.graphCached===true;
 }
 if(!ready)throw Error('Private KL graph preloading did not complete');
 console.log('Heroku KL road graph cache is warm and ready for bounded route requests.');
 const route='/api/jalan/kl/route?startLat=3.1315707&startLng=101.7038508&endLat=3.1314573&endLng=101.7038951';
 const response=await (await request(route,120000)).json();
 if(response.ok!==true||response.mode!=='EXPERIMENTAL_SEGMENT_ROUTE'||
  response.graphEdges!==168221||response.legalDrivingRouteVerified!==false||
  response.turnRestrictionsEnforced!==false||response.databaseWrites!==0||
  response.routingActivated!==false)
  throw Error('Private JALAN route failed strict diagnostic-only contract');
 console.log('Private Heroku read-only KL route verified. No driving legitimacy claimed.');
}
if(require.main===module)main().catch(e=>{
 console.error('Private authenticated smoke failed: '+String(e.message).slice(0,160));
 process.exitCode=1;
});
