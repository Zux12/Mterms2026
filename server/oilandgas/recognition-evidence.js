'use strict';
// WRRP paper evidence packet. Strictly editorial evidence, not a scientific-quality certificate.
// Stores short sourced extracts/notes entered after the original research was inspected.
const sections=['methodology','results','limitations','industryImplications'];
const safe=(value,max)=>typeof value==='string'&&value.trim().length>=30&&value.trim().length<=max;
function validatePacket(input){
 const issues=[];
 const packet={};
 for(const key of sections){
  if(!safe(input?.[key],4000))issues.push(key+' requires 30–4000 characters');
  else packet[key]=input[key].trim();
 }
 let sourceUrl='';
 try{const u=new URL(String(input?.evidenceUrl||''));if(u.protocol==='https:'&&!u.username&&!u.password&&
  /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(u.hostname))sourceUrl=u.href;}catch{}
 if(!sourceUrl)issues.push('A public HTTPS evidence URL is required');
 const confirmed=input?.sourceReviewed===true;
 if(!confirmed)issues.push('The original paper must have been examined and verified');
 return {valid:issues.length===0,issues,packet:{...packet,evidenceUrl:sourceUrl,sourceReviewed:confirmed}};
}
function availableEvidence(record,revision){
 return !!record&&record.revision===revision&&record.status==='verified'&&
  validatePacket({...record.packet,sourceReviewed:true}).valid;
}
function evidenceForModel(record){
 const p=record.packet||{};
 return Object.fromEntries(sections.map(k=>[k,String(p[k]||'').slice(0,4000)]));
}
module.exports={sections,validatePacket,availableEvidence,evidenceForModel};
