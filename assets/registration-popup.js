(function () {
  function openPopup() {
    const overlay = document.getElementById('regAlertOverlay');
    if (!overlay) return;

    overlay.classList.add('show');
    overlay.setAttribute('aria-hidden', 'false');
  }

  function closePopup() {
    const overlay = document.getElementById('regAlertOverlay');
    if (!overlay) return;

    overlay.classList.remove('show');
    overlay.setAttribute('aria-hidden', 'true');
  }

  fetch('registration-popup.html')
    .then(response => response.text())
    .then(html => {
      document.body.insertAdjacentHTML('beforeend', html);

      const closeBtn = document.getElementById('regAlertClose');
      const okBtn = document.getElementById('regAlertOk');
      const overlay = document.getElementById('regAlertOverlay');

      if (closeBtn) closeBtn.addEventListener('click', closePopup);
      if (okBtn) okBtn.addEventListener('click', closePopup);

      if (overlay) {
        overlay.addEventListener('click', function (e) {
          if (e.target === overlay) closePopup();
        });
      }

      openPopup();
    })
    .catch(function () {
      console.warn('Registration popup could not be loaded.');
    });
})();
