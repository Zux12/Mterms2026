/* capabilities.js — creates a floating button and a modal, loads content from JSON */
(function(){
  const CSS = 'assets/capabilities.css';
  const DATA = 'assets/capabilities.data.json';

  // load CSS (safe even if included twice)
  if(!document.querySelector('link[data-capabilities]')){
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = CSS;
    link.setAttribute('data-capabilities','');
    document.head.appendChild(link);
  }

  // Floating button
  const fab = document.createElement('button');
  fab.id = 'capabilities-fab';
  fab.setAttribute('aria-haspopup','dialog');
  fab.innerHTML = '<span class="cap-icon">⚡</span><span>Capabilities</span>';
  document.body.appendChild(fab);

  // Backdrop + modal shell
  const backdrop = document.createElement('div');
  backdrop.className = 'cap-modal-backdrop';
  const modal = document.createElement('div');
  modal.className = 'cap-modal';
  modal.setAttribute('role','dialog');
  modal.setAttribute('aria-modal','true');
  modal.setAttribute('aria-label','MTERMS capabilities');

  modal.innerHTML = `
    <div class="cap-header">
      <div class="cap-title">Capabilities</div>
      <button class="cap-close" aria-label="Close capabilities">✕</button>
    </div>
    <div class="cap-body">
      <nav class="cap-nav" aria-label="Capabilities sections"></nav>
      <section class="cap-panel"></section>
    </div>
  `;

  document.body.appendChild(backdrop);
  document.body.appendChild(modal);

  const navEl = modal.querySelector('.cap-nav');
  const panelEl = modal.querySelector('.cap-panel');
  const closeBtn = modal.querySelector('.cap-close');

  function openModal(){
    backdrop.style.display = 'block';
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
  }
  function closeModal(){
    backdrop.style.display = 'none';
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }

  backdrop.addEventListener('click', closeModal);
  closeBtn.addEventListener('click', closeModal);
  document.addEventListener('keydown', (e)=>{ if(e.key === 'Escape') closeModal(); });
  fab.addEventListener('click', openModal);

  // Fetch content
  fetch(DATA).then(r=>r.json()).then(data=>{
    // Header text
    modal.querySelector('.cap-title').textContent = data.title || 'Capabilities';

    // Build nav
    data.tabs.forEach((t, idx)=>{
      const btn = document.createElement('button');
      btn.textContent = t.label;
      btn.dataset.tab = t.id;
      if(idx===0) btn.classList.add('active');
      btn.addEventListener('click', ()=>selectTab(t.id));
      navEl.appendChild(btn);
    });

    // Initial render
    renderPanel(data.tabs[0]);
    function selectTab(id){
      const tab = data.tabs.find(x=>x.id===id) || data.tabs[0];
      navEl.querySelectorAll('button').forEach(b=>{
        b.classList.toggle('active', b.dataset.tab===id);
      });
      renderPanel(tab);
    }

    function renderPanel(tab){
      panelEl.innerHTML = `
        <div class="cap-kicker">${tab.kicker || ''}</div>
        <h3>${tab.label}</h3>
        <div class="cap-grid">
          <div class="cap-card">
            <ul>${(tab.bullets||[]).map(li=>`<li>${li}</li>`).join('')}</ul>
            <div class="cap-badges">${(tab.badges||[]).map(b=>`<span class="cap-badge">${b}</span>`).join('')}</div>
            <div class="cap-cta-row">
              ${(tab.ctas||[]).map(c=>`<a class="cap-btn ${c.style==='primary'?'primary':''}" href="${c.href}" target="_blank" rel="noopener">${c.label}</a>`).join('')}
            </div>
            <div class="cap-footnote">${tab.footnote || ''}</div>
            <div class="cap-divider"></div>
            <div class="cap-note">Tip: Ask us for a sandbox with dummy data to see the full flow.</div>
          </div>
          <div class="cap-card">
            ${tab.image ? `<img src="${tab.image}" alt="${tab.label} illustration">` : ''}
            <div class="cap-footnote">Illustrative preview only.</div>
          </div>
        </div>
      `;
    }
  }).catch(()=>{
    panelEl.innerHTML = '<p>Unable to load capabilities content.</p>';
  });

  // Deep link (optional): open modal if URL has #capabilities
  if(location.hash.replace('#','').toLowerCase()==='capabilities'){ openModal(); }
})();
