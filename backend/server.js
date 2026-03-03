const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const patternsRouter = require('./routes/patterns');
const analyzeRouter = require('./routes/analyze');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50kb' }));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later' }
}));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/patterns', patternsRouter);
app.use('/api/analyze', analyzeRouter);

app.listen(PORT, () => {
  console.log(`[Debunked] Backend running on port ${PORT}`);
});
