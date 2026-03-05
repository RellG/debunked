# Debunked v2 — AI Debunking Agent Design

## Overview

Debunked v2 is a Chrome extension that acts as a real-time AI-powered fact-checking agent for political news, articles, social media posts, and videos. It analyzes content for factual claims, evaluates their accuracy, identifies logical fallacies, and presents results as inline highlights and a detailed sidebar panel.

This is a complete pivot from v1 (which was a gamified "Fake News Bingo" pattern matcher). The Bingo card, pattern database, and regex scanning are all removed. All intelligence is now AI-driven via the backend.

## Architecture: AI-First with Smart Content Extraction

The content script detects what type of page the user is on, extracts the relevant content using platform-specific extractors, and sends it to the Railway backend. The backend calls OpenRouter for AI analysis and returns structured claim-by-claim results. The content script renders results as inline highlights and a sidebar panel.

## Content Extraction Layer

### Platform-Specific Extractors

| Platform | Detection | Extracted Content |
|----------|-----------|-------------------|
| News articles | Domain whitelist + `<article>` tag | Headline, author, body text, date |
| Twitter/X | `twitter.com` / `x.com` URL | Tweet text, author, quoted tweets, thread |
| Reddit | `reddit.com` URL | Post title, body, top comments |
| YouTube | `youtube.com/watch` URL | Title, channel, transcript via captions API |
| Generic | Manual trigger on any page | Main content (readability heuristics) |

### Auto-Trigger Domains

Curated whitelist served from backend (updatable without extension releases):
CNN, Fox News, MSNBC, NYT, Washington Post, Breitbart, BBC, NPR, AP, Reuters, The Guardian, Politico, The Hill, Daily Wire, HuffPost, Twitter/X, Reddit, YouTube, Facebook

### Trigger Modes

- **Auto:** On whitelisted domains, analysis starts automatically on page load
- **Manual:** Click extension icon on any page to force analysis
- **Inactive:** Extension icon stays gray on irrelevant pages (shopping, etc.)

## AI Analysis Pipeline

### Flow

1. Content script extracts text → sends to service worker via `chrome.runtime.sendMessage`
2. Service worker forwards to backend `POST /api/analyze`
3. Backend sends to OpenRouter with debunking system prompt
4. AI returns structured JSON
5. Results rendered as inline highlights + sidebar

### AI Response Format

```json
{
  "overallVerdict": "yellow",
  "summary": "This article contains 3 verifiable claims. Two are accurate but one key statistic is misleading.",
  "claims": [
    {
      "id": 1,
      "text": "Unemployment dropped to 3.5% last month",
      "verdict": "true",
      "explanation": "BLS data confirms unemployment rate was 3.5% in the referenced period.",
      "originalQuote": "unemployment dropped to 3.5% last month"
    },
    {
      "id": 2,
      "text": "Crime rates have doubled since 2020",
      "verdict": "misleading",
      "explanation": "Overall crime rates increased ~15%, not doubled. Specific violent crime categories saw larger increases but the blanket claim is exaggerated.",
      "originalQuote": "crime rates have doubled since 2020"
    }
  ],
  "fallacies": [
    {
      "type": "cherry_picking",
      "explanation": "The article cites a single quarter's data while ignoring the broader trend."
    }
  ]
}
```

### Verdict Types

- `true` — Claim is accurate
- `mostly_true` — Largely accurate with minor caveats
- `misleading` — Contains truth but framed in a misleading way
- `false` — Factually incorrect
- `unverified` — Cannot be confirmed or denied with available information

### Overall Page Verdict (Traffic Light)

- **Green** — Content is mostly reliable
- **Yellow** — Mixed accuracy, needs context
- **Red** — Significant factual issues found

### Prompt Strategy

- System prompt defines AI as a nonpartisan fact-checker
- Extracts factual claims only (not opinions)
- Evaluates each against training knowledge
- Identifies logical fallacies and rhetorical manipulation
- Returns `originalQuote` for inline matching
- Content-type-aware (article vs tweet vs transcript)

## UI Design

### Inline Highlights

- Each AI-identified claim highlighted directly in page text
- Color-coded borders by verdict:
  - Green — True / Mostly true
  - Yellow — Misleading / Unverified
  - Red — False
- Hover tooltip shows verdict + brief explanation
- Click scrolls sidebar to that claim's detail

### Sidebar Panel

- Slides in from right side (320-400px wide)
- **Header:** Debunked logo + traffic light indicator + summary text
- **Claims section:** Scrollable list with quoted text, verdict badge, explanation
- **Fallacies section:** Detected logical fallacies listed below claims
- **Footer:** Powered by Debunked + feedback
- Toggle via extension icon or small edge tab

### Extension Popup

- If analysis exists: opens sidebar
- If no analysis: "Analyze This Page" button + settings link
- Settings: toggle auto-analysis, manage domain whitelist

### Icon States

- Gray — Inactive / irrelevant page
- Colored — Analysis available or in progress
- Badge — Number of issues found

## Backend

### Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/analyze` | POST | Accepts `{ content, type, url }`, returns structured debunking analysis |
| `/api/domains` | GET | Returns auto-trigger domain whitelist |
| `/api/health` | GET | Health check |

### Changes from v1

- **Remove:** `GET /api/patterns` (no more pattern DB)
- **Rework:** `POST /api/analyze` (new debunking prompt, structured output)
- **Add:** `GET /api/domains` (domain whitelist)
- **Keep:** Health endpoint, CORS, rate limiting, Express, Dockerfile

### Rate Limiting

20 requests per 15 minutes per IP (tighter than v1 since each call is more expensive).

## Project Structure

```
Debunked/
├── extension/
│   ├── manifest.json
│   ├── src/
│   │   ├── content/
│   │   │   ├── extractors/        # Platform-specific content extractors
│   │   │   │   ├── article.js
│   │   │   │   ├── twitter.js
│   │   │   │   ├── reddit.js
│   │   │   │   ├── youtube.js
│   │   │   │   └── generic.js
│   │   │   ├── detector.js        # Page type detection + auto-trigger
│   │   │   ├── highlighter.js     # Inline claim highlights
│   │   │   ├── sidebar.js         # Sidebar panel UI
│   │   │   └── content.css
│   │   ├── popup/
│   │   │   ├── popup.html
│   │   │   ├── popup.js
│   │   │   └── popup.css
│   │   ├── background/
│   │   │   └── service-worker.js
│   │   └── assets/
│   └── data/
│       └── domains.json           # Default domain whitelist
├── backend/
│   ├── server.js
│   ├── routes/
│   │   ├── analyze.js
│   │   └── domains.js
│   ├── prompts/
│   │   └── debunk.js
│   ├── package.json
│   └── Dockerfile
└── docs/plans/
```

## Removed from v1

- Pattern database (patterns.json)
- Bingo card system (bingo.js)
- Regex scanner (scanner.js)
- Floating widget pill (widget.js)
- Pattern manager (patterns.js)
- Share to X feature
- Pattern serving endpoint

## Tech Stack

- **Extension:** Vanilla JS, Chrome Manifest V3
- **Backend:** Node.js + Express
- **AI:** OpenRouter free models via backend proxy
- **Deployment:** Railway (auto-deploy from GitHub)
