'use strict';
// Read-only, authenticated mobile-size Chromium smoke of the SEPARATE private
// Heroku JALAN pilot. Never log credentials, URLs with coordinates or GPS traces.
// Executes only after the trusted workflow verifies a new Heroku code release.
const {chromium}=require('playwright');
const APP='jalan-kl-private-pilot';
async function main(){
 const key=process.env.HEROKU_API_KEY;
 if(!key||key.length<16)throw Error('missing-service-credential');
 const response=await fetch('https://api.heroku.com/apps/'+APP,{
  headers:{Authorization:'Bearer '+key,Accept:'application/vnd.heroku+json; version=3'},
  redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('app-metadata-unavailable');
 const app=await response.json();
 if(app.name!==APP)throw Error('wrong-app');
 const origin=new URL(app.web_url);
 if(origin.protocol!=='https:'||!/^[a-z0-9-]+\.herokuapp\.com$/.test(origin.hostname))
  throw Error('invalid-private-domain');
 const configResponse=await fetch('https://api.heroku.com/apps/'+APP+'/config-vars',{
  headers:{Authorization:'Bearer '+key,Accept:'application/vnd.heroku+json; version=3'},
  redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!configResponse.ok)throw Error('pilot-config-unavailable');
 const config=await configResponse.json();
 const password=config.JALAN_PILOT_ACCESS_PASSWORD,token=config.JALAN_PREVIEW_TOKEN;
 if(!password||password.length<32||!token||token.length<32||password===token)
  throw Error('pilot-auth-unavailable');
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({
   viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,
   httpCredentials:{username:'jalan-pilot',password,origin:origin.origin},
   geolocation:{latitude:3.138888,longitude:101.688888,accuracy:12},
   permissions:[]});
  const page=await context.newPage();
  let scriptError=false;
  page.on('pageerror',()=>{scriptError=true;});
  const pageResponse=await page.goto(origin.origin+'/',{waitUntil:'domcontentloaded',timeout:30000});
  if(pageResponse?.status()!==200)throw Error('private-mobile-page-not-available');
  if(!(await page.locator('header .warning').innerText()).includes('EXPERIMENTAL ONLY'))
   throw Error('mobile-safety-disclosure-missing');
  await page.locator('.leaflet-container').waitFor({timeout:20000});
  const layout=await page.evaluate(()=>({
   scroll:document.documentElement.scrollWidth,
   width:window.innerWidth,
   mapWidth:document.getElementById('map').getBoundingClientRect().width,
   mapHeight:document.getElementById('map').getBoundingClientRect().height
  }));
  if(layout.scroll>layout.width+2||layout.mapWidth<250||layout.mapHeight<250)
   throw Error('mobile-layout-invalid');
  if(!(await page.locator('#gps-note').innerText()).includes('GPS is off.'))
   throw Error('mobile-gps-consent-invalid');
  await page.locator('#token').fill(token);
  await page.locator('#start').fill('3.1315707, 101.7038508');
  await page.locator('#end').fill('3.1314573, 101.7038951');
  await page.locator('#check').click();
  await page.getByText('KL graph available:',{exact:false}).waitFor({timeout:30000});
  await page.locator('#route').click();
  await page.getByText('Legal driving route verified: NO',{exact:false}).waitFor({timeout:30000});
  if((await page.locator('#trip-distance').innerText())!=='0.02 km')
   throw Error('mobile-distance-contract-invalid');
  if((await page.locator('.leaflet-overlay-pane path').count())<1)
   throw Error('mobile-route-not-rendered');
  const safety=await page.locator('#trip-safety').innerText();
  if(!safety.includes('driving legality unverified'))
   throw Error('mobile-driving-warning-missing');
  // Deliberately do NOT request actual GPS on the hosted pilot. Simulated
  // geolocation behavior is already covered by isolated Chromium fixtures.
  if(scriptError)throw Error('mobile-script-error');
  console.log('Private Heroku authenticated 390px mobile read-only route UI passed; not a legal navigation acceptance.');
 }finally{
  if(browser)await browser.close();
 }
}
main().catch(()=>{
 // Suppress raw browser/API errors to avoid exposing auth or GPS details in CI.
 console.error('Private JALAN mobile preview acceptance failed; inspect internal authenticated diagnostics.');
 process.exitCode=1;
});
