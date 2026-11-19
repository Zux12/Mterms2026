'use strict';
// Restricted to the owner's mailbox. Does not implement author notifications.
const FROM='Oil & Gas Editorial Team <recognition@oilandgas.eu.com>';
const TO='m.zurix@oilandgas.eu.com'; // PRIVATE, fixed test recipient only; never a Reply-To
function readiness(env=process.env){
 return {configured:typeof env.OIL_RECOGNITION_RESEND_API_KEY==='string'&&
  /^re_[a-zA-Z0-9_\-]+$/.test(env.OIL_RECOGNITION_RESEND_API_KEY),
  sender:FROM,recipient:TO,authorEmailsEnabled:false};
}
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[ch]));
// This is a deliberately fictional email with no award, recipient mapping,
// certificate ID, tracked link or database record.
function demoEmail(){
 const category="Research Editor's Pick of the Week";
 const paper='Illustrative Research Paper — Demonstration Only';
 const period='23–29 November 2026 (example dates)';
 const html='<!doctype html><html><body style="margin:0;padding:24px 10px;background:#f0efeb;font:15px/1.65 Arial,sans-serif;color:#26302c">'+
 '<table role="presentation" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;margin:auto;background:#fff;border-collapse:collapse">'+
 '<tr><td style="background:#26312e;padding:29px;text-align:center;color:white"><div style="font-size:32px;font-weight:800">oil &amp; gas<span style="color:#f66520">.</span></div><div style="letter-spacing:2px;font-size:10px">KNOWLEDGE • EXPERTISE • EXCHANGE</div></td></tr>'+
 '<tr><td style="background:#c19a52;padding:12px 22px;text-align:center;font-size:12px;font-weight:700;color:#242825">DEMONSTRATION EMAIL — NO RECOGNITION ISSUED</td></tr>'+
 '<tr><td style="padding:32px"><p style="color:#a47b32;font-size:12px;letter-spacing:1px;text-align:center">'+escapeHtml(category)+'</p>'+
 '<h1 style="font:normal 36px Georgia,serif;text-align:center">Congratulations!</h1>'+
 '<p>Dear Sample Researcher,</p>'+
 '<p>This message illustrates how an author will be notified when an actual, source-cleared paper is selected for Oil &amp; Gas Weekly Research Recognition.</p>'+
 '<div style="border-left:4px solid #c19a52;background:#f8f6f0;padding:18px;margin:20px 0"><strong>ILLUSTRATIVE PAPER — NOT A REAL AWARD</strong><br>'+escapeHtml(paper)+
 '<br><small>Sample featured week: '+escapeHtml(period)+'</small></div>'+
 '<p>An awarded researcher will receive an individually issued A4 Letter of Recognition with a unique QR code confirming the original recognition date, paper title and recipient in our permanent historical archive.</p>'+
 '<p style="text-align:center;margin:26px 0"><a href="https://oilandgas.eu.com/letter-demo.html" style="display:inline-block;background:#26312e;color:white;text-decoration:none;padding:13px 22px;border-radius:4px">View Sample A4 Letter</a></p>'+
 '<p style="font-size:12px;color:#6c6e68"><strong>Test limitation:</strong> No personal letter or scannable letter-verification QR exists for this fictional paper. The button opens a specimen A4 letter with a demonstration QR, not an officially issued recognition.</p>'+
 '<p>Warm regards,<br><strong>Oil &amp; Gas Editorial Team</strong></p></td></tr>'+
 '<tr><td style="background:#f7f5f0;padding:17px;text-align:center;font-size:11px">oilandgas.eu.com · Editorial recognition is not accredited academic certification.</td></tr></table></body></html>';
 const text='DEMONSTRATION EMAIL — NO RECOGNITION ISSUED\n\nCongratulations, Sample Researcher!\n'+
 'Sample category: '+category+'\nSample paper: '+paper+'\n'+period+
 '\n\nNo real recognition or individual letter has been issued. Real recipients will receive a personal A4 letter and permanently verifiable QR. Sample letter: https://oilandgas.eu.com/letter-demo.html\n\nOil & Gas Editorial Team';
 return {subject:'[DESIGN TEST — NO AWARDS] Congratulations! Oil & Gas Research Recognition',html,text};
}
// Owner-only email showing the actual A4 specimen and its demo-only QR.
// Never generates or references a real recognition certificate.
function letterDemoEmail(){
 const url='https://oilandgas.eu.com/letter-demo.html';
 const html='<!doctype html><html><body style="margin:0;background:#f0efeb;padding:25px 10px;font:15px/1.65 Arial,sans-serif;color:#29312d">'+
 '<table role="presentation" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;margin:auto;background:#fff;border-collapse:collapse">'+
 '<tr><td style="background:#27312e;color:#fff;text-align:center;padding:30px"><div style="font-weight:800;font-size:32px">oil &amp; gas<span style="color:#f66520">.</span></div><small>KNOWLEDGE • EXPERTISE • EXCHANGE</small></td></tr>'+
 '<tr><td style="padding:12px 22px;background:#c19a52;text-align:center;font-weight:700">STAGING TEST — NO AWARD ISSUED</td></tr>'+
 '<tr><td style="padding:32px"><h1 style="font:normal 32px Georgia,serif;text-align:center">A4 Letter of Recognition — Test</h1>'+
 '<p>Dear Dr. Ir. M. Zurix Mohamed,</p>'+
 '<p>This email tests the complete specimen recognition-letter presentation, PDF printing and QR scanning experience. No real research recognition has been granted.</p>'+
 '<div style="background:#f8f6f0;border-left:4px solid #c19a52;padding:18px"><strong>ILLUSTRATIVE PAPER — DEMONSTRATION ONLY</strong><br>Research Editor\'s Pick of the Week<br>Sample date: 19 November 2026</div>'+
 '<p style="text-align:center;margin:28px 0"><a href="'+url+'" style="background:#27312e;color:#fff;text-decoration:none;padding:15px 24px;display:inline-block">View Sample A4 Letter &amp; QR</a></p>'+
 '<p>The letter is marked <strong>SPECIMEN</strong>. Its QR opens a demonstration-only page, not a valid award verification record.</p>'+
 '<p>Regards,<br><strong>Oil &amp; Gas Editorial Team</strong></p></td></tr>'+
 '<tr><td style="padding:18px;background:#f7f5f0;text-align:center;font-size:11px">Editorial design test only · oilandgas.eu.com</td></tr></table></body></html>';
 const text='STAGING TEST — NO AWARD ISSUED\n\nDear Dr. Ir. M. Zurix Mohamed,\n\n'+
 'View the specimen A4 Letter of Recognition and its demo-only QR: '+url+
 '\n\nThis is not a real recognition. The specimen letter cannot verify a genuine award.\n\nOil & Gas Editorial Team';
 return {subject:'[STAGING TEST — NO AWARDS] Your A4 Recognition Letter and QR',html,text};
}
async function sendOwnerTest({key,fetcher=fetch,idempotencyKey,variant='identity'}){
 if(!/^re_[a-zA-Z0-9_\-]+$/.test(String(key||'')))throw Error('Resend key not configured');
 if(!/^wrrp-owner-test-[0-9a-f-]{36}$/.test(idempotencyKey))throw Error('Invalid test idempotency key');
 if(!['identity','congratulations-demo','letter-demo'].includes(variant))throw Error('Unsupported email test variant');
 const content=variant==='letter-demo'?letterDemoEmail():variant==='congratulations-demo'?demoEmail():{
  subject:'[OWNER TEST — NO AWARDS] Oil & Gas Research Recognition',
  html:'<div style="font-family:Arial,sans-serif;max-width:580px;margin:auto"><h1 style="color:#c19a52">Oil &amp; Gas Research Recognition</h1><p>This is a controlled Resend sender-identity test for the editorial team.</p><p>No researcher was recognized, and no author emails or letters were issued.</p><p>Sender: recognition@oilandgas.eu.com</p></div>',
  text:'Oil & Gas Research Recognition — OWNER TEST ONLY. No awards or author emails were issued.'};
 const response=await fetcher('https://api.resend.com/emails',{
  method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json',
   'Idempotency-Key':idempotencyKey},
  // Deliberately omit Reply-To: provider defaults to the editorial From address.
  // Never expose the owner's private administrative recipient to researchers.
  body:JSON.stringify({from:FROM,to:[TO],...content})
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
module.exports={FROM,TO,readiness,sendOwnerTest,demoEmail,letterDemoEmail};
