// server/routes/mtermsAI.js

const express = require('express');
const router = express.Router();

const GROQ_API_URL =
  'https://api.groq.com/openai/v1/chat/completions';

/*
============================================================
MTERMS 2026 — APPROVED KNOWLEDGE SOURCES

The AI is only allowed to treat these pages as authoritative
for MTERMS-specific facts.
============================================================
*/

const KNOWLEDGE_PAGES = [

  {
    name: 'MTERMS Homepage',
    url: 'https://www.mterms2026.com/index.html'
  },

  {
    name: 'Conference Theme',
    url: 'https://www.mterms2026.com/theme.html'
  },

  {
    name: 'Programme',
    url: 'https://www.mterms2026.com/program.html'
  },

  {
    name: 'Workshop',
    url: 'https://www.mterms2026.com/workshop.html'
  },

  {
    name: 'Speakers',
    url: 'https://www.mterms2026.com/speaker.html'
  },

  {
    name: 'Venue',
    url: 'https://www.mterms2026.com/venue.html'
  },

  {
    name: 'Registration',
    url: 'https://www.mterms2026.com/register.html'
  },

  {
    name: 'Important Deadlines',
    url: 'https://www.mterms2026.com/deadlines.html'
  },

  {
    name: 'Publication',
    url: 'https://www.mterms2026.com/publication.html'
  },

  {
    name: 'Sponsors',
    url: 'https://www.mterms2026.com/sponsors.html'
  },

  {
    name: 'Committee',
    url: 'https://www.mterms2026.com/committee.html'
  },

  {
    name: 'Getting There',
    url: 'https://www.mterms2026.com/gettingthere.html'
  },

  {
    name: 'Accommodation',
    url: 'https://www.mterms2026.com/accomodation.html'
  },

  {
    name: 'Destinations',
    url: 'https://www.mterms2026.com/destinations.html'
  },

  {
    name: 'Restaurants',
    url: 'https://www.mterms2026.com/restaurants.html'
  },

  {
    name: 'Contact',
    url: 'https://www.mterms2026.com/contact.html'
  }

];


/*
============================================================
CACHE

We do NOT download the whole website every time somebody
asks a question.

Knowledge is refreshed every 10 minutes.
============================================================
*/

let knowledgeCache = {
  text: '',
  loadedAt: 0
};

const CACHE_DURATION =
  10 * 60 * 1000;


/*
============================================================
HTML CLEANER
============================================================
*/

function cleanHTML(html) {

  if (!html) return '';

  let text = html;

  // Remove scripts
  text = text.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    ' '
  );

  // Remove styles
  text = text.replace(
    /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,
    ' '
  );

  // Remove SVG
  text = text.replace(
    /<svg\b[^>]*>[\s\S]*?<\/svg>/gi,
    ' '
  );

  // Preserve some structural breaks
  text = text.replace(
    /<\/(p|div|section|article|li|h1|h2|h3|h4|tr)>/gi,
    '\n'
  );

  text = text.replace(
    /<br\s*\/?>/gi,
    '\n'
  );

  // Strip remaining HTML
  text = text.replace(
    /<[^>]+>/g,
    ' '
  );

  // Decode common entities
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');

  // Clean spacing
  text = text
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();

  return text;
}


/*
============================================================
LOAD ONE MTERMS PAGE
============================================================
*/

async function loadPage(page) {

  try {

    const response = await fetch(page.url, {
      headers: {
        'User-Agent':
          'MTERMS2026-AI-Knowledge-Agent/1.0'
      }
    });

    if (!response.ok) {

      console.warn(
        `[MTERMS AI] Could not read ${page.name}:`,
        response.status
      );

      return '';
    }

    const html =
      await response.text();

    let cleaned =
      cleanHTML(html);

    /*
    Prevent one page from consuming too many tokens.
    Programme pages can be relatively large, so we allow
    a useful amount of content.
    */

    cleaned =
      cleaned.substring(0, 10000);

    return `

==================================================
SOURCE: ${page.name}
URL: ${page.url}
==================================================

${cleaned}

`;

  } catch (error) {

    console.error(
      `[MTERMS AI] Error loading ${page.name}:`,
      error.message
    );

    return '';
  }
}


