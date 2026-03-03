const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const router = express.Router();

router.get('/', (req, res) => {
  const dbPath = path.join(__dirname, '..', 'data', 'patterns.json');
  const data = fs.readFileSync(dbPath, 'utf-8');
  const etag = crypto.createHash('md5').update(data).digest('hex');

  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end();
  }

  res.set('ETag', etag);
  res.set('Cache-Control', 'public, max-age=3600');
  res.json(JSON.parse(data));
});

module.exports = router;
