const express = require('express');
const path = require('path');
const { nanoid } = require('nanoid');
const { pool } = require('../db');

const router = express.Router();

// POST /api/share — save analysis for sharing
router.post('/', async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Sharing not available' });
  }

  const { url, analysis } = req.body;
  if (!analysis || !analysis.claims) {
    return res.status(400).json({ error: 'analysis is required' });
  }

  try {
    const id = nanoid(10);
    await pool.query(
      'INSERT INTO shared_results (id, url, response) VALUES ($1, $2, $3)',
      [id, url || 'Unknown page', JSON.stringify(analysis)]
    );
    const shareUrl = `${req.protocol}://${req.get('host')}/share/${id}`;
    console.log(`[Share] Created ${id} for ${url}`);
    res.json({ id, shareUrl });
  } catch (err) {
    console.error('[Share] Failed:', err.message);
    res.status(500).json({ error: 'Failed to create share link' });
  }
});

// GET /share/:id — render shared result page
router.get('/:id', async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).send('Sharing not available');
  }

  try {
    const result = await pool.query(
      'SELECT url, response, created_at FROM shared_results WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send('Fact-check not found');
    }

    const { url, response, created_at } = result.rows[0];
    const analysis = typeof response === 'string' ? JSON.parse(response) : response;

    const fs = require('fs');
    const template = fs.readFileSync(path.join(__dirname, '..', 'views', 'share.html'), 'utf-8');
    const html = template
      .replace('{{URL}}', url)
      .replace('{{DATE}}', new Date(created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }))
      .replace('{{ANALYSIS_JSON}}', JSON.stringify(analysis));

    res.send(html);
  } catch (err) {
    console.error('[Share] Render failed:', err.message);
    res.status(500).send('Error loading fact-check');
  }
});

module.exports = router;
