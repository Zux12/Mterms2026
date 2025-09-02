(function(){
  // Create button below Program section
  const programSection = document.querySelector('#program .container');
  if(!programSection) return;

  const btn = document.createElement('button');
  btn.id = 'agenda-fab';
  btn.textContent = '📅 View Detailed Agenda';
  programSection.appendChild(btn);

  // Backdrop + Modal shell
  const backdrop = document.createElement('div');
  backdrop.className = 'agenda-backdrop';
  const modal = document.createElement('div');
  modal.className = 'agenda-modal';
  modal.innerHTML = `
    <div class="agenda-header">
      <div class="agenda-title">MTERMS 2026 — Detailed Agenda</div>
      <button class="agenda-close" aria-label="Close">✕</button>
    </div>
    <div class="agenda-body"></div>
  `;
  document.body.appendChild(backdrop);
  document.body.appendChild(modal);

  const closeBtn = modal.querySelector('.agenda-close');
  const bodyEl = modal.querySelector('.agenda-body');

  function openModal(){ backdrop.style.display='block'; modal.style.display='block'; }
  function closeModal(){ backdrop.style.display='none'; modal.style.display='none'; }

  btn.addEventListener('click', openModal);
  backdrop.addEventListener('click', closeModal);
  closeBtn.addEventListener('click', closeModal);
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeModal(); });

  // Fetch JSON data
  fetch('assets/agenda-popup.data.json')
    .then(r=>r.json())
    .then(data=>{
      bodyEl.innerHTML = '';
      data.days.forEach(day=>{
        const dayDiv = document.createElement('div');
        dayDiv.className = 'agenda-day';
        dayDiv.innerHTML = `<h3>${day.title}</h3>`;

        day.items.forEach(item=>{
          const itemDiv = document.createElement('div');
          itemDiv.className = 'agenda-item';
          let html = `<div class="agenda-time">${item.time}</div>`;
          html += `<div class="agenda-session">${item.session}</div>`;
          if(item.speaker) html += `<div class="agenda-speaker">Speaker: ${item.speaker}</div>`;
          if(item.talkTitle) html += `<div class="agenda-speaker">Title: ${item.talkTitle}</div>`;

          if(item.subSessions){
            html += '<ul style="margin-top:6px; padding-left:18px">';
            item.subSessions.forEach(ss=>{
              html += `<li>${ss.topic}`;
              if(ss.speaker) html += ` — <span class="agenda-speaker">${ss.speaker}</span>`;
              if(ss.talkTitle) html += ` <em>(${ss.talkTitle})</em>`;
              html += `</li>`;
            });
            html += '</ul>';
          }

          itemDiv.innerHTML = html;
          dayDiv.appendChild(itemDiv);
        });

        bodyEl.appendChild(dayDiv);
      });
    })
    .catch(()=>{ bodyEl.innerHTML='<p>Unable to load agenda.</p>'; });
})();
