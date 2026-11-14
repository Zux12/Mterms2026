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

// Reproduces real original-Mterms middleware order: its 5 MB JSON parser
// consumes the request BEFORE the JALAN router. This test proves the new
// post-parse Content-Length decision, NOT a 1 KB pre-parser memory limit.
test('experimental POST enforces post-parse transport policy with upstream 5 MB parser',async()=>{
 const app=express();
 app.use(express.json({limit:'5mb'}));
 app.use('/api/jalan/kl-segment-v4102',router);
 const server=app.listen(0,'127.0.0.1');
 try{
   await new Promise(resolve=>server.once('listening',resolve));
   const base='http://127.0.0.1:'+server.address().port+
      '/api/jalan/kl-segment-v4102/route';
   async function send(body,opts={}){
     const res=await fetch(opts.url||base,{method:'POST',
       headers:{'Content-Type':'application/json',...(opts.headers||{})},body});
     return {status:res.status,data:await res.json()};
   }
   for(const body of [
     {...good,endLat:'3.1478'}, {...good,debug:'extra'}
   ]){
     const res=await send(JSON.stringify(body));
     assert.equal(res.status,400);
     assert.match(res.data.error,/JSON coordinates required|numeric JSON coordinates required/);
   }
   const query=await send(JSON.stringify(good),{url:base+'?startLat=3.139'});
   assert.equal(query.status,400);
   // A valid short JSON body reaches coordinate checks (not the graph).
   const normal=await send(JSON.stringify(outside));
   assert.equal(normal.status,400);
   assert.match(normal.data.error,/KL pilot region/);
   // Valid JSON with substantial trailing whitespace passes the shared 5 MB
   // parser, but MUST NOT reach the route handler.
   const oversized=await send(JSON.stringify(outside)+' '.repeat(1300));
   assert.equal(oversized.status,413);
   assert.match(oversized.data.error,/exceeds 1024 bytes/);
   const text=await fetch(base,{method:'POST',
     headers:{'Content-Type':'text/plain'},body:'startLat=3.139'});
   assert.equal(text.status,415);
   // Compression could conceal a large inflated body. Reject before route work,
   // even though the upstream parser has already processed the compressed JSON.
   const zipped=await send(gzipSync(JSON.stringify(outside)),{
     headers:{'Content-Encoding':'gzip'}
   });
   assert.equal(zipped.status,415);
   // A chunked request has no trustworthy Content-Length; fail closed.
   const chunked=await new Promise((resolve,reject)=>{
     const req=http.request(base,{method:'POST',headers:{
       'Content-Type':'application/json','Transfer-Encoding':'chunked'
     }},res=>{
       let data='';res.setEncoding('utf8');res.on('data',v=>data+=v);
       res.on('end',()=>resolve({status:res.statusCode,data:JSON.parse(data)}));
     });
     req.on('error',reject);req.write(JSON.stringify(outside));req.end();
   });
   assert.equal(chunked.status,411);
   assert.match(chunked.data.error,/Content-Length required/);
 } finally{
   await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
 }
});
