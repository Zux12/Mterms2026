// presentation-submission.js
// Depends on functions already defined in participants.html:
// - requireSessionOrThrow()
// - uploadDoc(type, fileInputId, msgId, latestBoxId)
// - loadLatest(type, latestBoxId)
// And global constant POSTER_LOCK_MARKER (already in participants.html)

(function(){
  function $(id){ return document.getElementById(id); }

  function effectiveProgramType(user){
    const posterLocked = (user?.program?.topicArea === POSTER_LOCK_MARKER);
    if (posterLocked) return 'poster';
    const v = String(user?.program?.type || '').toLowerCase();
    if (v === 'poster' || v === 'oral') return v;
    // your current portal treats default as oral
    return 'oral';
  }

  function isPresenter(user){
    // best-effort: if they ticked presenter in your current flow, it's usually stored in user.program.presenter
    // if missing, still allow (since committee may still request uploads)
    if (user?.program && typeof user.program.presenter === 'boolean') return user.program.presenter;
    return true;
  }

  function render(){
    let user;
    try { user = requireSessionOrThrow(); }
    catch { return; }

    const card = $('presCard');
    if (!card) return;

    // If you want to hide for non-presenters, we do it here:
    if (!isPresenter(user)){
      card.style.display = 'none';
      return;
    }

    const type = effectiveProgramType(user); // 'oral' or 'poster'
    card.style.display = 'block';

    const banner = $('presBanner');
    if (banner){
      banner.innerHTML = (type === 'poster')
        ? 'You have been selected for <strong>Poster Presentation</strong>. Please upload your poster file only after you have received the confirmation email titled “MTERMS 2026 Acceptance Letter” from admin@mterms2026.com.'
        : 'You have been selected for <strong>Oral Presentation</strong>. Please upload your presentation file only after you have received the confirmation email titled “MTERMS 2026 Acceptance Letter” from admin@mterms2026.com.';
    }

    const slidesPane = $('slidesPane');
    const posterPane = $('posterPane');
    if (slidesPane) slidesPane.style.display = (type === 'poster' ? 'none' : 'block');
    if (posterPane) posterPane.style.display = (type === 'poster' ? 'block' : 'none');

    // Bind buttons (idempotent)
    if (type !== 'poster'){
      const up = $('slidesUploadBtn');
      const rf = $('slidesRefreshBtn');
      if (up && !up.dataset.bound){
        up.dataset.bound = '1';
        up.addEventListener('click', () => uploadDoc('slides', 'slidesFile', 'slidesMsg', 'slidesLatest'));
      }
      if (rf && !rf.dataset.bound){
        rf.dataset.bound = '1';
        rf.addEventListener('click', () => loadLatest('slides', 'slidesLatest'));
      }
      loadLatest('slides', 'slidesLatest');
    } else {
      const up = $('posterUploadBtn');
      const rf = $('posterRefreshBtn');
      if (up && !up.dataset.bound){
        up.dataset.bound = '1';
        up.addEventListener('click', () => uploadDoc('poster', 'posterFile', 'posterMsg', 'posterLatest'));
      }
      if (rf && !rf.dataset.bound){
        rf.dataset.bound = '1';
        rf.addEventListener('click', () => loadLatest('poster', 'posterLatest'));
      }
      loadLatest('poster', 'posterLatest');
    }
  }

  // expose for participants.html to call after login/load
  window.mountPresentationSubmission = render;

  // also attempt auto-run (safe)
  document.addEventListener('DOMContentLoaded', () => {
    // wait a tick: participants.html may set session after login
    setTimeout(() => {
      if (typeof window.requireSessionOrThrow === 'function') render();
    }, 50);
  });
})();
