'use strict';
(() => {
  const byId=id=>document.getElementById(id);
  const body=byId('history-rows'),summary=byId('history-summary');
  if(!body || !summary) return;
  let page=0,more=false,requestNumber=0;
  let searchTimer;
  const dateLabel=value=>{
    if(!value)return '—';
    const date=new Date(value);
    return Number.isFinite(date.getTime()) ? date.toLocaleString() : '—';
  };
  const cell=(tr,text)=>{
    const td=document.createElement('td');
    td.textContent=text;
    tr.append(td);
    return td;
  };
  function record(tr,row,type,detail){
    const name=cell(tr,'');
    const strong=document.createElement('strong');
    strong.textContent=row.name || 'Unnamed applicant';
    const sub=document.createElement('small');
    sub.textContent=(row.email||'')+(row.organisation?' · '+row.organisation:'');
    name.append(strong,sub);
    cell(tr,type==='welcome'?'Membership approved':'Application received');
    const state=detail?.state||'not recorded';
    const status=cell(tr,state);
    status.className='mail-state '+('mail-state-'+String(state).replace(/[^a-z]/g,''));
    const accepted=cell(tr,dateLabel(detail?.acceptedAt));
    const extra=cell(tr,'');
    const attempts=document.createElement('span');
    attempts.textContent='Attempts: '+(detail?.attempts||0);
    extra.append(attempts);
    if(detail?.messageId){
      const msg=document.createElement('small');msg.textContent='SMTP message ID: '+detail.messageId;extra.append(msg);
    }
    if(detail?.lastError){
      const err=document.createElement('small');err.className='mail-error';
      err.textContent='Last error: '+detail.lastError;extra.append(err);
    }
    if(['queued','retry'].includes(state)&&detail?.nextAttemptAt){
      const next=document.createElement('small');
      next.textContent='Next attempt: '+dateLabel(detail.nextAttemptAt);
      extra.append(next);
    }
    accepted.title='SMTP acceptance only; not proof of inbox delivery.';
  }
  async function load(){
    const serial=++requestNumber;
    summary.textContent='Loading membership email records…';
    try{
      const params=new URLSearchParams({page:String(page),kind:byId('history-kind').value,q:byId('history-search').value.trim()});
      const response=await fetch('members/history?'+params,{cache:'no-store'});
      let data={};
      try{data=await response.json();}catch(_){}
      if(serial!==requestNumber)return;
      if(!response.ok)throw Error(data.error||'Membership email history could not be loaded.');
      body.replaceChildren();
      let displayed=0;
      for(const item of data.items||[]){
        for(const type of ['welcome','receipt']){
          if(byId('history-kind').value!=='all'&&byId('history-kind').value!==type)continue;
          const info=type==='welcome'?item.welcomeMail:item.receiptMail;
          if(!info?.state)continue;
          const tr=document.createElement('tr');
          record(tr,item,type,info);
          body.append(tr);displayed++;
        }
      }
      if(!displayed){
        const tr=document.createElement('tr');const td=document.createElement('td');
        td.colSpan=5;td.textContent='No recorded emails match these filters.';
        tr.append(td);body.append(tr);
      }
      more=Boolean(data.more);
      const total=Number(data.total)||0;
      summary.textContent=total+' member'+(total===1?'':'s')+' with recorded email events · '+displayed+' email record'+(displayed===1?'':'s')+' on this page';
      byId('history-page').textContent=total?'Page '+(page+1)+' of '+Math.ceil(total/(Number(data.limit)||20)):'No results';
      byId('history-prev').disabled=page===0;
      byId('history-next').disabled=!more;
    }catch(error){
      if(serial===requestNumber){body.replaceChildren();summary.textContent=error.message;byId('history-next').disabled=true;}
    }
  }
  byId('history-prev').onclick=()=>{if(page>0){page--;load();}};
  byId('history-next').onclick=()=>{if(more){page++;load();}};
  byId('history-refresh').onclick=load;
  const updateFilters=()=>{page=0;load();};
  byId('history-kind').onchange=updateFilters;
  byId('history-search').oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(updateFilters,300);};
  document.addEventListener('oilgas-membership-approved',()=>{page=0;load();});
  const office=byId('office');
  new MutationObserver(()=>{if(!office.hidden)load();})
    .observe(office,{attributes:true,attributeFilter:['hidden']});
  if(!office.hidden)load();
})();
