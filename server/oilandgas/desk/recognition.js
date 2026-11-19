
'use strict';
const apiBase='recognition/';
const $=id=>document.getElementById(id);
async function api(path,body){
 const response=await fetch(apiBase+path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(data.error||(response.status===401?'Sign in via Editor’s Desk first.':'Request failed.'));
 return data;
}
function message(s){$('notice').textContent=s}
function node(t,txt,cls){const e=document.createElement(t);e.textContent=txt||'';if(cls)e.className=cls;return e}
async function refreshMasterSwitch(){
 const result=await api('activation-control');
 const toggle=$('master-recognition-toggle'),gates=$('master-gates');
 toggle.checked=!!result.enabled;
 toggle.disabled=!result.readyToEnable&&!result.enabled;
 gates.replaceChildren();
 for(const item of result.requirements){
  gates.append(node('p',(item.ok?'✓ ':'○ ')+item.label+(item.ok?' — satisfied':' — pending'),'muted'));
 }
 $('master-state').textContent=result.enabled?
  'MASTER SWITCH ON. Author congratulations remain OFF.':
  result.readyToEnable?'Master OFF. The programme can be enabled after your explicit confirmation. Author congratulations remain OFF.':
  'Master OFF and locked. Required deployment testing or release flags are not yet completed.';
}
$('master-recognition-toggle').onchange=async enabled=>{
 const toggle=$('master-recognition-toggle');
 if(!confirm(enabled?
  'Enable automatic weekly research recognition? This publishes qualifying winners on schedule but DOES NOT send author congratulations.':
  'Disable future automatic research recognition cycles? Existing historic records remain.')){
  toggle.checked=!enabled;return;
 }
 toggle.disabled=true;
 try{
  await api('activation-control',{enabled,
   confirm:enabled?'ENABLE_WRRP_NO_AUTHOR_EMAILS':'DISABLE_WRRP'});
  await refreshMasterSwitch();
 }catch(e){$('master-state').textContent='Activation change was not applied: '+e.message;
  await refreshMasterSwitch()}
};
async function refresh(){
 try{const [status,overrides,notice]=await Promise.all([api('status'),api('overrides'),api('notifications')]);
 $('pause-recognition').disabled=!!status.paused;
 $('resume-recognition').disabled=!status.paused;
 $('activate').disabled=!status.activationEnabled||!!status.paused;
 $('activate').textContent=status.activationEnabled?'Activate verified rules recognition — no author emails':'Activation locked pending tests';
 $('status').replaceChildren(node('p','Recognition scheduler: '+(status.schedulerEnabled?'ENABLED':'OFF')+' · Activation: '+(status.activationEnabled?'ENABLED':'LOCKED')+' · Emails: OFF'),
 node('p','Active recognitions: '+status.active.length+' · Administrator pause: '+(status.paused?'ON':'OFF')));
 $('overrides').replaceChildren(node('h3','Staged overrides'));
 for(const o of overrides.items){$('overrides').append(node('p',o.category+' — '+o.reference+' ('+o.reason+')'))}
 $('notifications').textContent=notice.message+' Queued: '+notice.queued+' · Sent: '+notice.sent;
 message('Editor controls available. Author recognition emails are disabled.');await refreshMasterSwitch();await certificates();await loadLetterTracking();await fridayBriefing();
 }catch(e){message(e.message)}
}
async function preview(){
 try{message('Checking published candidates…');const data=await api('preview');$('candidates').replaceChildren();
 for(const item of data.items){const card=node('article','','card');
 card.append(node('small',item.label),node('h3',item.candidate?.title||'No eligible candidate'),
 node('p',item.candidate?.byline||'', 'muted'),
 node('p',item.candidate?'Provisional score: '+item.candidate.assessment.total+'/100 · minimum '+item.minimumScore+' · '+(item.passesThreshold?'threshold reached':'below threshold'):'Unfilled category','muted'));
 card.append(node('p','Eligibility is based on available metadata, not independent research integrity verification.','muted'));
 $('candidates').append(card)}
 message('Preview completed. Nothing was published or emailed.');
 }catch(e){message(e.message)}
}

async function certificates(){
 try{const [history,issued]=await Promise.all([api('history'),api('certificates')]);
 const select=$('certificate-selection');select.replaceChildren(new Option('Select an activated recognition',''));
 const withdrawal=$('withdraw-selection');withdrawal.replaceChildren(new Option('Select recognition',''));
 for(const item of history.items){if(!['active','archived'].includes(item.status))continue;select.add(new Option(item.label+' · '+item.title,item.id));withdrawal.add(new Option(item.label+' · '+item.title,item.id))}
 const target=$('certificate-list');target.replaceChildren();
 if(!issued.items.length)target.append(node('p','No certificates issued yet.','muted'));
 for(const c of issued.items){const p=node('p',c.authorName+' · '+c.title+' · ');
 const a=node('a','Open A4 letter ↗');a.href='https://oilandgas.eu.com/letter.html?id='+encodeURIComponent(c.id);a.target='_blank';a.rel='noopener noreferrer';p.append(a);target.append(p)}
 }catch(e){$('certificate-result').textContent='Certificate listing unavailable: '+e.message}
}
$('integrity-approval').onsubmit=async e=>{e.preventDefault();const state=$('integrity-approval-state');
 if(!$('integrity-confirm').checked)return;
 if(!confirm('Confirm independent research-integrity checks were performed. Approve this paper for the future shortlist? This sends no email and issues no certificate.'))return;
 try{const data=Object.fromEntries(new FormData(e.target).entries());data.confirmation='INTEGRITY_CHECKED';
 const result=await api('review-approve',data);state.textContent='Assessment approved for automatic shortlisting. No recognition activated or email sent.';
 await $('preview-reviewed').onclick();
 }catch(err){state.textContent=err.message}};
async function loadCandidateQueue(){
 const body=$('candidate-rows');body.replaceChildren();$('candidate-status').textContent='Loading published papers…';
 try{const result=await api('candidate-queue');const summary={};
  for(const p of result.items){summary[p.status]=(summary[p.status]||0)+1;
   const tr=document.createElement('tr');[p.title,p.reference,p.status.replaceAll('-',' ')].forEach(value=>{
    const td=document.createElement('td');td.style.padding='8px';td.style.borderBottom='1px solid #eee';td.textContent=value;tr.append(td)});
   body.append(tr);}
  $('candidate-status').textContent=result.total+' published candidates · '+Object.entries(summary).map(([k,v])=>k+': '+v).join(' · ');
 }catch(err){$('candidate-status').textContent='Candidate queue unavailable: '+err.message}
}
async function loadRuleScores(){
 const body=$('rules-rows');body.replaceChildren();$('rules-status').textContent='Assessing available publication titles and summaries…';
 try{
  const data=await api('rules-scorecard'),totals={ready:0,pending:0};
  for(const p of data.items){
   const assessment=p.assessment,ready=assessment.eligibleForEditorialReview&&!p.previouslyRecognized;
   if(ready)totals.ready++;else totals.pending++;
   const tr=document.createElement('tr');
   const vals=[p.title,assessment.total+'/100',
    p.previouslyRecognized?'Previously recognized':assessment.eligibleForEditorialReview?'Directory fields complete':'Directory details incomplete'];
   for(const value of vals){const td=node('td',value);td.className='recognition-inline-7';tr.append(td)}
   const td=document.createElement('td'),details=document.createElement('details'),summary=node('summary','Explain scoring');
   details.append(summary);
   for(const [key,value]of Object.entries(assessment.breakdown)){
    const evidence=assessment.matches[key]||[];
    details.append(node('p',key+': '+value+' / '+assessment.weights[key]+' · '+(evidence.map(x=>x.signal+': '+x.term).join('; ')||'No explicit phrase'),'muted'));
   }
   if(assessment.evidence.issues.length)details.append(node('p','Pending: '+assessment.evidence.issues.join(', '),'muted'));
   td.append(details);tr.append(td);body.append(tr);
  }
  $('rules-status').textContent='Rubric '+data.rubricVersion+' · '+data.total+' published papers · '+totals.ready+' eligible for directory scoring · '+totals.pending+' pending/previously recognized. Read-only simulation; no authors emailed.';
 }catch(e){$('rules-status').textContent='Rule simulation unavailable: '+e.message}
}
$('rules-discover-batch').onclick=async()=>{
 const button=$('rules-discover-batch'),target=$('rules-discover-result');
 if(!confirm('Check the next five published DOI papers for verified original abstracts? This will not select winners or send emails.'))return;
 button.disabled=true;target.textContent='Checking DOI metadata…';
 try{const result=await api('rules/discover-batch',{confirm:'DISCOVER_NO_AWARDS',limit:5});
  target.textContent='Checked '+result.attempted+' publications; '+result.verified+
   ' complete abstracts verified. Unavailable sources remain pending; no awards or emails issued.';
  await loadRuleScores();await loadCandidateQueue();
 }catch(e){target.textContent='Source discovery error: '+e.message}
 finally{button.disabled=false}
};
async function reviewRelatedPapers(){
 const target=$('related-review-rows');target.replaceChildren();
 $('related-review-status').textContent='Comparing publication titles and published author lists…';
 try{
  const result=await api('related-review');
  $('related-review-status').textContent=result.pairs.length+
   ' potentially related pairs within '+result.totalReviewed+
   ' published records. These are editorial flags, NOT findings of duplication.';
  for(const pair of result.pairs){
   const card=node('article','','card');
   card.append(node('h3','Potentially related research — editorial source comparison required'),
    node('p',pair.titleA+' ('+pair.referenceA+', '+pair.scoreA+'/100)'),
    node('p',pair.titleB+' ('+pair.referenceB+', '+pair.scoreB+'/100)'),
    node('p','Title overlap '+Math.round(pair.titleOverlap*100)+'% · author overlap '+
     Math.round(pair.authorOverlap*100)+'%. Different sources may be legitimate separate research.','muted'));
   target.append(card);
  }
  if(!result.pairs.length)target.append(node('p','No high-similarity pairs found among papers meeting the shortlist scoring minima.','muted'));
 }catch(e){$('related-review-status').textContent='Related-paper check unavailable: '+e.message}
}
$('related-review-refresh').onclick=reviewRelatedPapers;
$('rules-refresh').onclick=loadRuleScores;
$('rules-import-form').onsubmit=async event=>{
 event.preventDefault();const target=$('rules-import-result');target.textContent='Checking original DOI metadata and abstract…';
 try{
  const data=Object.fromEntries(new FormData(event.target).entries());
  const result=await api('rules/import-abstract',data);
  target.textContent='Original abstract verified and recorded ('+result.words+' words). No recognition was issued.';
  await loadRuleScores();await loadCandidateQueue();
 }catch(e){target.textContent=e.message}
};
$('rules-verify-form').onsubmit=async event=>{
 event.preventDefault();const target=$('rules-verify-result');
 if(!$('rules-verify-confirm').checked)return;
 if(!confirm('Confirm this is the complete original abstract, copied accurately from the linked publication source?'))return;
 const data=Object.fromEntries(new FormData(event.target).entries());
 data.confirm='ORIGINAL_ABSTRACT_VERIFIED';
 target.textContent='Validating supplied original abstract…';
 try{
  const result=await api('rules/verify-abstract',data);
  target.textContent='Optional original abstract saved. Directory-only recognition score: '+result.score+'/100; no award or email issued.';
  await loadRuleScores();await loadCandidateQueue();
 }catch(e){target.textContent=e.message}
};
$('rules-approve-form').onsubmit=async event=>{
 event.preventDefault();const target=$('rules-approve-result');
 if(!$('rules-check-confirm').checked)return;
 if(!confirm('Confirm that you independently checked the original publication and available integrity notices? This does not issue an award or email anyone.'))return;
 try{
  const data=Object.fromEntries(new FormData(event.target).entries());
  data.confirm='SOURCE_INTEGRITY_CHECKED';
  const result=await api('rules/approve',data);
  target.textContent='Evidence cleared for future rules shortlist. Score: '+result.score+'/100. No award or email issued.';
  await loadCandidateQueue();
 }catch(e){target.textContent=e.message}
};

$('candidate-refresh').onclick=loadCandidateQueue;
$('evidence-form').onsubmit=async e=>{e.preventDefault();const target=$('evidence-form-state');
 if(!$('evidence-confirm').checked)return;
 const data=Object.fromEntries(new FormData(e.target).entries());data.sourceReviewed=true;
 try{await api('evidence',data);
  target.textContent='Source-backed evidence recorded. The paper may now undergo AI assessment; no award or email was issued.';
  await loadCandidateQueue();
 }catch(err){target.textContent=err.message}
};
$('paper-review').onsubmit=async e=>{e.preventDefault();const button=e.target.querySelector('button');
 button.disabled=true;$('paper-review-state').textContent='Checking publication evidence…';
 $('paper-review-result').hidden=true;
 try{const data=Object.fromEntries(new FormData(e.target).entries());
 const result=await api('review-paper',data);
 $('paper-review-state').textContent='Review status: '+result.state+'. No recognition or email has been issued.';
 const body=result.assessment?{score:result.assessment.total,confidence:result.assessment.confidence,
   reasoning:result.assessment.reasoning,limitations:result.assessment.limitations,
   evidence:result.assessment.evidence,decision:result.assessment.decision}:
   {reason:result.reason,evidence:result.evidence,metadata:result.metadata&&{doi:result.metadata.doi,title:result.metadata.title}};
 $('paper-review-result').textContent=JSON.stringify(body,null,2);
 $('paper-review-result').hidden=false;
 }catch(err){$('paper-review-state').textContent=err.message}
 finally{button.disabled=false}};
$('withdraw').onsubmit=async e=>{e.preventDefault();try{
 const data=Object.fromEntries(new FormData(e.target).entries());
 if(!confirm('Withdraw this editorial recognition and invalidate every associated certificate?'))return;
 const result=await api('withdraw',data);
 $('withdraw-message').textContent=result.alreadyWithdrawn?'This recognition was already withdrawn.':'Recognition withdrawn and certificates invalidated.';
 await refresh();
 }catch(err){$('withdraw-message').textContent=err.message}};
$('certificate-issue').onsubmit=async e=>{e.preventDefault();try{
 const data=Object.fromEntries(new FormData(e.target).entries());
 if(!confirm('Confirm that this name appears as an author on the selected published research paper?'))return;
 const result=await api('certificate/issue',data);
 $('certificate-result').textContent=result.alreadyIssued?'Letter already exists: '+result.id:'Letter issued: '+result.id+' (no email sent).';
 await certificates();
 }catch(err){$('certificate-result').textContent=err.message}};


$('preview-reviewed').onclick=async()=>{
 const target=$('reviewed-candidates');target.replaceChildren();
 $('reviewed-note').textContent='Checking reviewed candidates…';
 try{
  const result=await api('preview-reviewed');
  for(const item of result.items){
   const article=node('article','','card');
   article.append(node('small',item.category),node('h3',item.candidate?.title||'No cleared candidate'),
    node('p',item.candidate?('Reviewed score '+item.candidate.assessment.total+' / 100'):'Awaiting original abstract and source/integrity verification','muted'));
   target.append(article);
  }
  $('reviewed-note').textContent=result.items.filter(x=>x.candidate).length+
    ' of 3 categories have source-cleared candidates. Production activation remains locked during testing.';
 }catch(err){$('reviewed-note').textContent='Reviewed shortlist unavailable: '+err.message}
};

function formatTrackingDate(value){return value?new Date(value).toLocaleString('en-MY',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kuala_Lumpur'}):'—'}
async function loadLetterTracking(){
 const body=$('tracking-rows');body.replaceChildren();
 try{
  const result=await api('letter-tracking');
  let requested=0,loaded=0;
  for(const item of result.items){
   requested+=item.linkRequests||0;loaded+=item.letterLoads||0;
   const row=document.createElement('tr');
   const vals=[(item.authorName||'Author')+' · '+item.letterId,
    item.emailStatus||'disabled',
    String(item.linkRequests||0),
    String(item.letterLoads||0),
    formatTrackingDate(item.lastLetterLoadAt||item.lastLinkRequestAt)];
   vals.forEach(v=>{const td=document.createElement('td');td.style.padding='10px';td.style.borderBottom='1px solid #eee';td.textContent=v;row.append(td)});
   body.append(row);
  }
  $('tracking-requests').textContent=requested;
  $('tracking-views').textContent=loaded;
  $('tracking-message').textContent=result.items.length?
   'Tracked records: '+result.items.length+'. Link requests may include automated security scans; page loads are not proof of human reading.':
   'No tracked letters yet. Recognition emails remain disabled.';
 }catch(err){$('tracking-message').textContent=err.message}
}
$('tracking-refresh').onclick=loadLetterTracking;
$('tracking-create').onsubmit=async e=>{e.preventDefault();
 const result=$('tracking-link-result');
 try{
  const data=Object.fromEntries(new FormData(e.target).entries());
  const created=await api('letter-link/create',data);
  result.replaceChildren(document.createTextNode('Private preview link created (not emailed): '));
  const link=document.createElement('a');link.href=created.url;link.textContent='Open tracked A4 letter';
  link.target='_blank';link.rel='noopener noreferrer';result.append(link);
  await loadLetterTracking();
 }catch(err){result.textContent=err.message}
};

async function fridayBriefing(){
 $('friday-msg').textContent='Checking scheduled administrator briefing…';
 try{
  const data=await api('friday-preview');
  const local=v=>new Date(v).toLocaleString('en-MY',{dateStyle:'full',timeStyle:'short',timeZone:'Asia/Kuala_Lumpur'});
  $('friday-next').textContent=local(data.nextPublication);
  $('friday-time').textContent=local(data.previewScheduledAt);
  $('friday-mail-status').textContent=(data.adminAlertEnabled&&data.adminRecipientConfigured?'Configured':'Not activated')+
   ' · '+data.emailStatus;
  const cards=$('friday-cards');cards.replaceChildren();
  for(const cat of [{key:'editors-pick',name:"Editor's Pick"},{key:'industry-impact',name:'Industry Impact'},{key:'emerging-research',name:'Emerging Research'}]){
   const slot=data.items.find(x=>x.category===cat.key),p=slot?.candidate;
   const c=node('div','','card');c.append(node('small',cat.name),node('h3',p?.title||'Awaiting Friday selection'),
    node('p',p?p.byline+' · '+(p.score?.total??'—')+'/100':'Not yet prepared; a vacant category will remain unfilled.','muted'));
   cards.append(c);
  }
  $('friday-msg').textContent=data.status==='not-prepared'?'No Friday selection has been prepared for this upcoming week.':'Briefing state: '+data.status+' · Vacant categories: '+data.missing.length+'.';
 }catch(e){$('friday-msg').textContent=e.message}
}
$('pause-recognition').onclick=async()=>{
 const reason=prompt('Reason for pausing automatic recognition?');
 if(!reason)return;
 if(!confirm('Pause all scheduled recognition selections and admin preview emails?'))return;
 try{await api('pause',{reason,confirm:'PAUSE_RECOGNITION'});
 $('pause-result').textContent='Programme paused. No new automatic recognition or Friday briefing will be issued until resumed.';
 await refresh();
 }catch(e){$('pause-result').textContent=e.message}
};
$('resume-recognition').onclick=async()=>{
 if(!confirm('Resume the recognition scheduler once its launch flags are enabled? Author emails remain OFF.'))return;
 try{await api('resume',{confirm:'RESUME_RECOGNITION'});
 $('pause-result').textContent='Pause lifted. Production scheduling is still controlled by its separate deployment flags.';
 await refresh();
 }catch(e){$('pause-result').textContent=e.message}
};
async function checkResendOwnerTestReadiness(){
 const status=$('resend-owner-test-readiness'),button=$('resend-owner-test-send');
 button.disabled=true;
 try{
  const data=await api('resend-owner-test/readiness');
  status.textContent=data.configured?
   'Dedicated recognition Resend key detected. Only the owner-only test is available; no researcher emails are enabled.':
   'Dedicated Resend recognition key not detected in the deployed backend. Confirm Heroku Config Vars and deployment.';
  button.disabled=!data.configured;
 }catch(error){status.textContent='Resend readiness unavailable: '+error.message}
}
$('resend-owner-test-send').onclick=async()=>{
 if(!confirm('Send ONE Resend recognition test email from recognition@oilandgas.eu.com to m.zurix@oilandgas.eu.com? No researcher notifications or awards will be issued.'))return;
 const button=$('resend-owner-test-send'),result=$('resend-owner-test-result');
 button.disabled=true;result.textContent='Requesting one owner-only Resend test email…';
 try{
  const sent=await api('resend-owner-test/send',{confirm:'SEND_RESEND_OWNER_TEST_ONLY'});
  result.textContent=sent.state==='accepted-by-resend'?
   'Resend accepted the owner-only test. Message ID: '+sent.providerMessageId+'. Confirm delivered status in Resend and check your inbox or spam folder.':
   'Resend test response: '+String(sent.state||'unknown');
 }catch(error){result.textContent='Owner-only Resend test was not confirmed: '+error.message}
 finally{await checkResendOwnerTestReadiness()}
};
checkResendOwnerTestReadiness();
$('smtp-test').onclick=async()=>{
 if(!confirm('Send ONE Hostinger SMTP test email to m.zurix@oilandgas.eu.com? No author notification or awards will be issued.'))return;
 const button=$('smtp-test');button.disabled=true;
 $('smtp-test-result').textContent='Testing Hostinger SMTP connection and administrator delivery…';
 try{
  const result=await api('admin-email/test',{confirm:'SEND_ADMIN_SMTP_TEST'});
  $('smtp-test-result').textContent=result.status==='smtp-accepted'?
   'Hostinger SMTP accepted the test email. Please check the inbox and spam folder. This does not yet prove inbox delivery.':
   'Result: '+result.status;
 }catch(err){$('smtp-test-result').textContent='Test failed: '+err.message}
 finally{button.disabled=false}
};
async function loadIntegrityMonitor(){
 const target=$('integrity-monitor-items');target.replaceChildren();
 $('integrity-monitor-status').textContent='Reading integrity check records…';
 try{
  const result=await api('integrity-monitor');
  $('integrity-monitor-status').textContent=result.checks.length+' recorded checks · '+
   result.alerts.length+' integrity alerts. Monitoring requires explicit production activation.';
  for(const item of result.alerts){
   const p=node('p',(item.title||item.selectionId)+' — '+item.status,'muted');
   target.append(p);
  }
  for(const item of result.checks.slice(0,10)){
   const p=node('p',item.selectionId+' — '+item.result+' · '+
    new Date(item.checkedAt).toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur'}),'muted');
   target.append(p);
  }
  if(!result.checks.length&&!result.alerts.length)
   target.append(node('p','No scheduled source-integrity checks recorded yet.','muted'));
 }catch(e){$('integrity-monitor-status').textContent=e.message}
}
$('integrity-refresh').onclick=loadIntegrityMonitor;
$('friday-refresh').onclick=fridayBriefing;

$('refresh').onclick=refresh;$('preview').onclick=preview;
$('override').onsubmit=async e=>{e.preventDefault();try{
 const data=Object.fromEntries(new FormData(e.target).entries());await api('override',data);
 message('Override staged successfully.');await refresh();
}catch(err){message(err.message)}};
$('activate').onclick=async()=>{if(!confirm('Publish three recognition records for this week? No emails or certificates will be issued.'))return;
 try{const data=await api('activate',{confirm:'ACTIVATE_NO_EMAIL'});message('Weekly activation result: '+JSON.stringify(data));await refresh()}
 catch(e){message(e.message)}};
refresh();
