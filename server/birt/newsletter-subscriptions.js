'use strict';
// Independent newsletter opt-in. No MongoDB, no membership side effects.
const express=require('express'),crypto=require('crypto');
const router=express.Router();
const FROM='BIRT Lab Research Digest <insights@birtlab.com>';
const ORIGINS=new Set(['https://birtlab.com','https://www.birtlab.com']);
const hits=new Map();
function config(){return {key:process.env.BIRT_RESEND_API_KEY,audience:process.env.BIRT_RESEND_AUDIENCE_ID,secret:process.env.BIRT_NEWSLETTER_SIGNING_SECRET}}
function limited(req,res,next){
 const ip=req.ip||'unknown',now=Date.now();
 for(const [k,v] of hits)if(v.until<now)hits.delete(k);
 const v=hits.get(ip)||{n:0,until:now+3600000};v.n++;hits.set(ip,v);
 if(v.n>5)return res.status(429).json({message:'Please try again later.'});
 next();
}
function sign(email,expires){
 const {secret}=config();
 const data=Buffer.from(JSON.stringify({email,expires})).toString('base64url');
 const mac=crypto.createHmac('sha256',secret).update(data).digest('base64url');
 return data+'.'+mac;
}
function verify(token){
 const {secret}=config();if(!secret||typeof token!=='string'||token.length>1600)return null;
 const [data,mac,...rest]=token.split('.');if(rest.length||!data||!mac)return null;
 const expected=crypto.createHmac('sha256',secret).update(data).digest();
 let actual;try{actual=Buffer.from(mac,'base64url')}catch{return null}
 if(actual.length!==expected.length||!crypto.timingSafeEqual(actual,expected))return null;
 let p;try{p=JSON.parse(Buffer.from(data,'base64url').toString('utf8'))}catch{return null}
 if(!p||typeof p.email!=='string'||!Number.isFinite(p.expires)||p.expires<Date.now())return null;
 return p.email;
}
async function resend(url,options){
 const r=await fetch('https://api.resend.com'+url,{...options,headers:{Authorization:'Bearer '+config().key,'Content-Type':'application/json',...(options.headers||{})},signal:AbortSignal.timeout(15000)});
 const j=await r.json().catch(()=>({}));if(!r.ok)throw Error('Resend HTTP '+r.status+': '+(j.message||'request failed'));return j;
}
router.post('/subscribe',limited,async(req,res)=>{
 if(!ORIGINS.has(req.get('Origin')))return res.status(403).json({message:'Origin not permitted'});
 const {key,audience,secret}=config();
 if(!key||!audience||!secret)return res.status(503).json({message:'Newsletter subscriptions are not yet open'});
 const email=String(req.body?.email||'').trim().toLowerCase();
 if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||req.body?.consent!==true)return res.status(400).json({message:'Valid email and explicit newsletter consent required'});
 try{
  const token=sign(email,Date.now()+48*3600000);
  const link='https://birtlab.com/research-digest-confirm.html?token='+encodeURIComponent(token);
  await resend('/emails',{method:'POST',body:JSON.stringify({from:FROM,to:[email],subject:'Confirm your BIRT Lab Research Digest subscription',html:'<div style="font-family:Arial,sans-serif"><h2>Confirm your subscription</h2><p>You requested the weekly BIRT Lab Research Digest. Please confirm within 48 hours.</p><p><a href="'+link+'">Confirm subscription</a></p><p>If you did not request this, ignore this email.</p></div>',text:'Confirm your BIRT Lab Research Digest subscription within 48 hours: '+link})});
  res.json({status:'pending',message:'If the address can receive mail, a confirmation link has been sent.'});
 }catch(e){console.error('BIRT subscribe:',e.message);res.status(502).json({message:'Unable to send confirmation email'})}
});
router.post('/confirm',limited,async(req,res)=>{
 const {key,audience,secret}=config();
 if(!key||!audience||!secret)return res.status(503).json({message:'Subscriptions are not yet open'});
 const email=verify(req.body?.token);if(!email)return res.status(400).json({message:'Confirmation link is invalid or expired'});
 try{
  await resend('/contacts',{method:'POST',body:JSON.stringify({email,audience_id:audience,unsubscribed:false})});
  res.json({status:'confirmed',message:'Subscription confirmed.'});
 }catch(e){console.error('BIRT confirm:',e.message);res.status(502).json({message:'Could not confirm subscription; please contact BIRT Lab.'})}
});
router.get('/health',(_req,res)=>res.json({service:'BIRT newsletter opt-in',configured:!!(config().key&&config().audience&&config().secret),sendingEnabled:false}));
module.exports=router;
