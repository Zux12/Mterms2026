// admin-presentation-review.js
// Depends on globals in admin.html: API, authHeader(), pickLatestRow()

(function(){
  function $(id){ return document.getElementById(id); }

  async function loadLatestBox(regCode, email, type, boxId){
    const box = $(boxId);
    if (!box) return;
    box.innerHTML = 'Loading…';
    try{
      const r = await fetch(`${API}/api/uploads/history?regCode=${encodeURIComponent(regCode)}&email=${encodeURIComponent(email)}&type=${encodeURIComponent(type)}`);
      const data = await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(data.error||'Error');

      const latest = (typeof pickLatestRow === 'function')
        ? pickLatestRow(data.rows||[])
        : (data.rows||[]).sort((a,b)=>new Date(b.uploadedAt||0)-new Date(a.uploadedAt||0))[0];

      box.innerHTML = latest
        ? `<div style="border:1px solid var(--border);border-radius:8px;padding:8px;background:#fff">
            <strong>v${latest.version}</strong> — ${latest.filename}<br>
            <small>${new Date(latest.uploadedAt).toLocaleString()}</small><br>
            <div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap">
<a class="btn" href="${API}${latest.downloadUrl}" target="_blank" rel="noopener">Open</a>
</div>
          </div>`
        : '<div class="help">No upload found yet.</div>';
    }catch(e){
      box.innerHTML = `<div class="help" style="color:#b91c1c">Failed: ${String(e.message||e)}</div>`;
    }
  }

  async function mount(regCode, email){
    const wrap = $('presentationReviewMount');
    if (wrap) wrap.style.display = 'block';

    await loadLatestBox(regCode, email, 'slides', 'adSlidesBox');
    await loadLatestBox(regCode, email, 'poster', 'adPosterBox');
  }

  window.mountPresentationReview = mount;
})();