/*
============================================================
BUILD THE MTERMS KNOWLEDGE BASE
============================================================
*/

async function getMtermsKnowledge() {

  const now =
    Date.now();

  /*
  Use cached knowledge when available.
  */

  if (
    knowledgeCache.text &&
    now - knowledgeCache.loadedAt < CACHE_DURATION
  ) {

    return knowledgeCache.text;

  }


  console.log(
    '[MTERMS AI] Refreshing conference knowledge...'
  );


  /*
  Fetch pages in parallel.
  */

  const results =
    await Promise.all(
      KNOWLEDGE_PAGES.map(loadPage)
    );


  const combined =
    results
      .filter(Boolean)
      .join('\n');


  knowledgeCache = {
    text: combined,
    loadedAt: now
  };


  console.log(
    `[MTERMS AI] Knowledge refreshed: ${combined.length} characters`
  );


  return combined;
}


/*
============================================================
SYSTEM INSTRUCTIONS

This controls HOW the AI behaves.
============================================================
*/

function buildSystemPrompt(knowledge) {

  return `

You are MTERMS AI, the official digital conference assistant for
the 10th Malaysian Tissue Engineering & Regenerative Medicine
Scientific Meeting (MTERMS 2026).

MTERMS 2026 is organised by TESMA and hosted/co-hosted with UiTM.

Your role is to assist conference participants, presenters,
speakers, organisers and visitors.


============================================================
PRIMARY PURPOSE
============================================================

You specialise in:

• MTERMS 2026 programme and schedule
• Sessions and presentation times
• Keynote and plenary speakers
• Workshops
• Venue information
• Registration
• Participant information
• Important deadlines
• Oral presentations
• Poster presentations
• Author information
• Publications
• CPD information
• Travel and transportation
• Accommodation
• Nearby destinations
• Restaurants
• Sponsors
• Organising committee
• Conference contact information

You may also answer reasonable scientific questions relating to:

• tissue engineering
• regenerative medicine
• stem cells
• biomaterials
• biofabrication
• bioprinting
• organoids
• gene and cell therapies
• regenerative dentistry
• biomedical engineering
• related biomedical science


============================================================
MTERMS FACTUAL ACCURACY — VERY IMPORTANT
============================================================

For questions about MTERMS 2026:

ONLY use information contained in the approved MTERMS knowledge
provided below.

Never invent:

• speaker names
• presentation times
• session rooms
• programme details
• deadlines
• fees
• registration status
• accommodation arrangements
• CPD points
• conference policies
• presenter instructions
• transportation arrangements

If the requested MTERMS information cannot be found in the
approved knowledge, clearly say:

"I don't have confirmed information about that yet."

Then direct the participant to the most relevant official MTERMS
page or the conference secretariat where appropriate.


============================================================
UNDERSTAND NATURAL QUESTIONS
============================================================

Users do not need to use formal wording.

Understand questions such as:

"where do i go tomorrow"

"who talks after lunch"

"what time does john speak"

"im presenting tomorrow what do i need"

"anything about bioprinting"

"what should i attend"

"when should i arrive"

"where do i register"

"how do i get there"

"what happens monday morning"


Use the conversation history to understand follow-up questions.

Example:

User:
"When is Professor Mason speaking?"

Then:

"what does he research?"

"He" refers to Professor Mason.


============================================================
PROGRAMME INTELLIGENCE
============================================================

When enough programme information exists, you may reason across
the schedule.

Examples:

User:
"What sessions are related to biomaterials?"

Identify relevant sessions from the approved programme.

User:
"What should I attend if I am interested in stem cells?"

Suggest relevant MTERMS sessions based on the official programme.

User:
"What happens after lunch?"

Use the actual programme.

Never make up sessions that do not exist.


============================================================
PRESENTER ASSISTANCE
============================================================

When somebody says they are:

• an oral presenter
• a poster presenter
• a speaker
• a participant

adapt the response appropriately.

When confirmed information exists, explain relevant:

• presentation requirements
• presentation duration
• preparation
• programme timing
• venue
• arrival recommendations

Clearly distinguish between:

CONFIRMED CONFERENCE REQUIREMENTS

and

GENERAL PRACTICAL ADVICE.


============================================================
GENERAL / OFF-TOPIC QUESTIONS
============================================================

MTERMS AI is primarily a conference assistant.

If a participant asks a harmless unrelated question such as:

"how do i make a cake"

"tell me a joke"

"what movie should i watch"

DO NOT give a long detailed response.

Give a very short answer, normally no more than 1–2 sentences,
and then politely remind them that you specialise in MTERMS 2026.

Example:

"A simple cake usually starts with flour, sugar, eggs, butter and
a raising agent. I mainly specialise in helping you with MTERMS
2026 — programme, speakers, venue, presentations and conference
information."

Do not waste significant tokens on unrelated topics.


============================================================
ANSWER STYLE
============================================================

Be:

• friendly
• concise
• intelligent
• professional
• helpful
• conversational

Do not sound robotic.

Do not repeatedly say:

"According to the knowledge base..."

Simply answer naturally.

For simple questions, give simple answers.

For complicated questions, explain clearly.

Use bullet points only when they genuinely improve readability.


============================================================
LINKS
============================================================

When useful, provide the relevant official MTERMS page.

Only use URLs appearing in the approved knowledge or the official
MTERMS domain:

https://www.mterms2026.com


============================================================
APPROVED MTERMS 2026 KNOWLEDGE
============================================================

${knowledge}

============================================================
END OF APPROVED KNOWLEDGE
============================================================

`;

}


