'use strict';
// Real Chromium DOM smoke against a local fixture server. This checks browser
// interactions only; full-graph HTTP integration is separately tested read-only.
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const {randomBytes}=require('node:crypto');
const express=require('express');
const path=require('node:path');
async function main(){
 if(process.env.JALAN_BROWSER_REAL_GRAPH==='1')return realGraphBrowser();
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
  await page.locator('#start').fill('3.130000, 101.700000');
  await page.getByText('Coordinates changed. Preview route to recalculate.',{exact:false}).waitFor({timeout:15000});
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
  // The browser must not render a route if the API claims turn enforcement
  // or legal driving verification; the preview contract requires both false.
  await page.route('**/api/jalan/kl/route?*',async route=>{
   const unsafe={ok:true,mode:'EXPERIMENTAL_SEGMENT_ROUTE',routingActivated:false,
    legalDrivingRouteVerified:true,turnRestrictionsEnforced:false,
    geometry:{type:'LineString',coordinates:[[101.7038508,3.1315707],[101.7038951,3.1314573]]}};
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(unsafe)});
  });
  await page.locator('#route').click();
  await page.getByText('Unexpected or unsafe preview response',{exact:false}).waitFor({timeout:15000});
  if((await page.locator('#status').innerText()).includes('Legal driving route verified: NO'))
   throw Error('Unsafe route rendered');
  if(errors.length)throw Error('Browser script error');
  process.stdout.write('Chromium pilot browser interactions passed against local fixture API.\n');
 }finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
}
async function realGraphBrowser(){
 if(!process.env.JALAN_READONLY_MONGODB_URI)throw Error('Read-only graph credential unavailable');
 const port=18866,token=randomBytes(32).toString('hex');
 const child=spawn(process.execPath,[path.join(__dirname,'run-kl-preview-local.js')],{
  env:{...process.env,JALAN_PREVIEW_TOKEN:token,JALAN_PREVIEW_PORT:String(port)},stdio:'ignore'});
 let browser;
 try{
  let ready=false;
  for(let i=0;i<45;i++){
   if(child.exitCode!==null)throw Error('Local graph preview exited');
   try{if((await fetch('http://127.0.0.1:'+port+'/')).ok){ready=true;break;}}catch(_){}
   await new Promise(resolve=>setTimeout(resolve,1000));
  }
  if(!ready)throw Error('Local graph preview startup timeout');
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+port+'/',{waitUntil:'domcontentloaded'});
  await page.locator('#token').fill(token);
  await page.locator('#check').click();
  await page.getByText('KL graph available:',{exact:false}).waitFor({timeout:15000});
  await page.locator('#start').fill('3.1315707, 101.7038508');
  await page.locator('#end').fill('3.1314573, 101.7038951');
  await page.locator('#route').click();
  await page.getByText('Legal driving route verified: NO',{exact:false}).waitFor({timeout:90000});
  if(errors.length)throw Error('Browser script error');
  const status=await page.locator('#status').innerText();
  if(!status.includes('Distance: 0.02 km')||!status.includes('Legal driving route verified: NO'))
   throw Error('Real graph browser route contract mismatch');
  process.stdout.write('Chromium and real read-only KL graph browser-to-backend smoke passed.\\n');
 }finally{
  if(browser)await browser.close();
  const exited=child.exitCode!==null||child.signalCode!==null;
  const wait=exited?Promise.resolve():new Promise(resolve=>child.once('exit',resolve));
  if(!exited)child.kill('SIGTERM');
  await Promise.race([wait,new Promise(resolve=>setTimeout(resolve,4000))]);
  if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');
 }
}
main().catch(e=>{
 const safe=e?.message?.includes('Leaflet')?'map-rendering':
  e?.message?.includes('Map click')?'map-click':
  e?.message?.includes('Timeout')?'browser-timeout':'browser-interaction';
 process.stderr.write('Chromium pilot smoke failed at '+safe+' (details suppressed).\n');
 process.exitCode=1;
});
