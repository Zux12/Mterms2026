/* ============================================================
   MTERMS 2026 — AI Assistant V2
   Real AI via Groq + Heroku Backend
   Endpoint: /api/mterms-ai
   ============================================================ */

(function () {
  'use strict';

  // Prevent duplicate loading
  if (window.__MTERMS_AI_V2_LOADED__) return;
  window.__MTERMS_AI_V2_LOADED__ = true;

  const API_URL = '/api/mterms-ai';

  const conversation = [];

  /* ============================================================
     STYLES
     ============================================================ */

  const style = document.createElement('style');

  style.textContent = `
    :root {
      --mterms-ai-primary: #123b68;
      --mterms-ai-primary-dark: #09294a;
      --mterms-ai-accent: #19a7a0;
      --mterms-ai-bg: #ffffff;
      --mterms-ai-soft: #f4f7fa;
      --mterms-ai-border: #dce4eb;
      --mterms-ai-text: #17202a;
      --mterms-ai-muted: #667788;
      --mterms-ai-shadow: 0 18px 55px rgba(0,0,0,.18);
    }

    #mtermsAiV2Button {
      position: fixed;
      right: 24px;
      bottom: 24px;
      width: 64px;
      height: 64px;
      border: 0;
      border-radius: 50%;
      background:
        linear-gradient(
          135deg,
          var(--mterms-ai-primary),
          var(--mterms-ai-accent)
        );
      color: white;
      cursor: pointer;
      z-index: 999998;
      box-shadow: 0 10px 30px rgba(18,59,104,.35);
      display: flex;
      align-items: center;
      justify-content: center;
      transition:
        transform .2s ease,
        box-shadow .2s ease;
    }

    #mtermsAiV2Button:hover {
      transform: translateY(-3px) scale(1.03);
      box-shadow: 0 14px 34px rgba(18,59,104,.42);
    }

    #mtermsAiV2Button svg {
      width: 30px;
      height: 30px;
    }

    #mtermsAiV2Panel {
      position: fixed;
      right: 24px;
      bottom: 100px;
      width: min(410px, calc(100vw - 32px));
      height: min(650px, calc(100vh - 130px));
      background: var(--mterms-ai-bg);
      border: 1px solid var(--mterms-ai-border);
      border-radius: 22px;
      overflow: hidden;
      z-index: 999999;
      box-shadow: var(--mterms-ai-shadow);
      display: none;
      flex-direction: column;
      transform-origin: bottom right;
    }

    #mtermsAiV2Panel.open {
      display: flex;
      animation: mtermsAiOpen .24s ease-out;
    }

    @keyframes mtermsAiOpen {
      from {
        opacity: 0;
        transform: translateY(14px) scale(.97);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .mterms-ai-header {
      position: relative;
      padding: 18px 18px 16px;
      color: white;
      background:
        radial-gradient(
          circle at 85% 10%,
          rgba(255,255,255,.18),
          transparent 34%
        ),
        linear-gradient(
          135deg,
          var(--mterms-ai-primary-dark),
          var(--mterms-ai-primary)
        );
    }

    .mterms-ai-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .mterms-ai-brand {
      display: flex;
      align-items: center;
      gap: 11px;
      min-width: 0;
    }

    .mterms-ai-logo {
      width: 42px;
      height: 42px;
      border-radius: 13px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255,255,255,.14);
      border: 1px solid rgba(255,255,255,.18);
      flex-shrink: 0;
    }

    .mterms-ai-logo svg {
      width: 24px;
      height: 24px;
    }

    .mterms-ai-title {
      font-size: 16px;
      font-weight: 750;
      line-height: 1.2;
      letter-spacing: .1px;
    }

    .mterms-ai-subtitle {
      margin-top: 4px;
      font-size: 11px;
      opacity: .78;
    }

    .mterms-ai-close {
      border: 0;
      background: rgba(255,255,255,.11);
      color: white;
      width: 34px;
      height: 34px;
      border-radius: 10px;
      cursor: pointer;
      font-size: 21px;
      line-height: 1;
    }

    .mterms-ai-status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-top: 12px;
      padding: 5px 9px;
      border-radius: 20px;
      font-size: 10px;
      background: rgba(255,255,255,.1);
    }

    .mterms-ai-status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #6ff0a3;
      box-shadow: 0 0 0 4px rgba(111,240,163,.12);
    }

    #mtermsAiV2Messages {
      flex: 1;
      overflow-y: auto;
      padding: 18px 16px 12px;
      background:
        linear-gradient(
          180deg,
          #f7fafc 0%,
          #ffffff 35%
        );
      scroll-behavior: smooth;
    }

    .mterms-ai-message {
      display: flex;
      margin-bottom: 13px;
    }

    .mterms-ai-message.user {
      justify-content: flex-end;
    }

    .mterms-ai-bubble {
      max-width: 85%;
      padding: 11px 13px;
      border-radius: 15px;
      font-size: 13px;
      line-height: 1.52;
      word-wrap: break-word;
      white-space: pre-wrap;
    }

    .mterms-ai-message.assistant .mterms-ai-bubble {
      background: var(--mterms-ai-soft);
      border: 1px solid var(--mterms-ai-border);
      color: var(--mterms-ai-text);
      border-bottom-left-radius: 5px;
    }

    .mterms-ai-message.user .mterms-ai-bubble {
      background:
        linear-gradient(
          135deg,
          var(--mterms-ai-primary),
          #17548a
        );
      color: white;
      border-bottom-right-radius: 5px;
    }

    .mterms-ai-welcome-title {
      font-weight: 700;
      margin-bottom: 5px;
    }

    .mterms-ai-suggestions {
      padding: 0 16px 12px;
      display: flex;
      gap: 7px;
      overflow-x: auto;
      background: white;
      scrollbar-width: none;
    }

    .mterms-ai-suggestions::-webkit-scrollbar {
      display: none;
    }

    .mterms-ai-suggestion {
      flex: 0 0 auto;
      border: 1px solid var(--mterms-ai-border);
      background: white;
      color: var(--mterms-ai-primary);
      border-radius: 20px;
      padding: 8px 11px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: all .15s ease;
    }

    .mterms-ai-suggestion:hover {
      background: var(--mterms-ai-soft);
      transform: translateY(-1px);
    }

    .mterms-ai-input-area {
      border-top: 1px solid var(--mterms-ai-border);
      padding: 11px 12px 9px;
      background: white;
    }

    .mterms-ai-input-wrap {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      border: 1px solid var(--mterms-ai-border);
      background: #fff;
      border-radius: 16px;
      padding: 7px 7px 7px 12px;
      transition:
        border-color .15s ease,
        box-shadow .15s ease;
    }

    .mterms-ai-input-wrap:focus-within {
      border-color: #9fb7ca;
      box-shadow: 0 0 0 3px rgba(18,59,104,.06);
    }

    #mtermsAiV2Input {
      flex: 1;
      border: 0;
      outline: 0;
      resize: none;
      background: transparent;
      color: var(--mterms-ai-text);
      font-family: inherit;
      font-size: 13px;
      line-height: 1.4;
      max-height: 100px;
      min-height: 22px;
      padding: 4px 0;
    }

    #mtermsAiV2Send {
      width: 38px;
      height: 38px;
      border: 0;
      border-radius: 12px;
      background: var(--mterms-ai-primary);
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: opacity .15s ease;
    }

    #mtermsAiV2Send:disabled {
      opacity: .45;
      cursor: default;
    }

    #mtermsAiV2Send svg {
      width: 18px;
      height: 18px;
    }

    .mterms-ai-powered {
      padding-top: 7px;
      text-align: center;
      font-size: 9px;
      color: #8a98a5;
    }

    .mterms-ai-powered strong {
      color: #657585;
    }

    .mterms-ai-typing {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      height: 18px;
    }

    .mterms-ai-typing span {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: #708090;
      animation: mtermsTyping 1.1s infinite ease-in-out;
    }

    .mterms-ai-typing span:nth-child(2) {
      animation-delay: .15s;
    }

    .mterms-ai-typing span:nth-child(3) {
      animation-delay: .3s;
    }

    @keyframes mtermsTyping {
      0%, 60%, 100% {
        transform: translateY(0);
        opacity: .45;
      }
      30% {
        transform: translateY(-4px);
        opacity: 1;
      }
    }

    .mterms-ai-error {
      color: #9b2c2c;
    }

    @media (max-width: 600px) {
      #mtermsAiV2Button {
        right: 16px;
        bottom: 16px;
        width: 58px;
        height: 58px;
      }

      #mtermsAiV2Panel {
        right: 8px;
        left: 8px;
        bottom: 84px;
        width: auto;
        height: min(680px, calc(100vh - 100px));
        border-radius: 18px;
      }
    }
  `;

  document.head.appendChild(style);

  /* ============================================================
     UI
     ============================================================ */

  const button = document.createElement('button');
  button.id = 'mtermsAiV2Button';
  button.setAttribute('aria-label', 'Open MTERMS AI Assistant');

  button.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="1.8"
         stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 3a7 7 0 0 0-7 7v2a7 7 0 0 0 7 7h1l4 2v-4.3A7 7 0 0 0 19 12v-2a7 7 0 0 0-7-7Z"/>
      <path d="M8.5 11h.01M12 11h.01M15.5 11h.01"/>
    </svg>
  `;

  const panel = document.createElement('div');
  panel.id = 'mtermsAiV2Panel';

  panel.innerHTML = `
    <div class="mterms-ai-header">

      <div class="mterms-ai-header-row">

        <div class="mterms-ai-brand">

          <div class="mterms-ai-logo">
            <svg viewBox="0 0 24 24"
                 fill="none"
                 stroke="currentColor"
                 stroke-width="1.7"
                 stroke-linecap="round"
                 stroke-linejoin="round">
              <path d="M12 2v3"/>
              <path d="M12 19v3"/>
              <path d="M4.93 4.93l2.12 2.12"/>
              <path d="M16.95 16.95l2.12 2.12"/>
              <path d="M2 12h3"/>
              <path d="M19 12h3"/>
              <path d="M4.93 19.07l2.12-2.12"/>
              <path d="M16.95 7.05l2.12-2.12"/>
              <circle cx="12" cy="12" r="4"/>
            </svg>
          </div>

          <div>
            <div class="mterms-ai-title">
              MTERMS AI Assistant
            </div>

            <div class="mterms-ai-subtitle">
              Your conference intelligence assistant
            </div>
          </div>

        </div>

        <button
          class="mterms-ai-close"
          id="mtermsAiV2Close"
          aria-label="Close"
        >×</button>

      </div>

      <div class="mterms-ai-status">
        <span class="mterms-ai-status-dot"></span>
        AI online
      </div>

    </div>

    <div id="mtermsAiV2Messages"></div>

    <div class="mterms-ai-suggestions">

      <button class="mterms-ai-suggestion">
        What's happening today?
      </button>

      <button class="mterms-ai-suggestion">
        Where is the venue?
      </button>

      <button class="mterms-ai-suggestion">
        Tell me about the speakers
      </button>

      <button class="mterms-ai-suggestion">
        Help with presentation guidelines
      </button>

    </div>

    <div class="mterms-ai-input-area">

      <div class="mterms-ai-input-wrap">

        <textarea
          id="mtermsAiV2Input"
          rows="1"
          placeholder="Ask anything about MTERMS 2026..."
        ></textarea>

        <button id="mtermsAiV2Send" aria-label="Send message">

          <svg viewBox="0 0 24 24"
               fill="none"
               stroke="currentColor"
               stroke-width="2"
               stroke-linecap="round"
               stroke-linejoin="round">
            <path d="M22 2 11 13"/>
            <path d="m22 2-7 20-4-9-9-4Z"/>
          </svg>

        </button>

      </div>

      <div class="mterms-ai-powered">
        Powered by <strong>IgniteInno Ventures</strong>
      </div>

    </div>
  `;

  document.body.appendChild(button);
  document.body.appendChild(panel);

  const messagesEl =
    document.getElementById('mtermsAiV2Messages');

  const input =
    document.getElementById('mtermsAiV2Input');

  const sendButton =
    document.getElementById('mtermsAiV2Send');

  const closeButton =
    document.getElementById('mtermsAiV2Close');

  /* ============================================================
     WELCOME MESSAGE
     ============================================================ */

  addMessage(
    'assistant',
    `<div class="mterms-ai-welcome-title">
       Welcome to MTERMS 2026.
     </div>
     I’m your AI conference assistant. Ask me about the programme,
     speakers, venue, registration, presentations, travel or
     tissue engineering and regenerative medicine.`
  );

  /* ============================================================
     EVENTS
     ============================================================ */

  button.addEventListener('click', function () {
    panel.classList.toggle('open');

    if (panel.classList.contains('open')) {
      setTimeout(() => input.focus(), 150);
    }
  });

  closeButton.addEventListener('click', function () {
    panel.classList.remove('open');
  });

  sendButton.addEventListener('click', sendMessage);

  input.addEventListener('keydown', function (event) {
    if (
      event.key === 'Enter' &&
      !event.shiftKey
    ) {
      event.preventDefault();
      sendMessage();
    }
  });

  input.addEventListener('input', function () {
    this.style.height = 'auto';

    this.style.height =
      Math.min(this.scrollHeight, 100) + 'px';
  });

  document
    .querySelectorAll('.mterms-ai-suggestion')
    .forEach(function (item) {

      item.addEventListener('click', function () {
        input.value = item.textContent.trim();
        sendMessage();
      });

    });

  /* ============================================================
     MESSAGE FUNCTIONS
     ============================================================ */

  function addMessage(role, content, isHTML = true) {

    const wrapper = document.createElement('div');

    wrapper.className =
      `mterms-ai-message ${role}`;

    const bubble = document.createElement('div');

    bubble.className = 'mterms-ai-bubble';

    if (isHTML) {
      bubble.innerHTML = content;
    } else {
      bubble.textContent = content;
    }

    wrapper.appendChild(bubble);
    messagesEl.appendChild(wrapper);

    scrollToBottom();

    return wrapper;
  }

  function addTyping() {

    const wrapper = document.createElement('div');

    wrapper.className =
      'mterms-ai-message assistant';

    wrapper.innerHTML = `
      <div class="mterms-ai-bubble">
        <div class="mterms-ai-typing">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    `;

    messagesEl.appendChild(wrapper);

    scrollToBottom();

    return wrapper;
  }

  function scrollToBottom() {

    requestAnimationFrame(function () {
      messagesEl.scrollTop =
        messagesEl.scrollHeight;
    });
  }

  /* ============================================================
     AI REQUEST
     ============================================================ */

  async function sendMessage() {

    const message = input.value.trim();

    if (!message) return;

    input.value = '';
    input.style.height = 'auto';

    addMessage(
      'user',
      escapeHTML(message),
      true
    );

    sendButton.disabled = true;

    const typing = addTyping();

    try {

      /*
       * IMPORTANT:
       * Send existing conversation history BEFORE adding
       * the current user message.
       */

      const response = await fetch(API_URL, {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json'
        },

        body: JSON.stringify({
          message: message,
          history: conversation.slice(-8)
        })
      });

      const data = await response.json();

      typing.remove();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error || 'AI request failed.'
        );
      }

      const answer = data.answer;

      conversation.push({
        role: 'user',
        content: message
      });

      conversation.push({
        role: 'assistant',
        content: answer
      });

      addMessage(
        'assistant',
        escapeHTML(answer),
        true
      );

    } catch (error) {

      console.error(
        '[MTERMS AI]',
        error
      );

      if (typing.isConnected) {
        typing.remove();
      }

      addMessage(
        'assistant',
        `<span class="mterms-ai-error">
          I’m having difficulty connecting to the MTERMS AI service
          right now. Please try again in a moment.
        </span>`
      );

    } finally {

      sendButton.disabled = false;
      input.focus();

    }
  }

  /* ============================================================
     SECURITY
     ============================================================ */

  function escapeHTML(value) {

    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/\n/g, '<br>');

  }

  console.log(
    '[MTERMS AI V2] Real AI assistant initialized'
  );

})();