/*
============================================================
AI ENDPOINT
============================================================
*/

router.post('/', async (req, res) => {

  try {

    const {
      message,
      history
    } = req.body || {};


    /*
    Validate message
    */

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


    /*
    Prevent extremely large messages
    */

    if (message.length > 3000) {

      return res.status(400).json({
        ok: false,
        error: 'Your message is too long.'
      });

    }


    /*
    Make sure Groq is configured
    */

    if (!process.env.GROQ_API_KEY) {

      console.error(
        '[MTERMS AI] GROQ_API_KEY is missing'
      );

      return res.status(500).json({
        ok: false,
        error:
          'AI service is not configured.'
      });

    }


    /*
    Get latest MTERMS website knowledge.
    */

    const knowledge =
      await getMtermsKnowledge();


    /*
    Safe short conversation memory.
    */

    const safeHistory =
      Array.isArray(history)

        ? history
            .filter(item =>
              item &&
              ['user', 'assistant']
                .includes(item.role) &&
              typeof item.content === 'string'
            )
            .slice(-8)

        : [];


    /*
    Construct messages for Groq.
    */

    const messages = [

      {
        role: 'system',
        content:
          buildSystemPrompt(knowledge)
      },

      ...safeHistory,

      {
        role: 'user',
        content:
          message.trim()
      }

    ];


    /*
    Send request to Groq.
    */

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

          model:
            'openai/gpt-oss-20b',

          messages,

          /*
          Low temperature = less imaginative
          and more factual.
          */

          temperature: 0.15,

          max_completion_tokens: 650

        })

      });


    /*
    Read Groq response.
    */

    const data =
      await groqResponse
        .json()
        .catch(() => null);


    /*
    Handle Groq errors.
    */

    if (!groqResponse.ok) {

      console.error(
        '[MTERMS AI] Groq API error:',
        JSON.stringify(data)
      );

      return res.status(502).json({
        ok: false,
        error:
          'AI service temporarily unavailable.'
      });

    }


    /*
    Extract answer.
    */

    const answer =
      data?.choices?.[0]
        ?.message?.content
        ?.trim();


    if (!answer) {

      console.error(
        '[MTERMS AI] Empty Groq response'
      );

      return res.status(502).json({
        ok: false,
        error:
          'No AI response received.'
      });

    }


    /*
    Return response to browser.
    */

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

      error:
        'Unable to process your request right now.'

    });

  }

});


module.exports = router;
