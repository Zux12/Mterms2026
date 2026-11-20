'use strict';
const crypto=require('node:crypto');
const windowMs=300000, sustainMs=120000, baselineMs=86400000;
const segmentOk=s=>typeof s==='string'&&/^s[a-f0-9]{16}$/.test(s);
const regionOk=s=>typeof s==='string'&&/^r-?\d{1,4}_-?\d{1,3}$/.test(s);
const invalid=()=>Object.assign(Error('Invalid traffic observation.'),{status:400});
const median=values=>{const a=values.slice().sort((x,y)=>x-y),i=Math.floor(a.length/2);return a.length%2?a[i]:(a[i-1]+a[i])/2;};
function score(samples,normal,at){
 const fresh=samples.filter(s=>s.at>at-windowMs);
 if(fresh.length<3||!(normal>=15))return null;
 const slow=fresh.filter(s=>s.speed<normal*.9),fast=fresh.filter(s=>s.speed>=normal*.8&&s.passSpeed>=normal*.8&&s.passedAt>at-windowMs);
 const speed=median(fresh.map(s=>s.speed)),ratio=speed/normal;
 // Keep one latest speed per installation. A fast majority with three completed
 // passages can clear the old queue even while older slow samples are expiring.
 const fastEnough=fresh.filter(s=>s.speed>=normal*.8).length>fresh.length/2&&ratio>=.8;
 if(!fastEnough&&(slow.length<3||slow.length<=fresh.length/2||ratio>=.9||
     Math.max(...slow.map(s=>s.at))-Math.max(at-windowMs,Math.min(...slow.map(s=>s.slowSince??s.at)))<sustainMs))return null;
 return {type:fastEnough?'smooth':ratio>=.7?'light':ratio>=.45?'moderate':'heavy',
  speed:Math.max(1,Math.round(speed)),normal,expiresAt:Math.min(...fresh.map(s=>s.at+windowMs)),
  clearAfter:fastEnough&&fast.length>=3?fast.map(s=>s.passedAt).sort((a,b)=>b-a)[2]:null};
}
function createFlowService({store,secret,clear,now=Date.now}){
 const hash=s=>crypto.createHmac('sha256',secret).update(s).digest('hex');
 async function observe(input){
  const {segment,region,driver,speed,normal,passAgeMs,road}=input||{};
  if(!segmentOk(segment)||!regionOk(region)||typeof driver!=='string'||!/^\w{64}$/.test(driver)||
    !Number.isInteger(speed)||speed<0||speed>200||!(normal===null||Number.isInteger(normal)&&normal>=15&&normal<=180)||
    !(passAgeMs===null||Number.isInteger(passAgeMs)&&passAgeMs>=0&&passAgeMs<=300000)||!road||!/^vector-[a-f0-9]{1,8}$/.test(road.key)||!/^-?\d{1,2}:(surface|bridge|tunnel)$/.test(road.level)||
    Object.keys(input).some(k=>!['segment','region','driver','speed','normal','passAgeMs','road'].includes(k)))throw invalid();
  const key=region+'.'+segment,actor=hash(segment+'|'+driver),at=now(),roadKey=hash('traffic|'+road.key+'|'+road.level);
  for(let attempt=0;attempt<8;attempt++){
   const old=await store.get(key),revision=old?.revision||0;
   const fresh=(old?.samples||[]).filter(s=>s.at>at-windowMs),prev=fresh.find(s=>s.actor===actor);
   const samples=fresh.filter(s=>s.actor!==actor).slice(-95);
   const sample={actor,roadKey,speed,normal,at,passedAt:passAgeMs!==null?at-passAgeMs-10000:prev?.passedAt||0,passSpeed:passAgeMs!==null?speed:prev?.passSpeed||0};
   samples.push(sample);
   const sameRoad=samples.every(s=>s.roadKey===roadKey);
   let baseline=old?.baseline?.until>at&&old.baseline.roadKey===roadKey?old.baseline:null;
   const normals=samples.map(s=>s.normal).filter(Number.isFinite);
   let usual=normals.length>=2?median(normals):baseline?.speed;
   if(!usual&&samples.length>=3&&sameRoad){
    const speeds=samples.filter(s=>s.passedAt>at-windowMs).map(s=>s.speed);
    if(speeds.length>=3&&Math.min(...speeds)>=25&&Math.max(...speeds)<=Math.min(...speeds)*1.2)usual=median(speeds);
   }
   if(sameRoad&&usual&&(normals.length>=2||!baseline))baseline={speed:usual,until:at+baselineMs,roadKey};
   const reference=usual||normal;
   if(reference&&speed<reference*.9)sample.slowSince=prev?.speed<reference*.9&&at-prev.at<90000?prev.slowSince??prev.at:at;
   const state=sameRoad?score(samples,usual,at):null;
   const value={segment,region,revision:revision+1,samples,baseline,state,expiresAt:new Date(at+windowMs)};
   if(!await store.cas(key,revision,value))continue;
   if(state?.clearAfter)await clear(roadKey,segment,state.clearAfter);
   return {ok:true};
  }
  throw Object.assign(Error('Please retry shortly.'),{status:409});
 }
 async function read({regions}={}){
  if(!Array.isArray(regions)||regions.length<1||regions.length>64||!regions.every(regionOk))throw invalid();
  const at=now(),rows=await store.read([...new Set(regions)],at);
  const sections=rows.filter(r=>r.state?.expiresAt>at).map(({segment,state:s})=>
   ({segment,type:s.type,speed:s.speed,normal:s.normal,expiresAt:s.expiresAt}));
  return {sections};
 }
 return {observe,read};
}
module.exports={createFlowService,segmentOk,score};
