const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const analyzeRouter = require('./routes/analyze');
const domainsRouter = require('./routes/domains');
const shareRouter = require('./routes/share');
const { initDb, cleanExpiredCache } = require('./db');

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

app.get('/api/health', async (req, res) => {
  const dbStatus = process.env.DATABASE_URL ? 'connected' : 'disabled';
  res.json({ status: 'ok', version: '3.0.0', model: process.env.OPENAI_MODEL || 'gpt-4.1-mini', database: dbStatus, timestamp: new Date().toISOString() });
});

app.use('/api/analyze', analyzeRouter);
app.use('/api/domains', domainsRouter);
app.use('/api/share', shareRouter);
app.use('/share', shareRouter);

async function start() {
  if (process.env.DATABASE_URL) {
    await initDb();
    setInterval(cleanExpiredCache, 60 * 60 * 1000);
  } else {
    console.warn('[Debunked] DATABASE_URL not set — caching disabled');
  }

  app.listen(PORT, () => {
    console.log(`[Debunked v3] Backend running on port ${PORT}`);
    console.log(`[Debunked v3] Model: ${process.env.OPENAI_MODEL || 'gpt-4.1-mini'}`);
    console.log(`[Debunked v3] API key: ${process.env.OPENAI_API_KEY ? 'configured' : 'MISSING'}`);
    console.log(`[Debunked v3] Database: ${process.env.DATABASE_URL ? 'connected' : 'disabled'}`);
  });
}

start().catch(err => {
  console.error('[Debunked] Failed to start:', err);
  process.exit(1);
});
