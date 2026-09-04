/* =========================================================
   MTERMS 2026 — EVENT COUNTDOWN
   Single-file component: HTML + CSS + JavaScript

   Event:
   7–8 September 2026
   Shah Alam, Malaysia
   Malaysia Time (UTC+8)
   ========================================================= */

(function () {

  /* ========================================================
     SETTINGS
     ======================================================== */

  // Countdown target:
  // 7 September 2026, 12:00 AM Malaysia Time (UTC+8)
  const EVENT_START = new Date('2026-09-07T00:00:00+08:00');

  // Event ends:
  // 8 September 2026, 11:59:59 PM Malaysia Time (UTC+8)
  const EVENT_END = new Date('2026-09-08T23:59:59+08:00');


  /* ========================================================
     PREVENT DUPLICATES
     ======================================================== */

  if (document.getElementById('mtermsCountdownSection')) {
    return;
  }


  /* ========================================================
     CSS
     ======================================================== */

  const style = document.createElement('style');

  style.id = 'mtermsCountdownStyles';

  style.textContent = `

    /* ==========================================
       MTERMS COUNTDOWN SECTION
       ========================================== */

    #mtermsCountdownSection{
      position: relative;
      width: 100%;
      overflow: hidden;
      background:
        radial-gradient(
          circle at 15% 30%,
          rgba(47,123,220,.16),
          transparent 34%
        ),
        radial-gradient(
          circle at 85% 70%,
          rgba(22,101,52,.13),
          transparent 34%
        ),
        linear-gradient(
          135deg,
          #020817 0%,
          #06152c 45%,
          #031021 100%
        );

      border-top: 1px solid rgba(255,255,255,.08);
      border-bottom: 1px solid rgba(255,255,255,.08);

      color: #ffffff;
      isolation: isolate;
    }


    /* subtle animated background glow */

    #mtermsCountdownSection::before{
      content: "";
      position: absolute;
      width: 520px;
      height: 520px;
      left: -220px;
      top: -260px;

      background:
        radial-gradient(
          circle,
          rgba(47,123,220,.18) 0%,
          rgba(47,123,220,.05) 42%,
          transparent 70%
        );

      border-radius: 50%;
      filter: blur(10px);
      pointer-events: none;
      z-index: -1;

      animation: mtermsCountdownGlowA 9s ease-in-out infinite alternate;
    }


    #mtermsCountdownSection::after{
      content: "";
      position: absolute;
      width: 480px;
      height: 480px;
      right: -180px;
      bottom: -260px;

      background:
        radial-gradient(
          circle,
          rgba(22,101,52,.17) 0%,
          rgba(22,101,52,.04) 45%,
          transparent 70%
        );

      border-radius: 50%;
      pointer-events: none;
      z-index: -1;

      animation: mtermsCountdownGlowB 11s ease-in-out infinite alternate;
    }


    @keyframes mtermsCountdownGlowA{
      from{
        transform: translate3d(0,0,0) scale(1);
      }

      to{
        transform: translate3d(80px,25px,0) scale(1.12);
      }
    }


    @keyframes mtermsCountdownGlowB{
      from{
        transform: translate3d(0,0,0) scale(1);
      }

      to{
        transform: translate3d(-70px,-20px,0) scale(1.12);
      }
    }


    /* ------------------------------------------
       main wrapper
       ------------------------------------------ */

    .mterms-countdown-inner{
      position: relative;
      width: min(1180px, calc(100% - 40px));
      margin: 0 auto;

      padding: 42px 0 40px;

      text-align: center;
    }


    /* ------------------------------------------
       small live/event label
       ------------------------------------------ */

    .mterms-countdown-eyebrow{
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 9px;

      margin-bottom: 14px;

      color: rgba(255,255,255,.76);

      font-family: Inter, Arial, sans-serif;
      font-size: .78rem;
      font-weight: 700;
      letter-spacing: .20em;
      text-transform: uppercase;
    }


    .mterms-countdown-live-dot{
      display: inline-block;
      width: 7px;
      height: 7px;

      border-radius: 999px;

      background: #ffffff;

      box-shadow:
        0 0 0 4px rgba(255,255,255,.08),
        0 0 14px rgba(255,255,255,.45);

      animation: mtermsLivePulse 1.8s ease-in-out infinite;
    }


    @keyframes mtermsLivePulse{

      0%,100%{
        opacity: .55;
        transform: scale(.9);
      }

      50%{
        opacity: 1;
        transform: scale(1.12);
      }

    }


    /* ------------------------------------------
       heading
       ------------------------------------------ */

    .mterms-countdown-title{
      margin: 0;

      color: #ffffff;

      font-family: Inter, Arial, sans-serif;

      font-size: clamp(1.45rem, 3vw, 2.15rem);
      line-height: 1.15;
      font-weight: 800;

      letter-spacing: .04em;
    }


    .mterms-countdown-title-accent{
      background:
        linear-gradient(
          90deg,
          #ffffff 0%,
          #a9d1ff 47%,
          #b8e4ca 100%
        );

      -webkit-background-clip: text;
      background-clip: text;

      color: transparent;
    }


    /* ------------------------------------------
       countdown numbers
       ------------------------------------------ */

    .mterms-countdown-clock{
      display: flex;
      align-items: stretch;
      justify-content: center;

      gap: 0;

      max-width: 930px;

      margin: 28px auto 24px;
    }


    .mterms-countdown-unit{
      position: relative;

      flex: 1 1 0;

      min-width: 0;

      padding: 4px 34px 2px;

      font-family: Inter, Arial, sans-serif;
    }


    /* vertical dividers */

    .mterms-countdown-unit:not(:last-child)::after{
      content: "";

      position: absolute;

      right: 0;
      top: 14%;

      width: 1px;
      height: 72%;

      background:
        linear-gradient(
          to bottom,
          transparent,
          rgba(255,255,255,.26),
          transparent
        );
    }


    .mterms-countdown-number{
      display: block;

      color: #ffffff;

      font-size: clamp(3.3rem, 7vw, 5.8rem);
      font-weight: 800;
      line-height: .95;

      letter-spacing: -.045em;

      font-variant-numeric: tabular-nums;

      text-shadow:
        0 8px 28px rgba(0,0,0,.35);

      transition:
        opacity .18s ease,
        transform .18s ease;
    }


    /* tiny pulse each time number changes */

    .mterms-countdown-number.tick{
      animation: mtermsNumberTick .28s ease;
    }


    @keyframes mtermsNumberTick{

      0%{
        opacity: .6;
        transform: translateY(-3px);
      }

      100%{
        opacity: 1;
        transform: translateY(0);
      }

    }


    .mterms-countdown-label{
      display: block;

      margin-top: 9px;

      color: rgba(255,255,255,.58);

      font-size: .72rem;
      font-weight: 700;

      letter-spacing: .20em;

      text-transform: uppercase;
    }


    /* ------------------------------------------
       event information
       ------------------------------------------ */

    .mterms-countdown-event{
      margin-top: 4px;

      color: rgba(255,255,255,.94);

      font-family: Inter, Arial, sans-serif;

      font-size: .98rem;
      line-height: 1.5;
      font-weight: 650;

      letter-spacing: .025em;
    }


    .mterms-countdown-timezone{
      display: inline-flex;
      align-items: center;
      justify-content: center;

      gap: 7px;

      margin-top: 6px;

      color: rgba(255,255,255,.55);

      font-family: Inter, Arial, sans-serif;

      font-size: .79rem;
      font-weight: 500;

      letter-spacing: .035em;
    }


    .mterms-countdown-timezone-icon{
      opacity: .8;
    }


    /* ------------------------------------------
       Register button
       ------------------------------------------ */

    .mterms-countdown-action{
      margin-top: 22px;
    }


    .mterms-countdown-register{
      display: inline-flex;

      align-items: center;
      justify-content: center;

      min-height: 44px;

      padding: 12px 23px;

      border-radius: 999px;

      background: #ffffff;

      color: #071426 !important;

      border: 1px solid rgba(255,255,255,.92);

      text-decoration: none !important;

      font-family: Inter, Arial, sans-serif;

      font-size: .88rem;
      font-weight: 800;

      letter-spacing: .025em;

      box-shadow:
        0 10px 30px rgba(0,0,0,.22);

      transition:
        transform .22s ease,
        box-shadow .22s ease,
        background .22s ease;
    }


    .mterms-countdown-register:hover{
      transform: translateY(-2px);

      background: #f7fbff;

      box-shadow:
        0 14px 34px rgba(0,0,0,.28);
    }


/* ------------------------------------------
   Participant agenda action
   ------------------------------------------ */

.mterms-countdown-participant{
  margin-top: 18px;
  padding-top: 17px;

  border-top: 1px solid rgba(255,255,255,.10);

  font-family: Inter, Arial, sans-serif;
}


.mterms-countdown-participant-label{
  margin-bottom: 10px;

  color: rgba(255,255,255,.58);

  font-size: .76rem;
  font-weight: 500;

  letter-spacing: .03em;
}


.mterms-countdown-agenda{
  display: inline-flex;
  align-items: center;
  justify-content: center;

  min-height: 42px;

  padding: 10px 20px;

  border-radius: 999px;

  background: rgba(255,255,255,.06);

  color: #ffffff !important;

  border: 1px solid rgba(255,255,255,.30);

  text-decoration: none !important;

  font-size: .82rem;
  font-weight: 700;

  letter-spacing: .025em;

  backdrop-filter: blur(4px);

  transition:
    background .22s ease,
    border-color .22s ease,
    transform .22s ease;
}


.mterms-countdown-agenda:hover{
  background: rgba(255,255,255,.12);

  border-color: rgba(255,255,255,.55);

  transform: translateY(-2px);
}

    /* ------------------------------------------
       Event started / finished modes
       ------------------------------------------ */

    .mterms-countdown-status-message{
      display: none;

      max-width: 800px;

      margin: 26px auto 8px;

      font-family: Inter, Arial, sans-serif;

      font-size: clamp(2rem, 5vw, 4rem);
      font-weight: 800;

      line-height: 1.08;

      letter-spacing: -.025em;

      color: #ffffff;
    }


    #mtermsCountdownSection.event-active
    .mterms-countdown-clock,

    #mtermsCountdownSection.event-ended
    .mterms-countdown-clock{
      display: none;
    }


    #mtermsCountdownSection.event-active
    .mterms-countdown-status-message,

    #mtermsCountdownSection.event-ended
    .mterms-countdown-status-message{
      display: block;
    }


    /* ------------------------------------------
       MOBILE
       ------------------------------------------ */

    @media (max-width: 700px){

      .mterms-countdown-inner{
        width: min(100% - 24px, 1180px);

        padding: 30px 0 29px;
      }


      .mterms-countdown-eyebrow{
        margin-bottom: 11px;

        font-size: .65rem;
        letter-spacing: .16em;
      }


      .mterms-countdown-title{
        padding: 0 8px;

        font-size: 1.35rem;
      }


      .mterms-countdown-clock{
        margin-top: 24px;
        margin-bottom: 20px;
      }


      .mterms-countdown-unit{
        padding: 2px 8px;
      }


      .mterms-countdown-number{
        font-size: clamp(2.35rem, 13vw, 3.4rem);
      }


      .mterms-countdown-label{
        margin-top: 8px;

        font-size: .54rem;

        letter-spacing: .10em;
      }


      .mterms-countdown-unit:not(:last-child)::after{
        top: 10%;
        height: 77%;
      }


      .mterms-countdown-event{
        padding: 0 12px;

        font-size: .86rem;
      }


      .mterms-countdown-timezone{
        font-size: .73rem;
      }


      .mterms-countdown-action{
        margin-top: 18px;
      }


      .mterms-countdown-register{
        width: calc(100% - 34px);

        max-width: 330px;

        padding: 12px 18px;

        font-size: .84rem;
      }

      .mterms-countdown-participant{
  margin-top: 16px;
  padding-top: 15px;
}


.mterms-countdown-agenda{
  width: calc(100% - 34px);

  max-width: 330px;

  padding: 11px 16px;

  font-size: .78rem;
}

    }


    /* ------------------------------------------
       VERY SMALL MOBILE
       ------------------------------------------ */

    @media (max-width: 390px){

      .mterms-countdown-unit{
        padding-left: 5px;
        padding-right: 5px;
      }


      .mterms-countdown-number{
        font-size: 2.2rem;
      }


      .mterms-countdown-label{
        font-size: .48rem;
      }

    }


    /* ------------------------------------------
       Accessibility
       ------------------------------------------ */

    @media (prefers-reduced-motion: reduce){

      #mtermsCountdownSection::before,
      #mtermsCountdownSection::after,
      .mterms-countdown-live-dot,
      .mterms-countdown-number.tick{
        animation: none !important;
      }

    }

  `;

  document.head.appendChild(style);


  /* ========================================================
     HTML
     ======================================================== */

  const countdownSection = document.createElement('section');

  countdownSection.id = 'mtermsCountdownSection';

  countdownSection.setAttribute(
    'aria-label',
    'Countdown to MTERMS 2026'
  );


  countdownSection.innerHTML = `

    <div class="mterms-countdown-inner">

      <div class="mterms-countdown-eyebrow">

        <span
          class="mterms-countdown-live-dot"
          aria-hidden="true">
        </span>

        MTERMS 2026

      </div>


      <h2 class="mterms-countdown-title">

        <span id="mtermsCountdownHeading">
          MTERMS 2026
          <span class="mterms-countdown-title-accent">
            BEGINS IN
          </span>
        </span>

      </h2>


      <div
        class="mterms-countdown-clock"
        id="mtermsCountdownClock"
        aria-live="off"
      >

        <div class="mterms-countdown-unit">

          <span
            class="mterms-countdown-number"
            id="mtermsCountdownDays">
            00
          </span>

          <span class="mterms-countdown-label">
            Days
          </span>

        </div>


        <div class="mterms-countdown-unit">

          <span
            class="mterms-countdown-number"
            id="mtermsCountdownHours">
            00
          </span>

          <span class="mterms-countdown-label">
            Hours
          </span>

        </div>


        <div class="mterms-countdown-unit">

          <span
            class="mterms-countdown-number"
            id="mtermsCountdownMinutes">
            00
          </span>

          <span class="mterms-countdown-label">
            Minutes
          </span>

        </div>


        <div class="mterms-countdown-unit">

          <span
            class="mterms-countdown-number"
            id="mtermsCountdownSeconds">
            00
          </span>

          <span class="mterms-countdown-label">
            Seconds
          </span>

        </div>

      </div>


      <div
        class="mterms-countdown-status-message"
        id="mtermsCountdownStatusMessage">
      </div>


      <div class="mterms-countdown-event">

        7–8 SEPTEMBER 2026
        &nbsp; • &nbsp;
        CONCORDE HOTEL, SHAH ALAM

      </div>


      <div class="mterms-countdown-timezone">

        <span
          class="mterms-countdown-timezone-icon"
          aria-hidden="true">
          ◷
        </span>

        Malaysia Time &nbsp;•&nbsp; UTC+8

      </div>


<div class="mterms-countdown-action">

  <a
    class="mterms-countdown-register"
    href="https://www.mterms2026.com/register.html"
    target="_blank"
    rel="noopener">

    REGISTER FOR MTERMS 2026

  </a>

</div>


<div class="mterms-countdown-participant">

  <div class="mterms-countdown-participant-label">
    Already attending MTERMS 2026?
  </div>

<div>
  <a
    class="mterms-countdown-agenda"
    href="public/mterms%20final%20schedule.pdf"
    target="_blank"
    rel="noopener">

    DOWNLOAD CONFERENCE AGENDA

  </a>
</div>

<div style="margin-top:10px;">
  <a
    class="mterms-countdown-agenda"
    href="public/List%20of%20the%20Oral%20Speakers%20MTERMS%202026.pdf"
    target="_blank"
    rel="noopener">

    LIST OF ORAL SESSIONS

  </a>

  <a
    class="mterms-countdown-agenda"
    href="public/MTERM%202026_Guideline%20for%20Symposium%20Sessionl.pdf"
    target="_blank"
    rel="noopener">

    SYMPOSIUM SESSIONS

  </a>

    <a
    class="mterms-countdown-agenda"
    href="public/List%20of%20the%20Oral%20Speakers%20MTERMS%202026.pdf"
    target="_blank"
    rel="noopener">

    LIST OF POSTER SESSIONS

  </a>
</div>

</div>

    </div>

  `;


  /* ========================================================
     INSERT COUNTDOWN DIRECTLY AFTER HERO
     ======================================================== */

  function insertCountdown() {

    const hero = document.querySelector('#home.hero');

    if (!hero) {
      console.warn(
        'MTERMS countdown: Hero section #home.hero was not found.'
      );
      return;
    }

    hero.insertAdjacentElement(
      'afterend',
      countdownSection
    );

  }


  /* ========================================================
     NUMBER ANIMATION
     ======================================================== */

  function setNumber(element, value) {

    if (!element) return;

    const formatted =
      String(value).padStart(2, '0');

    if (element.textContent !== formatted) {

      element.textContent = formatted;

      element.classList.remove('tick');

      // Restart animation
      void element.offsetWidth;

      element.classList.add('tick');

    }

  }


  /* ========================================================
     COUNTDOWN ENGINE
     ======================================================== */

  function startCountdown() {

    const daysEl =
      document.getElementById('mtermsCountdownDays');

    const hoursEl =
      document.getElementById('mtermsCountdownHours');

    const minutesEl =
      document.getElementById('mtermsCountdownMinutes');

    const secondsEl =
      document.getElementById('mtermsCountdownSeconds');

    const headingEl =
      document.getElementById('mtermsCountdownHeading');

    const statusEl =
      document.getElementById('mtermsCountdownStatusMessage');


    function updateCountdown() {

      const now = new Date();


      /* ==========================================
         BEFORE EVENT
         ========================================== */

      if (now < EVENT_START) {

        countdownSection.classList.remove(
          'event-active',
          'event-ended'
        );


        headingEl.innerHTML = `
          MTERMS 2026
          <span class="mterms-countdown-title-accent">
            BEGINS IN
          </span>
        `;


        const distance =
          EVENT_START.getTime() - now.getTime();


        const days =
          Math.floor(
            distance / (1000 * 60 * 60 * 24)
          );


        const hours =
          Math.floor(
            (distance % (1000 * 60 * 60 * 24))
            / (1000 * 60 * 60)
          );


        const minutes =
          Math.floor(
            (distance % (1000 * 60 * 60))
            / (1000 * 60)
          );


        const seconds =
          Math.floor(
            (distance % (1000 * 60))
            / 1000
          );


        setNumber(daysEl, days);
        setNumber(hoursEl, hours);
        setNumber(minutesEl, minutes);
        setNumber(secondsEl, seconds);

        return;

      }


      /* ==========================================
         EVENT IS HAPPENING
         ========================================== */

      if (
        now >= EVENT_START &&
        now <= EVENT_END
      ) {

        countdownSection.classList.remove(
          'event-ended'
        );

        countdownSection.classList.add(
          'event-active'
        );


        headingEl.innerHTML = `
          WELCOME TO
          <span class="mterms-countdown-title-accent">
            MTERMS 2026
          </span>
        `;


        /*
          Determine Malaysia calendar date.
          We use Intl with Asia/Kuala_Lumpur
          so this remains correct internationally.
        */

        const malaysiaDay =
          new Intl.DateTimeFormat(
            'en-GB',
            {
              timeZone: 'Asia/Kuala_Lumpur',
              day: '2-digit'
            }
          ).format(now);


        if (malaysiaDay === '07') {

          statusEl.innerHTML =
            'MTERMS 2026 IS<br>HAPPENING TODAY';

        } else {

          statusEl.innerHTML =
            'MTERMS 2026<br>IS NOW IN PROGRESS';

        }

        return;

      }


      /* ==========================================
         EVENT FINISHED
         ========================================== */

      countdownSection.classList.remove(
        'event-active'
      );

      countdownSection.classList.add(
        'event-ended'
      );


      headingEl.innerHTML = `
        10TH MALAYSIAN TISSUE ENGINEERING &
        REGENERATIVE MEDICINE SCIENTIFIC MEETING
      `;


      statusEl.innerHTML =
        'THANK YOU FOR BEING PART OF<br>MTERMS 2026';

    }


    /* Run immediately */

    updateCountdown();


    /* Then update every second */

    setInterval(
      updateCountdown,
      1000
    );

  }


  /* ========================================================
     INITIALISE
     ======================================================== */

  function initialiseMtermsCountdown() {

    insertCountdown();

    startCountdown();

  }


  /*
    If this script loads before the HTML finishes,
    wait for DOMContentLoaded.

    If the page is already ready,
    run immediately.
  */

  if (document.readyState === 'loading') {

    document.addEventListener(
      'DOMContentLoaded',
      initialiseMtermsCountdown
    );

  } else {

    initialiseMtermsCountdown();

  }

})();
