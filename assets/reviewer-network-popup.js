// assets/reviewer-network-popup.js
(function(){
  const STORAGE_KEY = 'mtermsReviewerNetworkPopupLastSeen';
  const SUBMITTED_KEY = 'mtermsReviewerNetworkSubmitted';

  function todayKey(){
    return new Date().toISOString().slice(0,10);
  }

  function shouldAutoOpen(){
    const submitted = localStorage.getItem(SUBMITTED_KEY) === '1';
    if (submitted) return false;

    const lastSeen = localStorage.getItem(STORAGE_KEY);
    return lastSeen !== todayKey();
  }

  function markSeenToday(){
    localStorage.setItem(STORAGE_KEY, todayKey());
  }

  function openPopup(){
    const backdrop = document.getElementById('rnBackdrop');
    if (!backdrop) return;
    backdrop.classList.add('rn-show');
    markSeenToday();
  }

  function closePopup(){
    const backdrop = document.getElementById('rnBackdrop');
    if (!backdrop) return;
    backdrop.classList.remove('rn-show');
    markSeenToday();
  }

  function build(){
    if (document.getElementById('rnFloatBtn')) return;

    const floatBtn = document.createElement('button');
    floatBtn.id = 'rnFloatBtn';
    floatBtn.className = 'rn-float-btn';
    floatBtn.type = 'button';
    floatBtn.setAttribute('aria-label', 'Open Reviewer Network invitation');
floatBtn.innerHTML = `
  <img src="public/reviewer.png" alt="Reviewer Network">
`;

    const backdrop = document.createElement('div');
    backdrop.id = 'rnBackdrop';
    backdrop.className = 'rn-backdrop';
    backdrop.innerHTML = `
      <div class="rn-modal" role="dialog" aria-modal="true" aria-labelledby="rnTitle">
        <div class="rn-modal-head">
          <button class="rn-close" type="button" id="rnCloseTop" aria-label="Close">×</button>
          <div class="rn-kicker">Reviewer Network Invitation</div>
          <h2 id="rnTitle">Interested in Becoming a Panel Reviewer?</h2>
        </div>

        <div class="rn-modal-body">
          <h3>Join the MTERMS 2026 Reviewer Network</h3>

          <p>
            MTERMS 2026 is expanding its professional network of academic and industry reviewers for future conferences,
            scientific forums, and scholarly programmes.
          </p>

          <p>
            We warmly invite researchers, clinicians, academicians, and professionals to register their interest by sharing
            their details and areas of expertise.
          </p>

          <p>
            Selected reviewers may be contacted for future opportunities to contribute to scientific review activities,
            conference panels, and academic collaborations.
          </p>

          <div class="rn-benefit-row">
            <div class="rn-benefit">
              <strong>Contribute</strong>
              <span>Support scientific quality through future review activities.</span>
            </div>
            <div class="rn-benefit">
              <strong>Connect</strong>
              <span>Join a growing academic and professional reviewer community.</span>
            </div>
            <div class="rn-benefit">
              <strong>Collaborate</strong>
              <span>Be considered for future conferences, forums, and panels.</span>
            </div>
          </div>

          <p>
            We look forward to building a strong and distinguished reviewer community together.
          </p>

          <div class="rn-actions">
            <a class="rn-btn rn-btn-primary" id="rnRegisterBtn" href="reviewer-interest.html">
              Register Interest
            </a>
            <button class="rn-btn rn-btn-secondary" type="button" id="rnMaybeLaterBtn">
              Maybe Later
            </button>
            <button class="rn-btn rn-btn-secondary" type="button" id="rnCloseBtn">
              Close
            </button>
          </div>

          <div class="rn-small">
            This invitation will appear automatically once per day. You may also reopen it anytime using the Reviewer Network icon.
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(floatBtn);
    document.body.appendChild(backdrop);

    floatBtn.addEventListener('click', openPopup);

    document.getElementById('rnCloseTop').addEventListener('click', closePopup);
    document.getElementById('rnCloseBtn').addEventListener('click', closePopup);
    document.getElementById('rnMaybeLaterBtn').addEventListener('click', closePopup);

    document.getElementById('rnRegisterBtn').addEventListener('click', () => {
      markSeenToday();
    });

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closePopup();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closePopup();
    });

    if (shouldAutoOpen()) {
      setTimeout(openPopup, 3800);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
