'use strict';
// JALAN shared opt-in observation rate limit: no raw client IP retained.
// Buckets expire during idle periods, not only when that same IP returns.
const {createHmac,randomBytes}=require('node:crypto');
function createEphemeralIpLimiter({
  limit=20,windowMs=60_000,clock=Date.now,
  timerFactory=setInterval,clearTimer=clearInterval
}={}){
  if(!Number.isSafeInteger(limit)||limit<1||!Number.isSafeInteger(windowMs)||windowMs<1)
    throw Error('invalid-ephemeral-ip-limiter-policy');
  const salt=randomBytes(32);
  const buckets=new Map();
  const fingerprint=ip=>createHmac('sha256',salt)
    .update(typeof ip==='string'&&ip?ip:'unknown').digest('hex');
  function sweep(){
    const now=clock();
    for(const [key,bucket] of buckets)if(bucket.until<=now)buckets.delete(key);
  }
  function allow(ip){
    const now=clock(),key=fingerprint(ip),previous=buckets.get(key);
    const bucket=previous&&previous.until>now?previous:{n:0,until:now+windowMs};
    bucket.n++;
    buckets.set(key,bucket);
    return bucket.n<=limit;
  }
  // One process-scoped, unref'd sweep avoids permanent IP-derived state
  // after the last observation. No DB, disk, logs, raw IPs or GPS involved.
  const timer=timerFactory(sweep,windowMs);
  timer?.unref?.();
  return {allow,sweep,close:()=>clearTimer(timer),size:()=>buckets.size};
}
module.exports={createEphemeralIpLimiter};
