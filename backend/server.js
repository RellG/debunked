const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting: 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});
app.use(limiter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Placeholder route imports (uncomment when routes are implemented)
// const patternsRouter = require('./routes/patterns');
// const analyzeRouter = require('./routes/analyze');
// app.use('/api/patterns', patternsRouter);
// app.use('/api/analyze', analyzeRouter);

app.listen(PORT, () => {
  console.log(`Debunked backend running on port ${PORT}`);
});
