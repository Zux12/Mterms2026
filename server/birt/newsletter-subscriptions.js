'use strict';
// Single-step newsletter opt-in. No MongoDB, no membership side effects.
const express=require('express');
const router=express.Router();
const ORIGINS=new Set(['https://birtlab.com','https://www.birtlab.com']);
const hits=new Map();
function config(){return {key:process.env.BIRT_RESEND_API_KEY,audience:process.env.BIRT_RESEND_AUDIENCE_ID}}
function limited(req,res,next){
 const ip=req.ip||'unknown',now=Date.now();
 for(const [k,v] of hits)if(v.until<now)hits.delete(k);
 const v=hits.get(ip)||{n:0,until:now+3600000};v.n++;hits.set(ip,v);
 if(v.n>5)return res.status(429).json({message:'Please try again later.'});
 next();
}
async function resend(url,options){
 const r=await fetch('https://api.resend.com'+url,{...options,headers:{Authorization:'Bearer '+config().key,'Content-Type':'application/json',...(options.headers||{})},signal:AbortSignal.timeout(15000)});
 const j=await r.json().catch(()=>({}));
 if(!r.ok)throw Error('Resend HTTP '+r.status+': '+(j.message||'request failed'));
 return j;
}
let audienceCache=null;
async function resolveAudience(){
 const configured=config().audience;
 if(configured)return configured;
 if(audienceCache)return audienceCache;
 // Use an existing dedicated audience if available; otherwise create one.
 const response=await resend('/audiences',{method:'GET'});
 const audiences=response.data||response.audiences||[];
 const existing=audiences.find(a=>a.name==='BIRT Lab Research Digest');
 if(existing){audienceCache=existing.id;return audienceCache}
 const created=await resend('/audiences',{method:'POST',body:JSON.stringify({name:'BIRT Lab Research Digest'})});
 if(!created.id)throw Error('Resend did not return an audience ID');
 audienceCache=created.id;
 return audienceCache;
}
router.post('/subscribe',limited,async(req,res)=>{
 if(!ORIGINS.has(req.get('Origin')))return res.status(403).json({message:'Origin not permitted'});
 const {key}=config();
 if(!key)return res.status(503).json({message:'Newsletter subscriptions are not yet open'});
 const email=String(req.body?.email||'').trim().toLowerCase();
 if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||req.body?.consent!==true)
  return res.status(400).json({message:'Valid email and explicit newsletter consent required'});
 try{
  const audience=await resolveAudience();
  // Create contact directly; do not automatically reactivate existing contacts
  // that previously unsubscribed.
  await resend('/contacts',{method:'POST',body:JSON.stringify({email,audience_id:audience,unsubscribed:false})});
  res.json({status:'subscribed',message:'You are subscribed to the BIRT Lab Research Digest.'});
 }catch(e){
  if(/already exists|duplicate|already been added|409/i.test(e.message))
   return res.json({status:'existing',message:'This email is already registered. If you previously unsubscribed, contact BIRT Lab to rejoin.'});
  console.error('BIRT newsletter subscription:',e.message);
  res.status(502).json({message:'Unable to complete subscription. Please try again later.'});
 }
});
router.get('/health',(_req,res)=>res.json({service:'BIRT newsletter direct opt-in',configured:!!config().key,sendingEnabled:false}));
module.exports=router;
