const express = require('express');

const router = express.Router();

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Keep the MTERMS knowledge here for now.
// Later we can make this much richer and pull from your programme,
// speakers, deadlines, presenter info, etc.
const MTERMS_KNOWLEDGE = `
You are the official MTERMS 2026 AI Assistant.

Conference:
MTERMS 2026

Dates:
7 and 8 September 2026

Venue:
Concorde Hotel, Shah Alam, Selangor, Malaysia.

Website:
https://www.mterms2026.com

Registration:
https://www.mterms2026.com/register.html

Important deadlines:
https://www.mterms2026.com/deadlines.html

Participant portal:
https://www.mterms2026.com/login.html

Programme:
https://www.mterms2026.com/program.html

Speakers:
https://www.mterms2026.com/speaker.html

Venue information:
https://www.mterms2026.com/venue.html

Contact:
admin@mterms2026.com

Important behaviour:
- Answer primarily about MTERMS 2026.
- Be concise, friendly and professional.
- Never invent conference information.
- If conference-specific information is not available in the supplied knowledge,
  say that you cannot confirm it.
- When relevant, direct users to the appropriate MTERMS page.
- You may answer general questions about tissue engineering,
  regenerative medicine, biomaterials, stem cells and related scientific topics.
- If the user asks something unrelated to MTERMS or science,
  answer briefly where appropriate, then gently return focus to MTERMS.
`;

router.post('/', async (req, res) => {
  try {
    const { message, history } = req.body || {};

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        ok: false,
        error: 'A message is required.'
      });
    }

    if (!process.env.GROQ_API_KEY) {
      console.error('GROQ_API_KEY is missing');

      return res.status(500).json({
        ok: false,
        error: 'AI service is not configured.'
      });
    }

    // Limit conversation history to reduce token usage.
    const safeHistory = Array.isArray(history)
      ? history
          .filter(item =>
            item &&
            ['user', 'assistant'].includes(item.role) &&
            typeof item.content === 'string'
          )
          .slice(-8)
      : [];

    const messages = [
      {
        role: 'system',
        content: MTERMS_KNOWLEDGE
      },
      ...safeHistory,
      {
        role: 'user',
        content: message.trim()
      }
    ];

    const groqResponse = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        messages,
        temperature: 0.25,
        max_completion_tokens: 500
      })
    });

    const data = await groqResponse.json().catch(() => null);

    if (!groqResponse.ok) {
      console.error('Groq API error:', data);

      return res.status(502).json({
        ok: false,
        error: 'AI service temporarily unavailable.'
      });
    }

    const answer =
      data?.choices?.[0]?.message?.content?.trim();

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

  } catch (err) {
    console.error('MTERMS AI route error:', err);

    return res.status(500).json({
      ok: false,
      error: 'Unable to process AI request.'
    });
  }
});

module.exports = router;
