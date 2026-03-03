const express = require('express');
const router = express.Router();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

router.post('/', async (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text field is required' });
  }

  if (!OPENROUTER_API_KEY) {
    return res.status(503).json({ error: 'AI analysis not configured' });
  }

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
          {
            role: 'system',
            content: `You are a media literacy analyst. Analyze the following text for logical fallacies and misinformation patterns. Return a JSON array of detected issues. Each item should have: "category" (one of: cherry_picking, straw_man, slippery_slope, whataboutism, false_equivalence, appeal_to_emotion, bandwagon, red_herring), "matched" (the relevant quote from the text), "description" (brief explanation of why this is a fallacy), "severity" (1-5). Return ONLY the JSON array, no other text.`
          },
          {
            role: 'user',
            content: text.slice(0, 3000)
          }
        ],
        max_tokens: 1000,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter returned ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '[]';

    let fallacies;
    try {
      fallacies = JSON.parse(content);
    } catch {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      fallacies = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    }

    res.json({ fallacies });
  } catch (err) {
    console.error('[Debunked] AI analysis error:', err.message);
    res.status(500).json({ error: 'Analysis failed', fallacies: [] });
  }
});

module.exports = router;
