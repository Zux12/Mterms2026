'use strict';
// Restricted to the owner's mailbox. Does not implement author notifications.
const FROM='Oil & Gas Editorial Team <recognition@oilandgas.eu.com>';
const TO='m.zurix@oilandgas.eu.com'; // PRIVATE, fixed test recipient only; never a Reply-To
function readiness(env=process.env){
 return {configured:typeof env.OIL_RECOGNITION_RESEND_API_KEY==='string'&&
  /^re_[a-zA-Z0-9_\-]+$/.test(env.OIL_RECOGNITION_RESEND_API_KEY),
  sender:FROM,recipient:TO,authorEmailsEnabled:false};
}
async function sendOwnerTest({key,fetcher=fetch,idempotencyKey}){
 if(!/^re_[a-zA-Z0-9_\-]+$/.test(String(key||'')))throw Error('Resend key not configured');
 if(!/^wrrp-owner-test-[0-9a-f-]{36}$/.test(idempotencyKey))throw Error('Invalid test idempotency key');
 const response=await fetcher('https://api.resend.com/emails',{
  method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json',
   'Idempotency-Key':idempotencyKey},
  // Deliberately omit Reply-To: provider defaults to the editorial From address.
  // Never expose the owner's private administrative recipient to researchers.
  body:JSON.stringify({from:FROM,to:[TO],
   subject:'[OWNER TEST — NO AWARDS] Oil & Gas Research Recognition',
   html:'<div style="font-family:Arial,sans-serif;max-width:580px;margin:auto"><h1 style="color:#c19a52">Oil &amp; Gas Research Recognition</h1><p>This is a controlled Resend sender-identity test for the editorial team.</p><p>No researcher was recognized, and no author emails or letters were issued.</p><p>Sender: recognition@oilandgas.eu.com</p></div>',
   text:'Oil & Gas Research Recognition — OWNER TEST ONLY. No awards or author emails were issued.'})
 });
 const data=await response.json().catch(()=>({}));
 if(!response.ok||!data?.id){
  const error=new Error('Resend declined the owner-only test send');
  error.status=response.status;error.code=String(data?.name||'resend-error').slice(0,50);
  throw error;
 }
 return {providerMessageId:String(data.id).slice(0,100),state:'accepted-by-resend',
  note:'Provider accepted; actual delivery must be confirmed from Resend event/inbox.'};
}
module.exports={FROM,TO,readiness,sendOwnerTest};
