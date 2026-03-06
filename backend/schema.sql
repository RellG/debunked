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
