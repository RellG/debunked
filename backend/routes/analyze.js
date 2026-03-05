const express = require('express');
const { getSystemPrompt } = require('../prompts/debunk');

const router = express.Router();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

router.post('/', async (req, res) => {
  const { content, type, url } = req.body;

  if (!content || typeof content !== 'string') {
    return res.status(400).json({ error: 'content field is required' });
  }

  if (!OPENAI_API_KEY) {
    return res.status(503).json({ error: 'AI analysis not configured' });
  }

  const contentType = type || 'generic';
  const truncated = content.slice(0, 6000);

  try {
    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: getSystemPrompt(contentType) },
          { role: 'user', content: `Analyze this ${contentType} content from ${url || 'unknown source'}:\n\n${truncated}` }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 2000,
        temperature: 0.2
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`OpenAI returned ${response.status}: ${errBody}`);
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || '{}';

    let analysis = JSON.parse(raw);

    // Validate structure
    analysis.overallVerdict = analysis.overallVerdict || 'yellow';
    analysis.summary = analysis.summary || 'No summary available.';
    analysis.claims = Array.isArray(analysis.claims) ? analysis.claims : [];
    analysis.fallacies = Array.isArray(analysis.fallacies) ? analysis.fallacies : [];

    res.json(analysis);
  } catch (err) {
    console.error('[Debunked] Analysis error:', err.message);
    res.status(500).json({
      error: 'Analysis failed',
      overallVerdict: 'yellow',
      summary: 'Analysis temporarily unavailable.',
      claims: [],
      fallacies: []
    });
  }
});

module.exports = router;
