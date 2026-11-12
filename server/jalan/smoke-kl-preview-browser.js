'use strict';
// Real Chromium DOM smoke against a local fixture server. This checks browser
// interactions only; full-graph HTTP integration is separately tested read-only.
const {chromium}=require('playwright');
const express=require('express');
const path=require('node:path');
async function main(){
 const app=express();
 let delayNextRoute=false;
 app.get('/',(_,res)=>res.sendFile(path.join(__dirname,'kl-pilot-preview.html')));
 app.get('/api/jalan/kl/health',(req,res)=>{
  if(req.get('x-jalan-preview-token')!=='browser-fixture-token')return res.sendStatus(401);
  res.json({ok:true,readOnly:true,liveRouting:false,graphEdges:168221,graphCached:true});
 });
 app.get('/api/jalan/kl/route',async(req,res)=>{
  if(delayNextRoute){delayNextRoute=false;await new Promise(resolve=>setTimeout(resolve,600));}
  if(req.get('x-jalan-preview-token')!=='browser-fixture-token')return res.sendStatus(401);
  res.json({ok:true,mode:'EXPERIMENTAL_SEGMENT_ROUTE',routingActivated:false,
   legalDrivingRouteVerified:false,turnRestrictionsEnforced:false,
   geometry:{type:'LineString',coordinates:[[101.7038508,3.1315707],[101.7038951,3.1314573]]},
   distanceMeters:17,illustrativeEtaMinutes:0,potentialTurnRestrictionReviewCount:0,
   potentialAccessReviewEdges:0});
 });
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
  await page.locator('#token').fill('browser-fixture-token');
  await page.locator('.leaflet-container').waitFor({timeout:15000});
  await page.locator('#check').click();
  await page.getByText('KL graph available:',{exact:false}).waitFor({timeout:15000});
  await page.locator('#start').fill('3.1315707, 101.7038508');
  await page.locator('#end').fill('3.1314573, 101.7038951');
  await page.locator('#route').click();
  await page.getByText('Legal driving route verified: NO',{exact:false}).waitFor({timeout:15000});
  await page.locator('#swap').click();
  await page.getByText('Start and destination swapped.',{exact:false}).waitFor({timeout:15000});
  if(await page.locator('.leaflet-pane').count()===0)
   throw Error('Leaflet map panes not rendered');
  // Clicking the map should populate coordinates and invalidate old route output.
  const before=await page.locator('#start').inputValue();
  await page.locator('#map').click({position:{x:120,y:120}});
  const after=await page.locator('#start').inputValue();
  if(after===before||!after.includes(','))throw Error('Map click did not select a coordinate');
  // A delayed response for the old destination must not repaint the route.
  delayNextRoute=true;
  await page.locator('#route').click();
  await page.locator('#swap').click();
  await page.waitForTimeout(900);
  if((await page.locator('#status').innerText()).includes('Legal driving route verified: NO'))
   throw Error('Stale route response repainted after endpoint swap');
  if(errors.length)throw Error('Browser script error');
  process.stdout.write('Chromium pilot browser interactions passed against local fixture API.\n');
 }finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
}
main().catch(e=>{
 const safe=e?.message?.includes('Leaflet')?'map-rendering':
  e?.message?.includes('Map click')?'map-click':
  e?.message?.includes('Timeout')?'browser-timeout':'browser-interaction';
 process.stderr.write('Chromium pilot smoke failed at '+safe+' (details suppressed).\n');
 process.exitCode=1;
});
