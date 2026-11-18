'use strict';
// HTML email for admin-only Friday WRRP preview. All dynamic data escaped.
const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={'editors-pick':"Editor's Pick of the Week",'industry-impact':'Industry Impact Spotlight','emerging-research':'Emerging Research Spotlight'};
const formatDate=d=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Kuala_Lumpur'}).format(new Date(d));
const plannedStart=(now=new Date())=>{
 const shifted=new Date(new Date(now).getTime()+8*3600000);
 const dow=(shifted.getUTCDay()+6)%7;
 // Current week's Monday 09 MYT, then next if we are past Friday 09 MYT.
 shifted.setUTCHours(9,0,0,0);shifted.setUTCDate(shifted.getUTCDate()-dow);
 let monday=new Date(shifted.getTime()-8*3600000);
 const friday=new Date(monday.getTime()-3*86400000);
 if(new Date(now)>=monday||new Date(now)>=friday)monday=new Date(monday.getTime()+7*86400000);
 return monday;
};
const previewAt=start=>new Date(new Date(start).getTime()-3*86400000);
function mailContents({start,items=[]}){
 const begin=new Date(start),end=new Date(begin.getTime()+7*86400000);
 const byCategory=new Map(items.map(x=>[x.category,x]));
 const missing=Object.keys(labels).filter(k=>!byCategory.get(k)?.candidate).length;
 const rows=Object.entries(labels).map(([key,label])=>{
  const c=byCategory.get(key)?.candidate;
  const data=c?'<div style="font-size:16px;line-height:1.5;font-weight:700;color:#202827">'+escapeHtml(c.title)+'</div>'+
   '<div style="font-size:13px;color:#5e6662;padding-top:6px">'+escapeHtml(c.byline||'')+'</div>'+
   '<div style="font-size:12px;color:#846731;padding-top:8px">Score: '+escapeHtml(c.assessment?.total??'Pending')+'/100 · '+escapeHtml(c.reference||'')+'</div>':
   '<div style="font-size:14px;color:#ac5a20;font-weight:700">No qualified paper — category will remain unfilled</div>';
  return '<tr><td style="padding:18px 22px;border-top:1px solid #e8e0d4"><div style="font:700 11px Arial,sans-serif;letter-spacing:1.4px;color:#a56b2c;text-transform:uppercase;padding-bottom:9px">'+escapeHtml(label)+'</div>'+data+'</td></tr>';
 }).join('');
 const title='WRRP Friday Preview — '+formatDate(begin)+' · '+missing+' unfilled';
 const html='<!doctype html><html><body style="margin:0;padding:25px;background:#eeece6;font-family:Arial,sans-serif"><table role="presentation" cellspacing="0" cellpadding="0" style="max-width:660px;margin:auto;background:white;border-collapse:collapse;width:100%">'+
 '<tr><td style="background:#202927;color:white;padding:27px 30px"><div style="font-weight:800;font-size:27px">oil &amp; gas<span style="color:#fa7629">.</span></div><div style="font-size:10px;letter-spacing:2px;padding-top:6px">KNOWLEDGE • EXPERTISE • EXCHANGE</div></td></tr>'+
 '<tr><td style="background:#c19a52;color:#262820;font-size:11px;letter-spacing:2px;font-weight:700;padding:12px 30px">PRIVATE EDITORIAL NOTICE • FRIDAY PREVIEW</td></tr>'+
 '<tr><td style="padding:26px 30px 17px"><h1 style="font:normal 28px Georgia,serif;margin:0;color:#202927">Next week’s proposed research recognitions</h1>'+
 '<p style="color:#5c625e;line-height:1.6;font-size:14px">Scheduled publication: <strong>'+escapeHtml(formatDate(begin))+' at 9:00 AM MYT</strong>. This preview is prepared three days before publication. No author emails have been sent.</p>'+
 (missing?'<p style="padding:11px 14px;background:#fff2df;border-left:4px solid #dd8227;color:#74450c;font-size:14px"><strong>Attention:</strong> '+missing+' recognition '+(missing===1?'category has':'categories have')+' no qualified candidate. Those categories will remain unfilled.</p>':'<p style="padding:11px 14px;background:#f5f6f1;border-left:4px solid #8b9b82;color:#425242;font-size:14px">All three categories have proposed qualifying candidates.</p>')+
 '</td></tr>'+rows+
 '<tr><td style="padding:22px 30px;background:#f9f6f0;font-size:13px;color:#525d56;line-height:1.6">Review or intervene through the <a style="color:#b45d2b" href="https://mterm2026-559f9bf571b5.herokuapp.com/api/oilandgas/editor/recognition.html">Recognition Admin Dashboard</a>. Proposed winners remain subject to eligibility and integrity checks at publication. <strong>This is a system-generated administrative preview, not an award notification.</strong></td></tr>'+
 '<tr><td style="background:#202927;color:#eee;padding:16px 30px;font-size:11px">Oil &amp; Gas Editorial Operations · oilandgas.eu.com</td></tr></table></body></html>';
 const text='Oil & Gas — private Friday recognition preview\nPublication: '+formatDate(begin)+' 9 AM MYT\n'+
 Object.entries(labels).map(([key,label])=>{const x=byCategory.get(key)?.candidate;return label+': '+(x?x.title+' | '+(x.assessment?.total??'Pending')+'/100 | '+(x.reference||''):'NO QUALIFIED PAPER — UNFILLED')}).join('\n')+
 '\n'+missing+' category/categories unfilled.\nAdmin: https://mterm2026-559f9bf571b5.herokuapp.com/api/oilandgas/editor/recognition.html\nNo author emails sent.';
 return {subject:title,html,text,missing,start:begin,end};
}
module.exports={labels,previewAt,plannedStart,mailContents,escapeHtml};
