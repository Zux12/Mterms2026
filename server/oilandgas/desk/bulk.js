'use strict';
// Uses the existing authenticated, version-checked approve/preview/publish routes.
// Selection is deliberately limited to the currently displayed queue page.
(() => {
  const el=id=>document.getElementById(id);
  const selected=new Map();
  let prepared=[],busy=false,restoreSelection=null;
  const key=item=>item.kind+'/'+item.reference;
  const itemURL=item=>'item/'+key(item);
  const actionable=()=>['pending_review','approved'].includes(el('status').value);
  function invalidate(){prepared=[];el('bulk-proof').hidden=true;el('bulk-cards').replaceChildren();}
  function sync(){
    const boxes=[...el('queue').querySelectorAll('.bulk-checkbox')];
    el('bulk-controls').hidden=!actionable();
    el('bulk-count').textContent=selected.size+' selected';
    el('bulk-all').checked=boxes.length>0&&boxes.every(b=>b.checked);
    el('bulk-all').indeterminate=boxes.some(b=>b.checked)&&!el('bulk-all').checked;
    el('bulk-all').disabled=!boxes.length;
    el('bulk-approve').hidden=el('status').value!=='pending_review';
    el('bulk-preview').hidden=el('status').value!=='approved';
    for(const id of ['bulk-approve','bulk-preview','bulk-clear'])el(id).disabled=!selected.size||busy;
    el('bulk-publish').disabled=!prepared.length||busy;
  }
  function decorate(){
    invalidate();selected.clear();
    for(const li of el('queue').children){
      if(li.tagName!=='LI')continue;
      li.querySelector('.bulk-checkbox')?.remove();
      li.classList.remove('bulk-row');
      if(!actionable())continue;
      const button=li.querySelector('button');
      const match=button?.textContent.match(/^(OG-([AP])-[A-F0-9]{16})/);
      if(!match)continue;
      const item={reference:match[1],kind:match[2]==='A'?'articles':'publications'};
      const box=document.createElement('input');box.type='checkbox';box.className='bulk-checkbox';
      box.setAttribute('aria-label','Select '+button.textContent);
      box.dataset.key=key(item);box.checked=Boolean(restoreSelection?.has(key(item)));
      if(box.checked)selected.set(key(item),item);
      box.onchange=()=>{invalidate();if(box.checked)selected.set(key(item),item);else selected.delete(key(item));sync();};
      li.classList.add('bulk-row');li.prepend(box);
    }
    restoreSelection=null;sync();
  }
  // Observe only replacement of queue rows, not the checkboxes inserted inside them.
  new MutationObserver(decorate).observe(el('queue'),{childList:true});
  async function locked(work){
    if(busy)return;
    if(!mayLeave())return;
    closeEntry();busy=true;el('office').inert=true;el('office').setAttribute('aria-busy','true');sync();
    try{await work();}catch(err){el('bulk-message').textContent=err.message;}
    finally{busy=false;el('office').inert=false;el('office').removeAttribute('aria-busy');sync();}
  }
  function report(errors){
    el('bulk-errors').replaceChildren(...errors.map(({item,message})=>{
      const li=document.createElement('li');li.textContent=item.reference+' — '+message;return li;
    }));
  }
  async function refreshAfter(failed){
    restoreSelection=new Set(failed.map(key));
    try{await queue();}
    catch(err){restoreSelection=null;throw Error('Batch finished, but the queue could not refresh. Reload the page to check its current status. '+err.message);}
  }
  async function each(items,work){
    const errors=[],failed=[];let succeeded=0;
    for(let i=0;i<items.length;i++){
      const item=items[i];el('bulk-message').textContent='Processing '+(i+1)+' of '+items.length+'…';
      try{await work(item);succeeded++;}
      catch(err){
        failed.push(item);errors.push({item,message:err.message});
        // Stop on session expiry. Do not keep submitting authenticated actions.
        if(el('office').hidden){
          for(const remaining of items.slice(i+1)){failed.push(remaining);errors.push({item:remaining,message:'Not processed. Sign in again.'});}
          break;
        }
      }
    }
    return {succeeded,failed,errors};
  }
  el('bulk-all').onchange=()=>{
    invalidate();const checked=el('bulk-all').checked;
    for(const box of el('queue').querySelectorAll('.bulk-checkbox')){box.checked=checked;const [kind,reference]=box.dataset.key.split('/');if(checked)selected.set(box.dataset.key,{kind,reference});else selected.delete(box.dataset.key);}
    sync();
  };
  el('bulk-clear').onclick=()=>{invalidate();selected.clear();el('queue').querySelectorAll('.bulk-checkbox').forEach(b=>b.checked=false);sync();};
  el('bulk-cancel').onclick=()=>{invalidate();sync();};
  el('bulk-approve').onclick=()=>locked(async()=>{
    const items=[...selected.values()];if(!items.length)return;
    invalidate();report([]);
    const result=await each(items,async item=>{
      const record=await api(itemURL(item));
      if(record.status!=='pending_review')throw Error('Status changed. Refresh and review this entry.');
      const draft={};for(const field of ['title','summary','topic','byline'])draft[field]=record.draft[field];
      await api(itemURL(item)+'/approve',{version:record.version,draft});
    });
    await refreshAfter(result.failed);report(result.errors);
    el('bulk-message').textContent=result.succeeded+' approved privately. '+result.failed.length+' failed or not processed. Open Approved · private to preview and publish.';
  });
  el('bulk-preview').onclick=()=>locked(async()=>{
    const items=[...selected.values()];if(!items.length)return;
    invalidate();report([]);const previews=[];
    const result=await each(items,async item=>{
      const record=await api(itemURL(item));
      if(record.status!=='approved')throw Error('This entry is no longer approved privately.');
      const proof=await api(itemURL(item)+'/preview',{version:record.version});
      if(!proof.token||!proof.entry)throw Error('No valid preview returned.');
      if(item.kind==='articles'&&!proof.entry.body?.trim())throw Error('Article text is missing. Check its manuscript before publishing.');
      const section=document.createElement('section'),heading=document.createElement('h3'),article=document.createElement('article');
      heading.textContent=item.reference;renderEntry(article,proof.entry);section.append(heading,article);
      el('bulk-cards').append(section);previews.push({...item,version:record.version,token:proof.token});
    });
    prepared=previews;report(result.errors);el('bulk-proof').hidden=!prepared.length;
    el('bulk-publish').textContent='Publish '+prepared.length+' previewed entries to website';
    el('bulk-message').textContent=prepared.length+' previews ready. '+result.failed.length+' could not be prepared. Only the displayed previews will be published.';
    if(prepared.length)el('bulk-proof').scrollIntoView({block:'start'});
  });
  el('bulk-publish').onclick=()=>{
    if(busy||!prepared.length)return;
    const items=prepared.slice();
    if(!confirm('Publish these '+items.length+' previewed entries publicly on the website?'))return;
    return locked(async()=>{
      invalidate();report([]);
      const result=await each(items,item=>api(itemURL(item)+'/publish',{version:item.version,token:item.token}));
      await refreshAfter(result.failed);report(result.errors);
      el('bulk-message').textContent=result.succeeded+' published. '+result.failed.length+' failed or not processed. Failed entries still on this page remain selected; preview them again before retrying.';
    });
  };
  // Single-entry edits or navigation invalidate the bulk previews.
  el('queue').addEventListener('click',event=>{if(event.target.closest('button')){invalidate();sync();}});
  el('draft').addEventListener('input',()=>{invalidate();sync();});
  el('status').addEventListener('change',()=>{invalidate();sync();});
  window.addEventListener('beforeunload',event=>{if(busy){event.preventDefault();event.returnValue='';}});
  decorate();
})();
