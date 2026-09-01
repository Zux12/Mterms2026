// server/routes/mtermsAI.js

const express = require('express');
const router = express.Router();

const GROQ_API_URL =
  'https://api.groq.com/openai/v1/chat/completions';

const KNOWLEDGE_PAGES = [
  { name: 'Homepage', url: 'https://www.mterms2026.com/index.html' },
  { name: 'Theme', url: 'https://www.mterms2026.com/theme.html' },
  { name: 'Programme', url: 'https://www.mterms2026.com/program.html' },
  { name: 'Workshop', url: 'https://www.mterms2026.com/workshop.html' },
  { name: 'Speakers', url: 'https://www.mterms2026.com/speaker.html' },
  { name: 'Venue', url: 'https://www.mterms2026.com/venue.html' },
  { name: 'Registration', url: 'https://www.mterms2026.com/register.html' },
  { name: 'Deadlines', url: 'https://www.mterms2026.com/deadlines.html' },
  { name: 'Publication', url: 'https://www.mterms2026.com/publication.html' },
  { name: 'Sponsors', url: 'https://www.mterms2026.com/sponsors.html' },
  { name: 'Committee', url: 'https://www.mterms2026.com/committee.html' },
  { name: 'Getting There', url: 'https://www.mterms2026.com/gettingthere.html' },
  { name: 'Accommodation', url: 'https://www.mterms2026.com/accomodation.html' },
  { name: 'Destinations', url: 'https://www.mterms2026.com/destinations.html' },
  { name: 'Restaurants', url: 'https://www.mterms2026.com/restaurants.html' },
  { name: 'Contact', url: 'https://www.mterms2026.com/contact.html' }
];

let pageCache = {};
const CACHE_DURATION = 10 * 60 * 1000;


/* =========================================================
   CLEAN HTML
   ========================================================= */

function cleanHTML(html) {
  if (!html) return '';

  let text = html;

  text = text.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  text = text.replace(/<svg[\s\S]*?<\/svg>/gi, ' ');

  text = text.replace(
    /<\/(p|div|section|article|li|h1|h2|h3|h4|tr|td)>/gi,
    '\n'
  );

  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<[^>]+>/g, ' ');

  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');

  text = text
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();

  return text;
}


/* =========================================================
   LOAD PAGE WITH CACHE
   ========================================================= */

async function loadPage(page) {
  const now = Date.now();

  const cached = pageCache[page.url];

  if (
    cached &&
    now - cached.loadedAt < CACHE_DURATION
  ) {
    return cached.text;
  }

  try {
    const response = await fetch(page.url, {
      headers: {
        'User-Agent': 'MTERMS2026-AI/1.0'
      }
    });

    if (!response.ok) {
      console.warn(
        `[MTERMS AI] Failed to load ${page.name}:`,
        response.status
      );
      return '';
    }

    const html = await response.text();
    const text = cleanHTML(html);

    pageCache[page.url] = {
      text,
      loadedAt: now
    };

    return text;

  } catch (error) {
    console.error(
      `[MTERMS AI] Error loading ${page.name}:`,
      error.message
    );

    return '';
  }
}


/* =========================================================
   SIMPLE RELEVANCE SCORING
   ========================================================= */

