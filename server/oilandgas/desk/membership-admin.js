'use strict';
(() => {
  const get=id=>document.getElementById(id);
  const wrapper=get('membership-pending'), status=get('membership-message');
  if(!wrapper || !status) return;
  let refreshing=false;
  async function api(path, data) {
    const options=data===undefined?{cache:'no-store'}:{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),cache:'no-store'
    };
    const response=await fetch('members'+path,options);
    let result={};
    try { result=await response.json(); } catch (_) {}
    if(!response.ok) throw Error(result.error||'Membership service unavailable.');
    return result;
  }
  const line=(label,value)=>{
    const p=document.createElement('p');
    const b=document.createElement('strong');b.textContent=label+': ';
    p.append(b,document.createTextNode(value||'Not recorded'));
    return p;
  };
  async function load() {
    if(refreshing)return;
    refreshing=true;
    status.textContent='Checking pending applications…';
    try {
      const {items}=await api('/pending');
      wrapper.replaceChildren();
      status.textContent=items.length+' pending membership application'+(items.length===1?'':'s')+'.';
      for(const record of items){
        const card=document.createElement('article');card.className='membership-card';
        const h=document.createElement('h3');h.textContent=record.name||record.email;card.append(h);
        card.append(line('Email',record.email),line('Organisation',record.organisation),
          line('Role',record.role),line('Country',record.country),
          line('Research interest',record.interest));
        const button=document.createElement('button');button.type='button';
        button.textContent='Approve and queue welcome email';
        const feedback=document.createElement('p');feedback.setAttribute('role','status');
        button.onclick=async()=>{
          if(!confirm('Approve '+(record.name||record.email)+'? This will queue their welcome email.'))return;
          button.disabled=true;feedback.textContent='Processing approval…';
          try {
            const result=await api('/approve',{email:record.email});
            feedback.textContent=result.message;
            button.remove();
            const check=document.createElement('button');check.type='button';
            check.className='secondary';check.textContent='Check email status';
            check.onclick=async()=>{
              try {
                const detail=await api('/delivery/'+encodeURIComponent(record.email));
                feedback.textContent='Email: '+detail.welcomeState+
                  (detail.acceptedAt?' · SMTP accepted '+new Date(detail.acceptedAt).toLocaleString():'')+
                  (detail.lastError?' · '+detail.lastError:'');
              }catch(err){feedback.textContent=err.message;}
            };
            card.append(check);
            status.textContent='Member approved. Welcome email queued.';
          }catch(err){feedback.textContent=err.message;button.disabled=false;}
        };
        card.append(button,feedback);wrapper.append(card);
      }
    }catch(err){
      status.textContent=err.message;
    }finally{refreshing=false;}
  }
  get('membership-refresh').onclick=load;
  const office=get('office');
  new MutationObserver(()=>{if(!office.hidden)load();}).observe(office,{
    attributes:true,attributeFilter:['hidden']
  });
  if(!office.hidden)load();
})();
