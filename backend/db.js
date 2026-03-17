const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS analysis_cache (
        id SERIAL PRIMARY KEY,
        url_hash VARCHAR(64) UNIQUE NOT NULL,
        url TEXT NOT NULL,
        response JSONB NOT NULL,
        content_type VARCHAR(20) NOT NULL DEFAULT 'generic',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
      );
      CREATE INDEX IF NOT EXISTS idx_cache_url_hash ON analysis_cache(url_hash);
      CREATE INDEX IF NOT EXISTS idx_cache_expires ON analysis_cache(expires_at);

      CREATE TABLE IF NOT EXISTS shared_results (
        id VARCHAR(12) PRIMARY KEY,
        url TEXT NOT NULL,
        response JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS device_usage (
        device_id VARCHAR(36) NOT NULL,
        usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
        count INTEGER NOT NULL DEFAULT 0,
        UNIQUE(device_id, usage_date)
      );
      CREATE INDEX IF NOT EXISTS idx_device_usage_lookup ON device_usage(device_id, usage_date);
    `);
    console.log('[Debunked] Database tables initialized');
  } finally {
    client.release();
  }
}

async function cleanExpiredCache() {
  try {
    const result = await pool.query('DELETE FROM analysis_cache WHERE expires_at < NOW()');
    if (result.rowCount > 0) {
      console.log(`[Debunked] Cleaned ${result.rowCount} expired cache entries`);
    }
    const usageResult = await pool.query(
      "DELETE FROM device_usage WHERE usage_date < CURRENT_DATE - INTERVAL '30 days'"
    );
    if (usageResult.rowCount > 0) {
      console.log(`[Debunked] Cleaned ${usageResult.rowCount} old device usage rows`);
    }
  } catch (err) {
    console.error('[Debunked] Cache cleanup failed:', err.message);
  }
}

module.exports = { pool, initDb, cleanExpiredCache };