function scorePage(question, page, content) {
  const q = question.toLowerCase();

  const words = q
    .split(/[^a-z0-9]+/i)
    .filter(word => word.length >= 3);

  let score = 0;

  const pageName = page.name.toLowerCase();

  for (const word of words) {
    if (pageName.includes(word)) {
      score += 8;
    }

    if (content.toLowerCase().includes(word)) {
      score += 1;
    }
  }

  /*
   Extra semantic routing rules
  */

  if (/speaker|keynote|plenary|professor|dr\b|who is|who speaks/i.test(q)) {
    if (page.name === 'Speakers') score += 20;
    if (page.name === 'Programme') score += 10;
  }

  if (/program|programme|agenda|schedule|session|time|morning|afternoon|lunch|today|tomorrow/i.test(q)) {
    if (page.name === 'Programme') score += 25;
  }

  if (/venue|where|hotel|concorde|location|room/i.test(q)) {
    if (page.name === 'Venue') score += 25;
  }

  if (/register|registration|fee|payment|login/i.test(q)) {
    if (page.name === 'Registration') score += 25;
  }

  if (/deadline|submission|abstract|due date/i.test(q)) {
    if (page.name === 'Deadlines') score += 25;
  }

  if (/workshop/i.test(q)) {
    if (page.name === 'Workshop') score += 25;
  }

  if (/publish|publication|paper|journal/i.test(q)) {
    if (page.name === 'Publication') score += 25;
  }

  if (/travel|transport|airport|grab|train|drive|getting there/i.test(q)) {
    if (page.name === 'Getting There') score += 25;
  }

  if (/hotel|accommodation|stay/i.test(q)) {
    if (page.name === 'Accommodation') score += 20;
  }

  if (/food|restaurant|eat|makan/i.test(q)) {
    if (page.name === 'Restaurants') score += 25;
  }

  if (/contact|email|secretariat|help/i.test(q)) {
    if (page.name === 'Contact') score += 25;
  }

  return score;
}


/* =========================================================
   SMART TEXT CHUNKING
   ========================================================= */

