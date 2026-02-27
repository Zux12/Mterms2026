/* ==========================================
   MTERMS2026 AI Widget - Shared JS
   - Injects widget HTML automatically
   - Loads assets/ai-qa.js automatically if missing
   - Loads lunr.min.js automatically if missing
   ========================================== */

(function () {
  function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
      if ([...document.scripts].some(s => s.src && s.src.includes(src))) return resolve();
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Failed to load " + src));
      document.head.appendChild(s);
    });
  }

  function injectWidgetHTML() {
    if (document.getElementById("ai-widget")) return;

    const wrap = document.createElement("div");
    wrap.id = "ai-widget";
    wrap.innerHTML = `
      <div id="ai-chat-window" class="ai-window hidden">
        <div class="ai-header">
          <span>MTERMS2026 AI Assistant</span>
          <div class="ai-header-actions">
            <button id="ai-info-btn" class="ai-info-btn" type="button" aria-label="About this AI">i</button>
            <button id="ai-close-btn" aria-label="Close chat">×</button>
          </div>
        </div>

        <div id="ai-messages" class="ai-messages">
          <div class="ai-msg bot">Hi. How are you today? Ask me about the program, venue, deadlines, registration, or author guidelines.</div>
        </div>

        <div class="ai-input-area">
          <input type="text" id="ai-input" placeholder="Ask a question..." />
          <button id="ai-send-btn" aria-label="Send">➤</button>
        </div>
      </div>

      <button id="ai-toggle-btn" class="ai-toggle" aria-label="Open chat">
        <img src="public/aichatbot.png" alt="AI Chatbot" class="ai-toggle-icon">
      </button>
    `;

    document.body.appendChild(wrap);
  }

  function initBot() {
    const toggleBtn = document.getElementById('ai-toggle-btn');
    const closeBtn  = document.getElementById('ai-close-btn');
    const infoBtn   = document.getElementById('ai-info-btn');
    const windowEl  = document.getElementById('ai-chat-window');
    const inputEl   = document.getElementById('ai-input');
    const sendBtn   = document.getElementById('ai-send-btn');
    const msgsEl    = document.getElementById('ai-messages');

    if (!toggleBtn || !closeBtn || !infoBtn || !windowEl || !inputEl || !sendBtn || !msgsEl) {
      console.error("[AI BOT] Missing required elements. Widget injection may have failed.");
      return;
    }

    const faq = Array.isArray(window.MTERMS_AI_QA) ? window.MTERMS_AI_QA : [];
    if (!faq.length) {
      console.warn("[AI BOT] MTERMS_AI_QA is empty. Check assets/ai-qa.js content.");
    }

    const synonyms = [
      ["where", "venue", "location", "hotel"],
      ["when", "date", "dates", "schedule"],
      ["abstract", "poster", "submission", "submit"],
      ["register", "registration", "sign up", "signup"],
      ["deadline", "deadlines", "due date", "timeline"],
      ["fee", "fees", "payment", "pay", "cost", "price"]
    ];

    function normalizeQuery(q) {
      let s = (q || "").toLowerCase().trim();
      for (const group of synonyms) {
        if (group.some(w => s.includes(w))) s += " " + group.join(" ");
      }
      return s.replace(/\s+/g, " ");
    }

    let idx = null;
    function buildIndex() {
      if (typeof window.lunr !== "function") {
        console.warn("[AI BOT] lunr is not loaded. Bot will run in fallback mode.");
        idx = null;
        return false;
      }
      idx = window.lunr(function () {
        this.ref("id");
        this.field("title");
        this.field("text");
        this.field("tags");
        faq.forEach(d => this.add(d));
      });
      return true;
    }
    buildIndex();

    function makeLinkHtml(best) {
      const links = window.MTERMS_AI_LINKS || {};
      if (!best || !best.linkKey || !links[best.linkKey]) return "";

      const href = links[best.linkKey];
      const isPdfOrExternal = href.startsWith("http") || href.toLowerCase().endsWith(".pdf");
      const target = isPdfOrExternal ? ' target="_blank" rel="noopener"' : "";

      // Short label (no ugly long URLs)
      let label = "Open page";
      const readable = String(best.linkKey)
        .replace(/_pdf$/i, "")
        .replace(/_/g, " ")
        .replace(/\b\w/g, c => c.toUpperCase());

      label = href.toLowerCase().endsWith(".pdf") ? `${readable} (PDF)` : readable;

      return `<a class="ai-link-btn" href="${href}"${target}>${label}</a>`;
    }

    function getSmartAnswer(userQuery) {
      const raw = (userQuery || "").trim();
      const lower = raw.toLowerCase();
      const q = normalizeQuery(userQuery);

      if (["hi","hello","hey","good morning","good afternoon","good evening"].includes(lower)) {
        const greet = faq.find(x => x.id === "greeting");
        return {
          text: greet ? greet.text : "Hi. How are you today? How can I help?",
          quick: ["Program", "Venue", "Deadlines", "Registration", "Contact"]
        };
      }

      if (!idx) {
        return {
          text: "The search engine isn’t loaded yet. Please ensure lunr.min.js exists in your site. For now, ask about venue, dates, deadlines, registration, or contact.",
          quick: ["Venue", "Dates", "Deadlines", "Registration", "Contact"]
        };
      }

      if (q.length < 3) {
        return {
          text: "Tell me what you need: program, venue, deadlines, registration, or author guidelines.",
          quick: ["Program", "Venue", "Deadlines", "Registration", "Contact"]
        };
      }

      const results = idx.search(q);

      if (!results.length) {
        const off = faq.find(x => x.id === "offtopic");
        return {
          text: off ? off.text : "I can help with that. For MTERMS 2026, ask me about program, venue, deadlines, registration, or author guidelines.",
          quick: ["Program", "Venue", "Deadlines", "Registration", "Contact"]
        };
      }

      const top = results
        .slice(0, 2)
        .map(r => faq.find(d => d.id === r.ref))
        .filter(Boolean);

      if (results[0].score < 0.6) {
        return {
          text: "I’m not sure which one you meant. Choose one:",
          quick: top.map(t => t.title)
        };
      }

      const best = top[0];

      const followUps = {
        venue: ["Dates", "Registration", "Contact"],
        dates: ["Venue", "Deadlines", "Registration"],
        deadlines: ["Abstract deadline", "Registration", "Contact"],
        registration: ["Dates", "Venue", "Contact"],
        contact: ["Registration", "Deadlines", "Venue"]
      };

      const linkBtn = makeLinkHtml(best);
      return {
        html: `${best.text}${linkBtn ? `<div>${linkBtn}</div>` : ""}`,
        quick: (followUps[best.id] || ["Program","Venue","Deadlines","Registration","Contact"])
      };
    }

    function addBubble(payload, type, quickReplies = null) {
      const div = document.createElement('div');
      div.className = `ai-msg ${type}`;

      if (typeof payload === "string") {
        div.innerText = payload;
      } else if (payload && typeof payload === "object") {
        if (payload.html) div.innerHTML = payload.html;
        else div.innerText = payload.text || "";
      } else {
        div.innerText = "";
      }

      if (type === "bot" && Array.isArray(quickReplies) && quickReplies.length) {
        const wrap = document.createElement("div");
        wrap.className = "ai-quick";

        quickReplies.slice(0, 5).forEach(label => {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "ai-quick-btn";
          b.textContent = label;
          b.addEventListener("click", () => {
            inputEl.value = label;
            sendMessage();
          });
          wrap.appendChild(b);
        });

        div.appendChild(wrap);
      }

      msgsEl.appendChild(div);
      msgsEl.scrollTop = msgsEl.scrollHeight;
    }

    function sendMessage() {
      const text = inputEl.value.trim();
      if (!text) return;

      addBubble(text, 'user');
      inputEl.value = '';

      setTimeout(() => {
        const out = getSmartAnswer(text);
        addBubble(out, 'bot', out.quick);
      }, 150);
    }

    toggleBtn.addEventListener('click', () => windowEl.classList.toggle('hidden'));
    closeBtn.addEventListener('click', () => windowEl.classList.add('hidden'));

    infoBtn.addEventListener('click', () => {
      window.open('developer.html', '_blank');
    });

    sendBtn.addEventListener('click', sendMessage);
    inputEl.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });

    console.log("[AI BOT] initialized OK");
  }

  async function boot() {
    // 1) Inject widget HTML
    injectWidgetHTML();

    // 2) Ensure knowledge is loaded
    if (!window.MTERMS_AI_QA) {
      await loadScriptOnce("assets/ai-qa.js");
    }

    // 3) Ensure lunr is loaded (auto-load)
    if (typeof window.lunr !== "function") {
      try { await loadScriptOnce("lunr.min.js"); } catch (e) { /* fallback mode */ }
    }

    // 4) Init bot
    initBot();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
