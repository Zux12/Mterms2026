'use strict';
(() => {
  const el = id => document.getElementById(id);
  const rows = el('authors-rows'), panel = el('author-edit');
  if (!rows || !panel) return;
  let authors = [], visible = [], page = 0, current = null, sequence = 0;
  const perPage = 20;
  const status = el('authors-summary');

  async function request(path, data) {
    const response = await fetch('authors' + path, data === undefined ? {cache:'no-store'} : {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data),cache:'no-store'
    });
    let value = {};
    try { value = await response.json(); } catch (_) {}
    if (!response.ok) throw Error(value.error || (response.status === 401 ? 'Please sign in.' : 'Could not load author records.'));
    return value;
  }
  function cell(row,text) {
    const node = document.createElement('td');
    node.textContent = text;
    row.append(node);
    return node;
  }
  function update() {
    const q = el('authors-search').value.trim().toLowerCase(), mode = el('authors-filter').value;
    visible = authors.filter(a => {
      const matches = !q || [a.name,a.email,a.affiliation,...a.publications.map(p=>p.title)]
        .join(' ').toLowerCase().includes(q);
      const state = mode==='all' ||
        mode==='missing-email'&&!a.email ||
        mode==='missing-affiliation'&&!a.affiliation ||
        mode==='complete'&&!!a.email&&!!a.affiliation;
      return matches && state;
    });
    page = Math.min(page,Math.max(0,Math.ceil(visible.length/perPage)-1));
    rows.replaceChildren();
    for(const author of visible.slice(page*perPage,(page+1)*perPage)) {
      const tr=document.createElement('tr');
      cell(tr,author.name);
      cell(tr,author.affiliation || 'Not recorded');
      cell(tr,author.email || 'Not recorded');
      cell(tr,String(author.publications.length));
      const td=cell(tr,'');
      const button=document.createElement('button');button.type='button';button.textContent='Details';
      button.className='secondary';button.onclick=()=>edit(author);
      td.append(button);
      rows.append(tr);
    }
    status.textContent=visible.length+' of '+authors.length+' authors · '+
      authors.filter(a=>a.email).length+' with email · '+
      authors.filter(a=>a.affiliation).length+' with affiliation';
    el('authors-page').textContent=visible.length?
      'Page '+(page+1)+' of '+Math.ceil(visible.length/perPage):'No matching authors';
    el('authors-prev').disabled=page===0;
    el('authors-next').disabled=(page+1)*perPage>=visible.length;
  }
  async function load() {
    const ticket=++sequence;
    status.textContent='Loading author records…';
    try {
      const result=await request('/');
      if(ticket!==sequence)return;
      authors=result.items || [];
      page=0;update();
    } catch(error) {
      if(ticket!==sequence)return;
      authors=[];rows.replaceChildren();
      status.textContent=error.message;
    }
  }
  function edit(author) {
    current=author;
    el('author-edit-name').textContent=author.name;
    el('author-edit-email').value=author.email || '';
    el('author-edit-affiliation').value=author.affiliation || '';
    el('author-edit-papers').textContent=author.publications.length+' published work(s): '+
      author.publications.map(p=>p.title).join(' • ');
    el('author-edit-message').textContent=author.emailSource || 'Email not supplied.';
    panel.hidden=false;
    panel.scrollIntoView({block:'nearest'});
  }
  panel.onsubmit=async event=>{
    event.preventDefault();
    if(!current)return;
    const save=panel.querySelector('button[type=submit]');
    save.disabled=true;
    try {
      const email=el('author-edit-email').value.trim();
      const affiliation=el('author-edit-affiliation').value.trim();
      await request('/details',{id:current.id,email,affiliation});
      panel.hidden=true;current=null;
      await load();
      status.textContent+=' · Author details saved.';
    } catch(error) {el('author-edit-message').textContent=error.message;}
    finally {save.disabled=false;}
  };
  el('author-edit-cancel').onclick=()=>{panel.hidden=true;current=null;};
  el('authors-refresh').onclick=load;
  el('authors-prev').onclick=()=>{if(page>0){page--;update();}};
  el('authors-next').onclick=()=>{if((page+1)*perPage<visible.length){page++;update();}};
  let searchTimer;
  el('authors-search').oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{page=0;update();},150);};
  el('authors-filter').onchange=()=>{page=0;update();};
  // Author API is authenticated. Never request sensitive data until the editor logs in.
  const office=el('office');
  new MutationObserver(()=>{if(!office.hidden && !authors.length)load();})
    .observe(office,{attributes:true,attributeFilter:['hidden']});
  if(!office.hidden)load();
})();
