'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const http=require('node:http');
const {gzipSync}=require('node:zlib');
const {parsePostedCoordinates,router}=require('./kl-segment-v4102');

function request(body,query={},type='application/json'){
 return {body,query,is:(mime)=>mime===type};
}
const good={startLat:3.139,startLng:101.6869,endLat:3.1478,endLng:101.6953};
const outside={...good,startLat:4.5}; // invalid pilot coordinate: no graph/Atlas reads

test('JSON-body KL preview validates exactly four finite numeric coordinates',()=>{
 assert.deepEqual(parsePostedCoordinates(request(good)),{
   start:[good.startLat,good.startLng],end:[good.endLat,good.endLng]
 });
 for(const b of [
   {...good,startLat:'3.139'}, {...good,endLat:null},
   {...good,startLng:Infinity}, {...good,debug:'extra'}, [good], null
 ]) assert.equal(parsePostedCoordinates(request(b)),null);
 assert.equal(parsePostedCoordinates(request(good,{startLat:'3.139'})),null);
 assert.equal(parsePostedCoordinates(request(good,{},'text/plain')),null);
});

// Reproduces original-Mterms middleware order: its 5 MB JSON parser consumes
// each request before the JALAN router. Covers legal chunked framing, but
// does NOT establish a 1 KB pre-parser ingress cap or live Heroku behavior.
test('shared original-app experimental route defaults OFF for GET and POST',async()=>{
 const old=process.env.JALAN_SHARED_KL_PREVIEW_ENABLED;
 delete process.env.JALAN_SHARED_KL_PREVIEW_ENABLED;
 const app=express();app.use(express.json({limit:'5mb'}));
 app.use('/api/jalan/kl-segment-v4102',router);
 const server=app.listen(0,'127.0.0.1');
 try{
  await new Promise(resolve=>server.once('listening',resolve));
  const url='http://127.0.0.1:'+server.address().port+
   '/api/jalan/kl-segment-v4102/route';
  const get=await fetch(url);
  const post=await fetch(url,{method:'POST',
    headers:{'Content-Type':'application/json'},body:JSON.stringify(good)});
  for(const response of [get,post]){
   assert.equal(response.status,503);
   assert.equal(response.headers.get('cache-control'),'no-store');
   assert.match((await response.json()).error,/not enabled/);
  }
 }finally{
  await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  if(old===undefined)delete process.env.JALAN_SHARED_KL_PREVIEW_ENABLED;
  else process.env.JALAN_SHARED_KL_PREVIEW_ENABLED=old;
 }
});
test('experimental POST supports framed JSON and validates after the upstream 5 MB parser',async()=>{
 const previousGate=process.env.JALAN_SHARED_KL_PREVIEW_ENABLED;
 const previousToken=process.env.JALAN_SHARED_KL_PREVIEW_TOKEN;
 const fixtureToken='offline-only-not-a-live-key-0123456789abcdef';
 process.env.JALAN_SHARED_KL_PREVIEW_ENABLED='true';
 process.env.JALAN_SHARED_KL_PREVIEW_TOKEN=fixtureToken;
 const app=express();
 app.use(express.json({limit:'5mb'}));
 app.use('/api/jalan/kl-segment-v4102',router);
 const server=app.listen(0,'127.0.0.1');
 try{
   await new Promise(resolve=>server.once('listening',resolve));
   const base='http://127.0.0.1:'+server.address().port+
      '/api/jalan/kl-segment-v4102/route';
   // Shared deployment is NOT the private Basic-auth pilot: an operator
   // enable flag without a separate strong server token must fail closed.
   delete process.env.JALAN_SHARED_KL_PREVIEW_TOKEN;
   const missingSecret=await fetch(base,{method:'POST',headers:{
     'Content-Type':'application/json','X-JALAN-Preview-Token':fixtureToken
   },body:JSON.stringify(outside)});
   assert.equal(missingSecret.status,503);
   assert.equal(missingSecret.headers.get('cache-control'),'no-store');
   process.env.JALAN_SHARED_KL_PREVIEW_TOKEN='weak';
   const weakSecret=await fetch(base,{method:'POST',headers:{
     'Content-Type':'application/json','X-JALAN-Preview-Token':fixtureToken
   },body:JSON.stringify(outside)});
   assert.equal(weakSecret.status,503);
   process.env.JALAN_SHARED_KL_PREVIEW_TOKEN=fixtureToken;
   const noCredential=await fetch(base,{method:'POST',headers:{
     'Content-Type':'application/json'
   },body:JSON.stringify(outside)});
   assert.equal(noCredential.status,401);
   assert.equal(noCredential.headers.get('cache-control'),'no-store');
   assert.equal(noCredential.headers.get('referrer-policy'),'no-referrer');
   const incorrectCredential=await fetch(base,{method:'POST',headers:{
     'Content-Type':'application/json','X-JALAN-Preview-Token':'invalid'
   },body:JSON.stringify(outside)});
   assert.equal(incorrectCredential.status,401);
   assert.ok(!(await incorrectCredential.text()).includes(fixtureToken));
   // Activating JSON POST must NOT reactivate the legacy coordinate-in-URL
   // GET route. The 410 only blocks application processing, not upstream
   // router URL logging; redaction remains an operator-owned release gate.
   const legacy=await fetch(base+'?startLat=3.139&startLng=101.6869&endLat=3.1478&endLng=101.6953');
   assert.equal(legacy.status,410);
   assert.equal(legacy.headers.get('cache-control'),'no-store');
   assert.equal(legacy.headers.get('referrer-policy'),'no-referrer');
   assert.match((await legacy.json()).error,/GET preview retired/);
   async function send(body,opts={}){
     const res=await fetch(opts.url||base,{method:'POST',
       headers:{'Content-Type':'application/json','X-JALAN-Preview-Token':fixtureToken,...(opts.headers||{})},body});
     return {status:res.status,headers:res.headers,data:await res.json()};
   }
   for(const body of [
     {...good,endLat:'3.1478'}, {...good,debug:'extra'}
   ]){
     const res=await send(JSON.stringify(body));
     assert.equal(res.status,400);
     assert.match(res.data.error,/JSON coordinates required|numeric JSON coordinates required/);
   }
   // Even malformed/rejected requests containing potential location data
   // must not be cached, and must discourage referrer forwarding.
   const bad=await send(JSON.stringify({...good,endLat:'3.1478'}));
   assert.equal(bad.status,400);
   assert.equal(bad.headers.get('cache-control'),'no-store');
   assert.equal(bad.headers.get('referrer-policy'),'no-referrer');
   assert.equal(bad.headers.get('x-content-type-options'),'nosniff');
   const query=await send(JSON.stringify(good),{url:base+'?startLat=3.139'});
   assert.equal(query.status,400);
   // A valid short JSON body reaches coordinate checks (not the graph).
   const normal=await send(JSON.stringify(outside));
   assert.equal(normal.status,400);
   assert.match(normal.data.error,/KL pilot region/);
   assert.equal(normal.headers.get('cache-control'),'no-store');
   assert.equal(normal.headers.get('referrer-policy'),'no-referrer');
   assert.equal(normal.headers.get('x-content-type-options'),'nosniff');
   // Valid JSON with substantial trailing whitespace passes the shared 5 MB
   // parser, but MUST NOT reach the route handler.
   const oversized=await send(JSON.stringify(outside)+' '.repeat(1300));
   assert.equal(oversized.status,413);
   assert.equal(oversized.headers.get('cache-control'),'no-store');
   assert.match(oversized.data.error,/exceeds 1024 bytes/);
   const text=await fetch(base,{method:'POST',
     headers:{'Content-Type':'text/plain'},body:'startLat=3.139'});
   assert.equal(text.status,415);
   assert.equal(text.headers.get('cache-control'),'no-store');
   assert.equal(text.headers.get('referrer-policy'),'no-referrer');
   // Compression could conceal a large inflated body. Reject before route work,
   // even though the upstream parser has already processed the compressed JSON.
   const zipped=await send(gzipSync(JSON.stringify(outside)),{
     headers:{'Content-Encoding':'gzip'}
   });
   assert.equal(zipped.status,415);
   // A chunked body is valid HTTP framing. A browser cannot explicitly
   // set Content-Length, so do not reject solely for its absence. Use a
   // public non-routable-in-pilot fixture to avoid Atlas graph operations.
   async function chunked(body){
     return await new Promise((resolve,reject)=>{
       const req=http.request(base,{method:'POST',headers:{
         'Content-Type':'application/json','Transfer-Encoding':'chunked'
       }},res=>{
         let data='';res.setEncoding('utf8');res.on('data',v=>data+=v);
         res.on('end',()=>resolve({status:res.statusCode,data:JSON.parse(data)}));
       });
       req.on('error',reject);req.write(body);req.end();
     });
   }
   const framed=await chunked(JSON.stringify(outside));
   assert.equal(framed.status,400);
   assert.match(framed.data.error,/KL pilot region/);
   // Unknown wire size remains bounded only by upstream 5 MB parser.
   // Even for chunked bodies, an oversized parsed coordinate object fails
   // schema validation before any graph read.
   const badSchema=await chunked(JSON.stringify({...outside,debug:'x'.repeat(1600)}));
   assert.equal(badSchema.status,400);
   assert.match(badSchema.data.error,/Four numeric JSON coordinates required/);
 } finally{
   await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
   if(previousGate===undefined)delete process.env.JALAN_SHARED_KL_PREVIEW_ENABLED;
   else process.env.JALAN_SHARED_KL_PREVIEW_ENABLED=previousGate;
   if(previousToken===undefined)delete process.env.JALAN_SHARED_KL_PREVIEW_TOKEN;
   else process.env.JALAN_SHARED_KL_PREVIEW_TOKEN=previousToken;
 }
});
