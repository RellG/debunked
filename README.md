# Debunked

Debunked is a Chrome extension (Manifest V3) that provides AI-powered, claim-by-claim fact-checking for news articles, social media posts, and video content. It extracts text from the page you're reading, sends it to a backend for analysis, and highlights individual claims inline with a verdict (true, misleading, false, etc.) alongside a summary sidebar.

## How it works

```
Page load → content script extracts article/post/video-transcript text
          → background service worker sends it to the backend
          → backend calls the OpenAI API for structured claim analysis
          → results render as inline highlights + a slide-in sidebar
```

## Project structure

- `extension/` — the Chrome extension (Manifest V3, vanilla JS, no build step)
  - `src/content/` — content scripts: platform extractors, claim highlighter, sidebar UI
  - `src/background/` — service worker that proxies requests to the backend
  - `src/popup/`, `src/onboarding/`, `src/settings/` — extension UI surfaces
- `backend/` — Express API that calls OpenAI and returns structured verdicts
  - `routes/analyze.js` — `POST /api/analyze`, the main fact-checking endpoint
  - `routes/domains.js` — serves the supported-site domain whitelist
  - `routes/share.js` — shareable result links (requires a database)

## Getting started

### Backend

```bash
cd backend
npm install
cp .env.example .env   # fill in OPENAI_API_KEY (and DATABASE_URL if you want sharing/caching)
npm run dev             # http://localhost:3000
```

Environment variables:

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `OPENAI_API_KEY` | Yes | — | OpenAI API key used for claim analysis |
| `OPENAI_MODEL` | No | `gpt-4.1-mini` | Model used for analysis |
| `DATABASE_URL` | No | — | Postgres connection string; enables caching and share links when set |
| `PORT` | No | `3000` | Server port |

### Extension

No build step required.

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `extension/` directory
4. Point the extension at your backend (see extension settings) if not using the default hosted API

## License

No license has been chosen yet — all rights reserved by default until one is added.
