'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),express=require('express');
const {createRouter}=require('./community-reports');
const docs=new Map();class Schema{static Types={Mixed:Object};index(){}}
const Model={findById(key){return {lean:async()=>structuredClone(docs.get(key)||null)};},async updateOne(query,update){const row=docs.get(query._id);if(row&&row.revision!==query.revision)throw Object.assign(Error('duplicate'),{code:11000});docs.set(query._id,structuredClone(update.$set));return {modifiedCount:row?1:0,upsertedCount:row?0:1};},async aggregate(){return [...docs.values()].flatMap(d=>d.events.filter(e=>e.active).map(e=>({event:{...e,contributors:e.contributors.length}})));}};
const mongoose={Schema,connection:{useDb:()=>({models:{},model:()=>Model})}};
test('actual HTTP report API validates origins, JSON-only location, GPS, successful write/read and disabled configuration',async()=>{
 const app=express();app.use(express.json({limit:'5mb'}));app.use('/reports',createRouter({express,mongoose,env:{JALAN_HASH_SECRET:'synthetic-secret'.repeat(4)}}));app.use('/disabled',createRouter({express,mongoose,env:{}}));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base='http://127.0.0.1:'+server.address().port;
 const send=(path,body,origin='https://zux12.github.io')=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});
 try{assert.equal((await fetch(base+'/reports/health')).status,200);
 assert.equal((await send('/reports/nearby?lat=3',{})).status,400);assert.equal((await send('/reports/nearby',{position:[101.687,3.139]},'https://other.invalid')).status,403);
 assert.equal((await send('/disabled/submit',{})).status,503);assert.equal((await send('/reports/submit',{text:'x'.repeat(13000)})).status,413);
 const data={actor:'synthetic_actor_1234567890123',type:'rain',position:[101.687,3.139],heading:90,road:{key:'fixture-road',level:'0:surface'},accuracy:8,fixAt:Date.now()};
 let response=await send('/reports/submit',data);assert.equal(response.status,201);const event=(await response.json()).event;assert.equal(event.type,'rain');
 response=await send('/reports/nearby',{position:data.position});assert.equal(response.status,200);assert.equal((await response.json()).events[0].id,event.id);
 assert.equal((await send('/reports/submit',{...data,accuracy:200})).status,400);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
