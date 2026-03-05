const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const analyzeRouter = require('./routes/analyze');
const domainsRouter = require('./routes/domains');

const app = express();
const PORT = process.env.PORT || 3000;

// Railway runs behind a reverse proxy
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json({ limit: '100kb' }));

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    // Skip noisy health checks
    if (req.path === '/api/health') return;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${ms}ms`);
  });
  next();
});

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many requests, please try again later' },
  handler: (req, res) => {
    console.log(`RATE LIMITED: ${req.ip} on ${req.path}`);
    res.status(429).json({ error: 'Too many requests, please try again later' });
  }
}));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '2.0.0', model: process.env.OPENAI_MODEL || 'gpt-4.1-mini', timestamp: new Date().toISOString() });
});

app.use('/api/analyze', analyzeRouter);
app.use('/api/domains', domainsRouter);

app.listen(PORT, () => {
  console.log(`[Debunked v2] Backend running on port ${PORT}`);
  console.log(`[Debunked v2] Model: ${process.env.OPENAI_MODEL || 'gpt-4.1-mini'}`);
  console.log(`[Debunked v2] API key: ${process.env.OPENAI_API_KEY ? 'configured' : 'MISSING'}`);
});
