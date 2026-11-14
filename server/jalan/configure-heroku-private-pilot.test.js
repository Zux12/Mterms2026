'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {main}=require('./configure-heroku-private-pilot');

const originalFetch=global.fetch;
const originalKey=process.env.HEROKU_API_KEY;
const originalUri=process.env.JALAN_READONLY_MONGODB_URI;
const uri='mongodb+srv://jalan_readonly:fakePassword@example.mongodb.net/jalan_navigation';
const password='P'.repeat(64),token='T'.repeat(64);
function mock(initial){
 const events=[],state={...initial};
 global.fetch=async(url,opts={})=>{
  const pathname=new URL(url).pathname,method=opts.method||'GET';
  events.push({pathname,method,body:opts.body?JSON.parse(opts.body):null});
  let data;
  if(pathname==='/apps/mterm2026'&&method==='GET')data={id:'original-app'};
  else if(pathname==='/apps/jalan-kl-private-pilot'&&method==='GET')data={id:'isolated-app',name:'jalan-kl-private-pilot'};
  else if(pathname==='/apps/jalan-kl-private-pilot/config-vars'&&method==='GET')data={...state};
  else if(pathname==='/apps/jalan-kl-private-pilot/config-vars'&&method==='PATCH'){
   Object.assign(state,JSON.parse(opts.body));data={...state};
  }else throw Error('Unexpected or unsafe Heroku API operation '+method+' '+pathname);
  return {ok:true,json:async()=>data};
 };
 return {events,state};
}
async function check(initial){
 process.env.HEROKU_API_KEY='f'.repeat(32);
 process.env.JALAN_READONLY_MONGODB_URI=uri;
 const scenario=mock(initial);
 try{await main();return scenario;}finally{
  global.fetch=originalFetch;
  if(originalKey===undefined)delete process.env.HEROKU_API_KEY;
  else process.env.HEROKU_API_KEY=originalKey;
  if(originalUri===undefined)delete process.env.JALAN_READONLY_MONGODB_URI;
  else process.env.JALAN_READONLY_MONGODB_URI=originalUri;
 }
}
test('matching private configuration performs three GETs and zero PATCHes',async()=>{
 const x=await check({JALAN_READONLY_MONGODB_URI:uri,JALAN_PILOT_ACCESS_PASSWORD:password,
  JALAN_PREVIEW_TOKEN:token,JALAN_PILOT_MODE:'EXPERIMENTAL_SEGMENT_ROUTE',
  JALAN_DATABASE_WRITES_ENABLED:'false',JALAN_TURN_ENFORCEMENT_ENABLED:'false',
  NODE_ENV:'production'});
 assert.deepEqual(x.events.map(e=>e.method),['GET','GET','GET']);
});
test('missing pilot safety flags cause only a minimal dedicated-app PATCH',async()=>{
 const x=await check({JALAN_READONLY_MONGODB_URI:uri,JALAN_PILOT_ACCESS_PASSWORD:password,
  JALAN_PREVIEW_TOKEN:token,NODE_ENV:'production'});
 const patches=x.events.filter(e=>e.method==='PATCH');
 assert.equal(patches.length,1);
 assert.equal(patches[0].pathname,'/apps/jalan-kl-private-pilot/config-vars');
 assert.deepEqual(patches[0].body,{JALAN_PILOT_MODE:'EXPERIMENTAL_SEGMENT_ROUTE',
  JALAN_DATABASE_WRITES_ENABLED:'false',JALAN_TURN_ENFORCEMENT_ENABLED:'false'});
});
test('mismatched existing readonly database credential refuses all config mutations',async()=>{
 process.env.HEROKU_API_KEY='f'.repeat(32);
 process.env.JALAN_READONLY_MONGODB_URI=uri;
 const x=mock({JALAN_READONLY_MONGODB_URI:'mongodb+srv://jalan_readonly:other@example.mongodb.net'});
 try{
  await assert.rejects(main(),/Existing pilot read-only MongoDB URI differs/);
  assert.equal(x.events.filter(e=>e.method==='PATCH').length,0);
 }finally{
  global.fetch=originalFetch;
  if(originalKey===undefined)delete process.env.HEROKU_API_KEY;
  else process.env.HEROKU_API_KEY=originalKey;
  if(originalUri===undefined)delete process.env.JALAN_READONLY_MONGODB_URI;
  else process.env.JALAN_READONLY_MONGODB_URI=originalUri;
 }
});
