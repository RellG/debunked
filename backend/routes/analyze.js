const express = require('express');
const { getSystemPrompt } = require('../prompts/debunk');

const router = express.Router();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

router.post('/', async (req, res) => {
  const { content, type, url } = req.body;

  if (!content || typeof content !== 'string') {
    return res.status(400).json({ error: 'content field is required' });
  }

  if (!OPENROUTER_API_KEY) {
    return res.status(503).json({ error: 'AI analysis not configured' });
  }

  const contentType = type || 'generic';
  const truncated = content.slice(0, 6000);

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://debunked.app',
        'X-Title': 'Debunked'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.1-8b-instruct:free',
        messages: [
          { role: 'system', content: getSystemPrompt(contentType) },
          { role: 'user', content: `Analyze this ${contentType} content from ${url || 'unknown source'}:\n\n${truncated}` }
        ],
        max_tokens: 2000,
        temperature: 0.2
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter returned ${response.status}`);
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || '{}';

    let analysis;
    try {
      analysis = JSON.parse(raw);
    } catch {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : {
        overallVerdict: 'yellow',
        summary: 'Analysis could not be fully parsed.',
        claims: [],
        fallacies: []
      };
    }

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
