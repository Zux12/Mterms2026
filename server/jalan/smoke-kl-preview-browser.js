'use strict';
// Real Chromium DOM smoke against a local fixture server. This checks browser
// interactions only; full-graph HTTP integration is separately tested read-only.
const {chromium}=require('playwright');
const express=require('express');
const path=require('node:path');
async function main(){
 const app=express();
 app.get('/',(_,res)=>res.sendFile(path.join(__dirname,'kl-pilot-preview.html')));
 app.get('/api/jalan/kl/health',(req,res)=>{
  if(req.get('x-jalan-preview-token')!=='browser-fixture-token')return res.sendStatus(401);
  res.json({ok:true,readOnly:true,liveRouting:false,graphEdges:168221,graphCached:true});
 });
 app.get('/api/jalan/kl/route',(req,res)=>{
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
  await page.locator('#check').click();
  await page.getByText('KL graph available:',{exact:false}).waitFor({timeout:15000});
  await page.locator('#start').fill('3.1315707, 101.7038508');
  await page.locator('#end').fill('3.1314573, 101.7038951');
  await page.locator('#route').click();
  await page.getByText('Legal driving route verified: NO',{exact:false}).waitFor({timeout:15000});
  await page.locator('#swap').click();
  await page.getByText('Start and destination swapped.',{exact:false}).waitFor({timeout:15000});
  if(errors.length)throw Error('Browser script error');
  process.stdout.write('Chromium pilot browser interactions passed against local fixture API.\n');
 }finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
}
main().catch(()=>{process.stderr.write('Chromium pilot smoke failed (details suppressed).\n');process.exitCode=1;});