function createChunks(text, chunkSize = 1400) {
  if (!text) return [];

  /*
   Split primarily around paragraphs/lines.
  */
  const paragraphs = text
    .split(/\n+/)
    .map(x => x.trim())
    .filter(Boolean);

  const chunks = [];

  let current = '';

  for (const paragraph of paragraphs) {

    if (
      current.length + paragraph.length >
      chunkSize
    ) {

      if (current.trim()) {
        chunks.push(current.trim());
      }

      current = paragraph;

    } else {

      current +=
        (current ? '\n' : '') +
        paragraph;

    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}


/* =========================================================
   NORMALISE WORDS
   ========================================================= */

function getQuestionWords(question) {

  const stopWords = new Set([
    'the',
    'and',
    'are',
    'who',
    'what',
    'when',
    'where',
    'which',
    'how',
    'does',
    'this',
    'that',
    'with',
    'from',
    'have',
    'about',
    'should',
    'would',
    'could',
    'tell',
    'please',
    'mterms',
    '2026'
  ]);

  return question
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(word =>
      word.length >= 3 &&
      !stopWords.has(word)
    );
}


/* =========================================================
   SCORE INDIVIDUAL CHUNKS
   ========================================================= */

function scoreChunk(
  question,
  page,
  chunk
) {

  const q =
    question.toLowerCase();

  const lowerChunk =
    chunk.toLowerCase();

  const words =
    getQuestionWords(question);

  let score = 0;


  /*
   Keyword matches
  */

  for (const word of words) {

    const occurrences =
      lowerChunk.split(word).length - 1;

    score +=
      occurrences * 3;

  }


  /*
   Exact phrase bonus
  */

  const meaningfulPhrase =
    words.join(' ');

  if (
    meaningfulPhrase.length > 4 &&
    lowerChunk.includes(meaningfulPhrase)
  ) {

    score += 20;

  }


  /*
   SPEAKERS
  */

  if (
    /speaker|speakers|keynote|plenary|professor|prof\b|dr\b|who is|who are/i.test(q)
  ) {

    if (
      /speaker|keynote|plenary|professor|prof\b|dr\b/i.test(lowerChunk)
    ) {
      score += 25;
    }

    if (page.name === 'Speakers') {
      score += 15;
    }

    if (page.name === 'Homepage') {
      score += 8;
    }

  }


  /*
   PROGRAMME
  */

  if (
    /program|programme|agenda|schedule|session|morning|afternoon|lunch|today|tomorrow|time|7 september|8 september/i.test(q)
  ) {

    if (page.name === 'Programme') {
      score += 25;
    }

    if (
      /session|programme|program|am|pm|september/i.test(lowerChunk)
    ) {
      score += 10;
    }

  }


  /*
   VENUE
  */

  if (
    /venue|where|location|concorde|hotel|room|hall/i.test(q)
  ) {

    if (page.name === 'Venue') {
      score += 30;
    }

    if (
      /concorde|shah alam|venue|hotel/i.test(lowerChunk)
    ) {
      score += 15;
    }

  }


  /*
   REGISTRATION
  */

  if (
    /register|registration|fee|fees|payment|price|cost/i.test(q)
  ) {

    if (page.name === 'Registration') {
      score += 30;
    }

  }


  /*
   DEADLINES / ABSTRACTS
  */

  if (
    /deadline|abstract|submission|submit|due date/i.test(q)
  ) {

    if (page.name === 'Deadlines') {
      score += 30;
    }

  }


  /*
   WORKSHOP
  */

  if (/workshop/i.test(q)) {

    if (page.name === 'Workshop') {
      score += 30;
    }

  }


  /*
   PUBLICATION
  */

  if (
    /publication|publish|journal|paper|manuscript/i.test(q)
  ) {

    if (page.name === 'Publication') {
      score += 30;
    }

  }


  /*
   TRAVEL
  */

  if (
    /travel|airport|grab|train|transport|drive|getting there/i.test(q)
  ) {

    if (page.name === 'Getting There') {
      score += 30;
    }

  }


  /*
   ACCOMMODATION
  */

  if (
    /accommodation|stay|nearby hotel/i.test(q)
  ) {

    if (page.name === 'Accommodation') {
      score += 30;
    }

  }


  /*
   RESTAURANTS
  */

  if (
    /restaurant|food|eat|makan|dinner|lunch place/i.test(q)
  ) {

    if (page.name === 'Restaurants') {
      score += 30;
    }

  }


  /*
   CONTACT
  */

  if (
    /contact|email|secretariat|organiser|organizer/i.test(q)
  ) {

    if (page.name === 'Contact') {
      score += 30;
    }

  }


  return score;
}


/* =========================================================
   SMART KNOWLEDGE RETRIEVAL
   ========================================================= */

async function getRelevantKnowledge(question) {

  const candidates = [];


  /*
   Load every approved page from cache / website.
  */

  for (const page of KNOWLEDGE_PAGES) {

    const content =
      await loadPage(page);

    if (!content) continue;


    /*
     Break page into smaller meaningful sections.
    */

    const chunks =
      createChunks(content);


    chunks.forEach((chunk, index) => {

      candidates.push({

        pageName:
          page.name,

        url:
          page.url,

        chunkIndex:
          index,

        text:
          chunk,

        score:
          scoreChunk(
            question,
            page,
            chunk
          )

      });

    });

  }


  /*
   Highest relevance first.
  */

  candidates.sort(
    (a, b) =>
      b.score - a.score
  );


  /*
   Take the best 5 sections from anywhere
   on the MTERMS website.
  */

  const selected =
    candidates
      .filter(item => item.score > 0)
      .slice(0, 5);


  /*
   Fallback if question has no obvious match.
  */

  if (!selected.length) {

    const homepage =
      candidates.filter(
        item =>
          item.pageName === 'Homepage'
      );

    selected.push(
      ...homepage.slice(0, 2)
    );

  }


  const knowledge =
    selected
      .map(item => `

========================================
SOURCE: ${item.pageName}
URL: ${item.url}
RELEVANCE SCORE: ${item.score}
========================================

${item.text}

`)
      .join('\n');


  console.log(
    '[MTERMS AI] Retrieved:',
    selected
      .map(item =>
        `${item.pageName}#${item.chunkIndex}(${item.score})`
      )
      .join(', ')
  );


  console.log(
    '[MTERMS AI] Knowledge chars:',
    knowledge.length
  );


  return knowledge;
}


/* =========================================================
   SYSTEM PROMPT
   ========================================================= */

function buildSystemPrompt(knowledge) {
  return `

  CURRENT DATE AND TIME CONTEXT:

The current date is ${new Date().toLocaleDateString('en-MY', {
  timeZone: 'Asia/Kuala_Lumpur',
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric'
})}.

The current time in Malaysia is ${new Date().toLocaleTimeString('en-MY', {
  timeZone: 'Asia/Kuala_Lumpur',
  hour: '2-digit',
  minute: '2-digit'
})}.

MTERMS 2026 conference dates are:
7 September 2026 and 8 September 2026.

CHAT DISPLAY FORMATTING:

The user is reading responses inside a narrow mobile-friendly chat window.

Never use Markdown tables.

Do not format information using pipe characters such as:
| Time | Session |

Instead, present schedules and comparisons as short readable lists.

Example:

9:00 AM — Opening Ceremony
10:00 AM — Keynote Address
11:00 AM — Plenary Session

Use short paragraphs and bullet points where helpful.

Markdown bold using **text** is allowed.
Keep answers compact and easy to scan on a phone.

IMPORTANT:
When the user says "today", "tomorrow", "yesterday", "this morning",
"this afternoon", or "tonight", interpret those words using the
current Malaysia date and time above.

Never describe 7 September 2026 as "today" unless the actual
current Malaysia date is 7 September 2026.

Never describe 8 September 2026 as "today" unless the actual
current Malaysia date is 8 September 2026.

If today is before 7 September 2026, the conference has not started yet.

If today is 7 September 2026, it is Day 1.

If today is 8 September 2026, it is Day 2.

If today is after 8 September 2026, the conference has ended.

You are MTERMS AI, the official AI assistant for MTERMS 2026.

You help participants with:
- programme and session schedules
- speakers
- workshops
- venue
- registration
- deadlines
- presentation information
- travel
- accommodation
- restaurants
- publication
- committee and contacts
- related tissue engineering and regenerative medicine topics

IMPORTANT RULES:

1. For MTERMS-specific factual information, only use the approved knowledge below.

2. Never invent:
- programme times
- speaker details
- venue details
- fees
- deadlines
- presentation requirements
- CPD information
- conference policies

3. If the requested conference information is not present, say:
"I don't have confirmed information about that yet."

4. For harmless unrelated questions, answer very briefly in 1–2 sentences, then remind the user that you mainly assist with MTERMS 2026.

5. Be concise, friendly, professional, and conversational.

6. Use previous conversation context to understand follow-up questions.

7. When helpful, direct users to official MTERMS pages.

APPROVED MTERMS KNOWLEDGE:

${knowledge}

END OF APPROVED KNOWLEDGE.
`;
}


/* =========================================================
   ROUTE
   ========================================================= */

router.post('/', async (req, res) => {
  try {
    const {
      message,
      history
    } = req.body || {};

    if (
      !message ||
      typeof message !== 'string' ||
      !message.trim()
    ) {
      return res.status(400).json({
        ok: false,
        error: 'A message is required.'
      });
    }

    if (message.length > 3000) {
      return res.status(400).json({
        ok: false,
        error: 'Your message is too long.'
      });
    }

    if (!process.env.GROQ_API_KEY) {
      console.error('[MTERMS AI] GROQ_API_KEY missing');

      return res.status(500).json({
        ok: false,
        error: 'AI service is not configured.'
      });
    }

    const knowledge =
      await getRelevantKnowledge(message);

    const safeHistory =
      Array.isArray(history)
        ? history
            .filter(item =>
              item &&
              ['user', 'assistant'].includes(item.role) &&
              typeof item.content === 'string'
            )
            .slice(-6)
        : [];

    const messages = [
      {
        role: 'system',
        content: buildSystemPrompt(knowledge)
      },
      ...safeHistory,
      {
        role: 'user',
        content: message.trim()
      }
    ];

    const groqResponse =
      await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization':
            `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type':
            'application/json'
        },
        body: JSON.stringify({
          model: 'openai/gpt-oss-20b',
          messages,
          temperature: 0.15,
          max_completion_tokens: 500
        })
      });

    const data =
      await groqResponse
        .json()
        .catch(() => null);

    if (!groqResponse.ok) {
      console.error(
        '[MTERMS AI] Groq API error:',
        JSON.stringify(data)
      );

      return res.status(502).json({
        ok: false,
        error: 'AI service temporarily unavailable.'
      });
    }

    const answer =
      data?.choices?.[0]
        ?.message?.content
        ?.trim();

    if (!answer) {
      return res.status(502).json({
        ok: false,
        error: 'No AI response received.'
      });
    }

    return res.json({
      ok: true,
      answer
    });

  } catch (error) {
    console.error(
      '[MTERMS AI] Route error:',
      error
    );

    return res.status(500).json({
      ok: false,
      error: 'Unable to process your request.'
    });
  }
});

module.exports = router;
