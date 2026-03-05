const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const DOMAINS_PATH = path.join(__dirname, '..', 'data', 'domains.json');

router.get('/', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(DOMAINS_PATH, 'utf-8'));
    res.set('Cache-Control', 'public, max-age=86400');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load domains', domains: [] });
  }
});

module.exports = router;
