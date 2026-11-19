'use strict';
// BIRT weekly newsletter: Mondays 08:00 Asia/Kuala_Lumpur.
// Runs inside the existing Heroku web process. No MongoDB.
const INITIAL=['m.zurix@oilandgas.eu.com','alianahidayah@uitm.edu.my'];
const FROM='BIRT Lab Research Digest <insights@birtlab.com>';
const SOURCE='https://birtlab.com/research-digest-latest.html';
const WAIT=ms=>new Promise(r=>setTimeout(r,ms));
let running=false,lastCompleted=null;
function malaysiaClock(date){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kuala_Lumpur',weekday:'short',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).map(x=>[x.type,x.value]));
 return {weekday:parts.weekday,hour:Number(parts.hour),minute:Number(parts.minute),date:parts.year+'-'+parts.month+'-'+parts.day};
}
async function api(url,options={}){
 const key=process.env.BIRT_RESEND_API_KEY;
 if(!key)throw Error('Missing BIRT_RESEND_API_KEY');
 const response=await fetch('https://api.resend.com'+url,{...options,headers:{Authorization:'Bearer '+key,'Content-Type':'application/json',...(options.headers||{})},signal:AbortSignal.timeout(20000)});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Error('Resend HTTP '+response.status+' '+(data.message||''));
 return data;
}
async function audienceId(){
 if(process.env.BIRT_RESEND_AUDIENCE_ID)return process.env.BIRT_RESEND_AUDIENCE_ID;
 const data=await api('/audiences');
 const existing=(data.data||data.audiences||[]).find(x=>x.name==='BIRT Lab Research Digest');
 if(existing)return existing.id;
 const created=await api('/audiences',{method:'POST',body:JSON.stringify({name:'BIRT Lab Research Digest'})});
 if(!created.id)throw Error('Unable to create Resend audience');
 return created.id;
}
async function seed(audience){
 for(const email of INITIAL){
  try{await api('/contacts',{method:'POST',body:JSON.stringify({audience_id:audience,email,unsubscribed:false})})}
  catch(e){if(!/already exists|duplicate|409/i.test(e.message))throw e}
 }
}
async function contacts(audience){
 const result=[],seen=new Set();let after=null;
 for(let page=0;page<100;page++){
  const query=new URLSearchParams({limit:'100'});
  if(after)query.set('after',after);
  const data=await api('/audiences/'+encodeURIComponent(audience)+'/contacts?'+query);
  const items=data.data||[];
  for(const c of items){
   const email=String(c.email||'').toLowerCase();
   if(c.unsubscribed||!email||seen.has(email))continue;
   seen.add(email);result.push(email);
  }
  if(!data.has_more||!items.length)break;
  after=items[items.length-1].id;
  if(!after)break;
 }
 return result;
}
async function sendEdition(week){
 const response=await fetch(SOURCE,{signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error('Digest source HTTP '+response.status);
 const html=await response.text();
 if(html.length<2500||html.length>350000||!html.includes('BIRT Lab Research Digest'))throw Error('Invalid digest HTML');
 const issue=(html.match(/<title>[^<]*?(\d{4}-\d{2}-\d{2})<\/title>/i)||[])[1];
 if(issue!==week)throw Error('Published issue '+(issue||'unknown')+' does not match this week '+week);
 const audience=await audienceId();
 await seed(audience);
 const recipients=await contacts(audience);
 if(!recipients.length)throw Error('No subscribed recipients');
 let accepted=0,failed=0;
 for(const email of recipients){
  try{
   await api('/emails',{method:'POST',headers:{'Idempotency-Key':'birt-weekly-'+week+'-'+require('crypto').createHash('sha256').update(email).digest('hex').slice(0,20)},body:JSON.stringify({
    from:FROM,to:[email],subject:'BIRT Lab Research Digest — '+week,html,
    text:'BIRT Lab Research Digest — '+week+'\nRead online: '+SOURCE+'\nTo unsubscribe email research@birtlab.com with subject Unsubscribe from BIRT Lab Research Digest.'
   })});
   accepted++;
  }catch(e){failed++;console.error('[BIRT Digest] delivery request failed:',email,e.message)}
  await WAIT(700);
 }
 console.log('[BIRT Digest] week',week,'accepted',accepted,'failed',failed);
 if(failed)throw Error('Some Resend requests failed; retry with idempotency keys');
 return {accepted,failed};
}
async function tick(){
 if(running)return;
 const c=malaysiaClock(new Date());
 if(c.weekday!=='Mon'||c.hour!==8||c.minute>9)return;
 const monday=c.date;
 if(lastCompleted===monday)return;
 running=true;
 try{await sendEdition(monday);lastCompleted=monday}
 catch(e){console.error('[BIRT Digest] scheduled send:',e.message)}
 finally{running=false}
}
function start(){
 console.log('[BIRT Digest] weekly Monday 08:00 MYT scheduler started');
 tick().catch(e=>console.error('[BIRT Digest]',e.message));
 const timer=setInterval(()=>tick().catch(e=>console.error('[BIRT Digest]',e.message)),60000);
 timer.unref?.();
}
module.exports={start};
