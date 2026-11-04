'use strict';
const byId=id=>document.getElementById(id);
const login=byId('login'),office=byId('office'),form=byId('draft'),detail=byId('detail');
let current,proofToken,page=0,dirty=false;
async function api(path,body){
  const response=await fetch(path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(response.status===401){login.hidden=false;office.hidden=true;closeEntry();byId('queue').replaceChildren();}
  const result=await response.json();
  if(!response.ok)throw Error(result.error||'Request failed.');
  return result;
}
function run(fn){return async e=>{e?.preventDefault();try{byId('message').textContent='';await fn(e);}catch(err){byId('message').textContent=err.message;}};}
function closeEntry(){document.getElementById('collection-control')?.remove();document.getElementById('highlight-controls')?.remove();current=null;proofToken=null;dirty=false;detail.hidden=true;byId('proof').hidden=true;form.reset();byId('original').replaceChildren();byId('card').replaceChildren();}
function mayLeave(){return !dirty||confirm('Discard the unsaved draft edits?');}
function itemPath(){return 'item/'+current.kind+'/'+current.reference;}
async function queue(){
  closeEntry();
  const {items,more}=await api('queue?status='+byId('status').value+'&page='+page);
  login.hidden=true;office.hidden=false;
  const list=byId('queue');list.replaceChildren();
  if(!items.length)list.textContent='No submissions in this queue.';
  for(const item of items){
    const li=document.createElement('li'),btn=document.createElement('button');
    btn.textContent=item.reference+' · '+item.title;btn.onclick=run(async()=>{if(mayLeave())await open(item);});li.append(btn);list.append(li);
  }
  byId('prev').disabled=page===0;byId('next').disabled=!more;
}
async function open(item){
  closeEntry();
  const record=await api('item/'+item.kind+'/'+item.reference);
  current={...record,kind:item.kind};detail.hidden=false;byId('ref').textContent=record.reference;
  const orig=byId('original');orig.replaceChildren();
  for(const [k,v] of Object.entries({...record.original,contacts:record.contacts.map(a=>a.name+' <'+a.email+'>').join('\n'),source:record.source,reason:record.reason,notification:record.mailState})){
    if(v){const p=document.createElement('p');p.textContent=k+' · '+v;orig.append(p);}
  }
  if(record.source){const a=document.createElement('a');a.href=record.source;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Open original paper';orig.append(a);}
  const link=byId('download');link.hidden=!record.manuscript;link.href=itemPath()+'/manuscript';
  const pending=record.status==='pending_review',approved=record.status==='approved';
  for(const [k,v] of Object.entries(record.draft)){form.elements[k].value=v;form.elements[k].readOnly=!pending&&!approved;}
  byId('save').hidden=!pending&&!approved;byId('approve').hidden=!pending;byId('preview').hidden=!approved;byId('decliner').hidden=!pending;
  if (pending || approved || record.status === 'published') {
    const section=document.createElement('section');
    section.id='collection-control';
    const label=document.createElement('label');
    const checkbox=document.createElement('input');
    checkbox.type='checkbox';
    checkbox.checked=record.crossIndustry === true;
    label.append(checkbox,' Technology Across Industries');
    const save=document.createElement('button');
    save.type='button';
    save.textContent='Save collection';
    save.onclick=run(async()=>{
      if (dirty) throw Error('Save the draft edits first.');
      save.disabled=true;
      try {
        await api(itemPath()+'/collection',{version:record.version,checked:checkbox.checked});
        await open(item);
        byId('message').textContent='Collection saved.';
      } finally { save.disabled=false; }
    });
    section.append(label,save);
    detail.append(section);
  }
  const archiveButton=byId('archive-toggle');
  const archived=record.status==='archived';
  archiveButton.hidden=!(archived || record.status==='published');
  archiveButton.textContent=archived?'Restore to Approved · private':'Remove from website';
  archiveButton.onclick=run(async()=>{
    if(!archived && !confirm('Remove this published item from the website and keep it in Archived?')) return;
    await api(itemPath()+(archived?'/restore':'/archive'),{version:record.version});
    await queue();
    byId('message').textContent=archived?'Restored to Approved · private.':'Removed from website. Saved in Archived.';
  });
  if(record.status==='published') {
    const controls=document.createElement('section');
    controls.id='highlight-controls';
    const heading=document.createElement('h3');heading.textContent='Feature on homepage';
    const label=document.createElement('label');label.textContent='Featured position ';
    const select=document.createElement('select');
    for(const [value,text] of [['lead','Lead story'],['story1','Story 01'],['story2','Story 02']]) {
      const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);
    }
    label.append(select);
    const imageLabel=document.createElement('label');imageLabel.textContent='Image URL (optional, HTTPS) ';
    const image=document.createElement('input');image.type='url';image.placeholder='https://…';imageLabel.append(image);
    const button=document.createElement('button');button.type='button';button.textContent='Set featured story';
    const message=document.createElement('p');message.setAttribute('role','status');
    button.onclick=run(async()=>{
      button.disabled=true;
      try {
        await api('highlight',{slot:select.value,kind:item.kind,reference:item.reference,image:image.value.trim()});
        message.textContent='Featured story saved. Refresh the homepage to see it.';
      } finally {button.disabled=false;}
    });
    controls.append(heading,label,imageLabel,button,message);detail.append(controls);
  }
  byId('reason').value='';detail.scrollIntoView({block:'start'});
}
login.onsubmit=run(async()=>{await api('login',{password:login.password.value});login.reset();await queue();});
byId('logout').onclick=run(async()=>{await api('logout',{});location.reload();});
let lastFilter='pending_review';
byId('status').onchange=run(async()=>{if(!mayLeave()){byId('status').value=lastFilter;return;}lastFilter=byId('status').value;page=0;await queue();});
for(const [id,delta] of [['next',1],['prev',-1]])byId(id).onclick=run(async()=>{if(mayLeave()){page+=delta;await queue();}});
form.oninput=()=>{dirty=true;proofToken=null;byId('proof').hidden=true;};
form.onsubmit=run(async e=>{
  const action=e.submitter?.id||'save',item=current,body={version:item.version,draft:Object.fromEntries(new FormData(form))};
  if(action==='preview'){
    if(dirty)throw Error('Save the draft before previewing.');
    const proof=await api(itemPath()+'/preview',body);
    proofToken=proof.token;renderEntry(byId('card'),proof.entry);byId('proof').hidden=false;byId('proof').scrollIntoView();return;
  }
  await api(itemPath()+'/'+action,body);
  if(action==='approve'){await queue();byId('message').textContent='Approved privately. Open the Approved queue to preview and publish.';}
  else{await open(item);byId('message').textContent='Draft saved.';}
});
byId('decline').onclick=run(async()=>{
  const reason=byId('reason').value.trim();if(!reason)throw Error('Enter a reason first.');
  if(!confirm('Decline this submission and email the reason to the submitter?'))return;
  await api(itemPath()+'/decline',{version:current.version,reason});await queue();byId('message').textContent='Declined. Decision email queued.';
});
byId('publish').onclick=run(async()=>{
  if(!confirm('Publish this preview for everyone to read?'))return;
  await api(itemPath()+'/publish',{version:current.version,token:proofToken});await queue();byId('message').textContent='Published. The entry is now available to readers.';
});
queue().catch(err=>{if(err.message!=='Please sign in.')byId('message').textContent=err.message;});
