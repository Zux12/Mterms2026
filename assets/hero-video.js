/* Inject a looping background video into the existing .hero section without modifying your HTML.
   - Uses poster fallback
   - Respects prefers-reduced-motion and Save-Data
   - Falls back to static poster if autoplay fails
*/
(function () {
  const hero = document.querySelector('.hero');
  if (!hero) return;

  // Respect user/device constraints
  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = (navigator.connection && navigator.connection.saveData) || false;
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  // If user prefers reduced motion or asked to save data, just show poster background (no video)
  if (prefersReduced || saveData) {
    if (!hero.style.backgroundImage || !hero.style.backgroundImage.includes('hero-poster.jpg')) {
      hero.style.backgroundImage = "url('assets/hero-poster.jpg')";
      hero.style.backgroundSize = 'cover';
      hero.style.backgroundPosition = 'center';
      hero.style.backgroundRepeat = 'no-repeat';
    }
    return;
  }

  // Build video element
  const video = document.createElement('video');
  video.className = 'hero-bg-video';
  video.setAttribute('playsinline', ''); // for iOS
  video.setAttribute('muted', '');       // autoplay requires muted
  video.setAttribute('autoplay', '');
  video.setAttribute('loop', '');
  video.setAttribute('preload', 'auto');
  video.setAttribute('poster', 'assets/hero-poster.jpg');

  // Prefer WEBM where supported, MP4 fallback
  const canWebm = document.createElement('video').canPlayType('video/webm; codecs="vp9"');
  if (canWebm) {
    const srcWebm = document.createElement('source');
    srcWebm.src = 'assets/hero.webm';
    srcWebm.type = 'video/webm';
    video.appendChild(srcWebm);
  }
  const srcMp4 = document.createElement('source');
  srcMp4.src = 'assets/hero.mp4';
  srcMp4.type = 'video/mp4';
  video.appendChild(srcMp4);

  // Insert as the first child so it stays behind .hero-inner
  hero.insertBefore(video, hero.firstChild);

  // Autoplay handling
  const fadeIn = () => { video.style.opacity = '1'; };
  video.addEventListener('loadeddata', fadeIn, { once: true });

  // If autoplay fails (e.g., strict browser policies), use poster background
  video.play().catch(() => {
    hero.style.backgroundImage = "url('assets/hero-poster.jpg')";
    hero.style.backgroundSize = 'cover';
    hero.style.backgroundPosition = 'center';
    hero.style.backgroundRepeat = 'no-repeat';
    video.remove(); // cleanup
  });

  // Optional: On very small screens, avoid heavy video on first paint if touch + narrow
  if (isTouch && window.innerWidth < 480) {
    // If you want to skip video entirely on tiny devices, uncomment:
    // hero.style.backgroundImage = "url('assets/hero-poster.jpg')";
    // hero.style.backgroundSize = 'cover';
    // hero.style.backgroundPosition = 'center';
    // video.remove();
  }
})();
