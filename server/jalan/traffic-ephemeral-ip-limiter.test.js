'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createEphemeralIpLimiter}=require('./traffic-ephemeral-ip-limiter');
function harness(){
 let now=1000,callback,cleared=false,unref=false;
 const limiter=createEphemeralIpLimiter({
   clock:()=>now,windowMs:60_000,limit:20,
   timerFactory:(fn,interval)=>{
     assert.equal(interval,60_000);
     callback=fn;
     return {unref(){unref=true}};
   },clearTimer:()=>{cleared=true;}
 });
 return {limiter,advance:ms=>{now+=ms;},tick:()=>callback(),
   timerUnref:()=>unref,closed:()=>cleared};
}
test('20 requests allowed per IP per minute, 21st rejected, IPs independent',()=>{
 const h=harness();
 try{
  assert.equal(h.timerUnref(),true);
  for(let i=0;i<20;i++)assert.equal(h.limiter.allow('198.51.100.8'),true);
  assert.equal(h.limiter.allow('198.51.100.8'),false);
  assert.equal(h.limiter.allow('198.51.100.9'),true);
  assert.equal(h.limiter.size(),2);
 }finally{h.limiter.close();}
 assert.equal(h.closed(),true);
});
test('idle sweep drops all expired IP-derived buckets without another HTTP request',()=>{
 const h=harness();
 try{
  h.limiter.allow('2001:db8::3');
  h.limiter.allow('198.51.100.11');
  assert.equal(h.limiter.size(),2);
  h.advance(59_999);h.tick();assert.equal(h.limiter.size(),2);
  h.advance(1);h.tick();assert.equal(h.limiter.size(),0);
  assert.equal(h.limiter.allow('2001:db8::3'),true);
  assert.equal(h.limiter.size(),1);
 }finally{h.limiter.close();}
});
test('window rollover reopens the existing client quota without carrying old usage',()=>{
 const h=harness();
 try{
  for(let i=0;i<21;i++)h.limiter.allow('198.51.100.10');
  h.advance(60_000);
  assert.equal(h.limiter.allow('198.51.100.10'),true);
  assert.equal(h.limiter.size(),1);
 }finally{h.limiter.close();}
});
