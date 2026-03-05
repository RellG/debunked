const express = require('express');
const { getSystemPrompt } = require('../prompts/debunk');

const router = express.Router();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

router.post('/', async (req, res) => {
  const startTime = Date.now();
  const { content, type, url } = req.body;
  const requestId = Math.random().toString(36).slice(2, 8);

  console.log(`[${requestId}] POST /api/analyze | type=${type || 'generic'} | url=${url || 'unknown'} | content=${content?.length || 0} chars`);

  if (!content || typeof content !== 'string') {
    console.log(`[${requestId}] REJECTED: missing content`);
    return res.status(400).json({ error: 'content field is required' });
  }

  if (!OPENAI_API_KEY) {
    console.log(`[${requestId}] REJECTED: no API key configured`);
    return res.status(503).json({ error: 'AI analysis not configured' });
  }

  const contentType = type || 'generic';
  const truncated = content.slice(0, 6000);

  try {
    console.log(`[${requestId}] Calling OpenAI | model=${OPENAI_MODEL} | input=${truncated.length} chars`);

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

    const aiTime = Date.now() - startTime;

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`[${requestId}] OpenAI ERROR ${response.status} after ${aiTime}ms: ${errBody.slice(0, 200)}`);
      throw new Error(`OpenAI returned ${response.status}: ${errBody}`);
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || '{}';
    const usage = data.usage || {};

    let analysis = JSON.parse(raw);

    // Validate structure
    analysis.overallVerdict = analysis.overallVerdict || 'yellow';
    analysis.summary = analysis.summary || 'No summary available.';
    analysis.claims = Array.isArray(analysis.claims) ? analysis.claims : [];
    analysis.fallacies = Array.isArray(analysis.fallacies) ? analysis.fallacies : [];

    const totalTime = Date.now() - startTime;
    const costInput = (usage.prompt_tokens || 0) / 1_000_000 * 0.40;
    const costOutput = (usage.completion_tokens || 0) / 1_000_000 * 1.60;
    const totalCost = (costInput + costOutput).toFixed(6);

    console.log([
      `[${requestId}] SUCCESS`,
      `${totalTime}ms`,
      `model=${OPENAI_MODEL}`,
      `verdict=${analysis.overallVerdict}`,
      `claims=${analysis.claims.length}`,
      `fallacies=${analysis.fallacies.length}`,
      `tokens=${usage.prompt_tokens || '?'}in/${usage.completion_tokens || '?'}out`,
      `cost=$${totalCost}`
    ].join(' | '));

    res.json(analysis);
  } catch (err) {
    const totalTime = Date.now() - startTime;
    console.error(`[${requestId}] FAILED after ${totalTime}ms: ${err.message}`);
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
