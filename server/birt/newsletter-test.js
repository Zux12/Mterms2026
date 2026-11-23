'use strict';
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const RECIPIENT = 'm.zurix@oilandgas.eu.com';
const FROM = 'BIRT Lab Research Digest <insights@birtlab.com>';
function safeEqual(a,b){const x=Buffer.from(String(a));const y=Buffer.from(String(b));return x.length===y.length&&crypto.timingSafeEqual(x,y);}
function requireAdmin(req,res,next){
 const token=(req.get('Authorization')||'').replace(/^Bearer /,'');
 const parts=token.split('.');
 const secret=process.env.BIRT_ADMIN_TOKEN_SECRET||process.env.SESSION_SECRET;
 if(!secret||parts.length!==2)return res.status(401).json({status:'error',message:'Unauthorized'});
 const signature=crypto.createHmac('sha256',secret).update(parts[0]).digest('base64url');
 if(!safeEqual(signature,parts[1]))return res.status(401).json({status:'error',message:'Unauthorized'});
 try{const payload=JSON.parse(Buffer.from(parts[0],'base64url').toString());if(payload.scope!=='birt-admin'||!Number.isFinite(payload.exp)||payload.exp<=Date.now()/1000)throw Error('Expired');}
 catch{return res.status(401).json({status:'error',message:'Session expired'});}
 next();
}
router.post('/test-email',requireAdmin,async(req,res)=>{
 if(process.env.BIRT_NEWSLETTER_TEST_ENABLED!=='true')return res.status(503).json({status:'disabled',message:'Test sending is disabled. Set BIRT_NEWSLETTER_TEST_ENABLED=true temporarily.'});
 const key=process.env.BIRT_RESEND_API_KEY;
 if(!key)return res.status(503).json({status:'error',message:'Resend key is not configured'});
 const html='<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#102b31"><h1 style="color:#087f7b">BIRT Lab Research Digest</h1><h2>Resend integration test</h2><p>This is a one-time test of the BIRT Lab newsletter email connection. Weekly distribution is not active.</p><p>Sender: insights@birtlab.com</p><p><a href="https://birtlab.com">Visit BIRT Lab</a></p></div>';
 try{
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':'birt-newsletter-test-'+new Date().toISOString().slice(0,10)},body:JSON.stringify({from:FROM,to:[RECIPIENT],subject:'BIRT Lab Research Digest — Resend Test',html,text:'BIRT Lab Research Digest — Resend integration test. Weekly distribution is not active. https://birtlab.com'})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){console.error('BIRT Resend test failed',response.status,data.message||'');return res.status(502).json({status:'error',message:'Resend rejected the test email',providerStatus:response.status,detail:data.message||null});}
  return res.json({status:'submitted',recipient:RECIPIENT,resendId:data.id||null});
 }catch(error){console.error('BIRT Resend test request failed',error.message);return res.status(502).json({status:'error',message:'Resend request failed'});}
});

router.post('/test-digest',requireAdmin,async(req,res)=>{
 if(process.env.BIRT_NEWSLETTER_TEST_ENABLED!=='true')return res.status(503).json({status:'disabled',message:'Test sending is disabled. Set BIRT_NEWSLETTER_TEST_ENABLED=true temporarily.'});
 const key=process.env.BIRT_RESEND_API_KEY;
 if(!key)return res.status(503).json({status:'error',message:'Resend key is not configured'});
 try{
  // Fetch only the published issue from our fixed, trusted origin. Never accept an
  // arbitrary URL from a request body (SSRF protection).
  const source='https://birtlab.com/research-digest-latest.html';
  const fetched=await fetch(source,{signal:AbortSignal.timeout(18000),headers:{Accept:'text/html'}});
  if(!fetched.ok)throw Error('Newsletter source HTTP '+fetched.status);
  const html=await fetched.text();
  if(html.length<2500||html.length>350000||!/<html\b/i.test(html)||!/<title>[^<]*BIRT Lab Research Digest/i.test(html)||!/<a\b[^>]*href=["']https:\/\/(?:europepmc\.org|doi\.org|api\.openalex\.org|openalex\.org|www\.ebi\.ac\.uk)\//i.test(html))throw Error('Published digest HTML failed validation: missing expected title or research source links');
  const issue=(html.match(/<title>[^<]*?(\d{4}-\d{2}-\d{2})<\/title>/i)||[])[1];
  if(!issue)throw Error('Cannot identify the published digest issue date');
  const text='BIRT Lab Research Digest — '+issue+'\nRead the full published edition: '+source+'\nThis is a private test. Weekly distribution is not active.';
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{
   Authorization:'Bearer '+key,'Content-Type':'application/json',
   'Idempotency-Key':'birt-digest-full-test-'+issue+'-'+new Date().toISOString().slice(0,10)
  },body:JSON.stringify({from:FROM,to:[RECIPIENT],subject:'BIRT Lab Research Digest — '+issue,html,text}) ,signal:AbortSignal.timeout(20000)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){console.error('BIRT full digest test rejected',response.status,data.message||'');return res.status(502).json({status:'error',message:'Resend rejected full newsletter test',detail:data.message||null});}
  res.json({status:'submitted',recipient:RECIPIENT,issue,source,resendId:data.id||null,note:'Provider accepted request; inbox delivery not yet confirmed.'});
 }catch(error){console.error('BIRT full digest test failed',error.message);res.status(502).json({status:'error',message:'Unable to send published digest',detail:error.message});}
});

module.exports=router;
