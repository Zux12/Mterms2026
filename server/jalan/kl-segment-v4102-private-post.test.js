'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const {parsePostedCoordinates,router}=require('./kl-segment-v4102');

function request(body,query={},type='application/json'){
 return {body,query,is:(mime)=>mime===type};
}
const good={startLat:3.139,startLng:101.6869,endLat:3.1478,endLng:101.6953};

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

// Invalid cases must fail before graph loading, without Atlas connectivity.
test('experimental POST rejects URL query coordinates and malformed JSON payloads with 400',async()=>{
 const app=express();
 app.use('/api/jalan/kl-segment-v4102',router);
 const server=app.listen(0,'127.0.0.1');
 try{
   await new Promise(resolve=>server.once('listening',resolve));
   const base='http://127.0.0.1:'+server.address().port+
      '/api/jalan/kl-segment-v4102/route';
   const cases=[
     {url:base+'?startLat=3.139',body:good},
     {url:base,body:{...good,endLat:'3.1478'}},
     {url:base,body:{...good,debug:'extra'}}
   ];
   for(const c of cases){
     const response=await fetch(c.url,{method:'POST',
       headers:{'Content-Type':'application/json'},body:JSON.stringify(c.body)});
     assert.equal(response.status,400);
     assert.match((await response.json()).error,/JSON coordinates required|numeric JSON coordinates required/);
   }
   const plain=await fetch(base,{method:'POST',
     headers:{'Content-Type':'text/plain'},body:'startLat=3.139'});
   assert.equal(plain.status,400);
 } finally{
   await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
 }
});
