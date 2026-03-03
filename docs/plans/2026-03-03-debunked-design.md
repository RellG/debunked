# Debunked — "Fake News" Bingo Browser Extension

## Overview

A Chrome extension that turns media literacy into a game. As users browse news sites and social media, Debunked highlights terms and logical fallacies commonly associated with misinformation, filling in a virtual Bingo card in real time. Users can share their completed cards on Twitter/X.

## Architecture: Monolith Extension + Thin Backend

The extension handles all heavy lifting (pattern matching, Bingo state, UI, image generation). A lightweight Node.js/Express backend on Railway proxies AI analysis requests to OpenRouter and serves pattern database updates.

### Extension Components (Manifest V3)

- **Content Script** — Scans visible page text against the local pattern database. Highlights matched phrases inline. Renders a floating mini-widget showing Bingo progress.
- **Service Worker** — Manages pattern DB (fetches updates every 24h from backend). Handles messaging between content script and popup. Triggers AI analysis via backend proxy.
- **Popup UI** — Full 5x5 Bingo card, pattern details, share button, settings.
- **Storage** — `chrome.storage.local` for pattern DB cache and Bingo state. `chrome.storage.sync` for user preferences.

### Backend (Railway + Node.js/Express)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/patterns` | Serves latest pattern database JSON (ETag caching) |
| `POST /api/analyze` | Proxies text to OpenRouter for AI fallacy classification |
| `GET /api/health` | Health check |

- Rate limiting per extension instance
- CORS restricted to extension origin
- OpenRouter API key stored server-side
- No database for MVP (JSON file for patterns)

## Pattern Database & Detection

### Pattern Categories

| Category | Examples | Detection |
|----------|----------|-----------|
| Fear/Urgency Language | "They don't want you to know", "Wake up!" | Regex |
| Ad Hominem | "liberal snowflake", "right-wing nut" | Keyword lists |
| Appeal to Authority | "Experts agree" (without citations) | Regex |
| False Dichotomy | "You're either with us or against us" | Phrase matching |
| Emotional Manipulation | ALL CAPS sentences, excessive punctuation | Regex + heuristics |
| Weasel Words | "Some people say", "Many believe" | Phrase matching |
| Conspiracy Markers | "Follow the money", "Do your own research" | Keyword + context |
| Clickbait Patterns | "Shocking truth", "You won't believe" | Phrase matching |
| Cherry-Picking Signals | Single stats without context | AI classification |
| Logical Fallacies | Straw man, slippery slope, whataboutism | AI classification |

### Database Format

```json
{
  "version": "1.0.0",
  "updated": "2026-03-03T00:00:00Z",
  "patterns": [
    {
      "id": "fear-001",
      "category": "fear_urgency",
      "type": "regex",
      "pattern": "they don'?t want you to (know|see|hear)",
      "severity": 3,
      "description": "Fear-based gatekeeping language",
      "bingoLabel": "\"They Don't Want You To Know\""
    }
  ]
}
```

- Local matching handles ~80% of detections
- AI classification (via OpenRouter) handles ~20% — triggered when local matching finds signals but needs deeper analysis
- Pattern DB is ~50-100KB, updated every 24 hours

## Bingo Card Mechanics

- **Card generation:** Random 5x5 grid from pattern categories per session, free center space
- **Square states:** Empty → Filled (with count badge) → part of Bingo line (highlighted)
- **Scoring:** Row/column/diagonal completion = "BINGO!" notification. Full card = "BLACKOUT!"
- **Per-page and cumulative session scores**

### Floating Mini-Widget

- Pill-shaped indicator, bottom-right corner, draggable
- Shows filled count (e.g., "7/24") and mini grid visualization
- Pulses on new detections
- Click to expand inline or open popup

### Share Feature

- Renders Bingo card to canvas → PNG image
- Opens Twitter/X compose with pre-filled text and image
- Includes site URL and "Debunked" branding

## Project Structure

```
Debunked/
├── extension/
│   ├── manifest.json
│   ├── src/
│   │   ├── content/           (scanner, highlighter, widget)
│   │   ├── popup/             (popup HTML/JS/CSS)
│   │   ├── background/        (service worker)
│   │   ├── lib/               (bingo logic, pattern manager, share utils)
│   │   └── assets/            (icons, images)
│   └── data/
│       └── patterns.json      (bundled default pattern DB)
├── backend/
│   ├── server.js
│   ├── routes/                (patterns, analyze)
│   ├── data/                  (server-side pattern DB)
│   ├── package.json
│   └── Dockerfile
└── docs/plans/
```

## Tech Stack

- **Extension:** Vanilla JS (no framework), Manifest V3
- **Backend:** Node.js + Express
- **AI:** OpenRouter free models via backend proxy
- **Image generation:** html2canvas or Canvas API
- **Deployment:** Railway (auto-deploy from GitHub)
- **Database:** JSON file (PostgreSQL later)

## Revenue Model (Future)

- Donations / non-profit grants (media literacy angle)
- Educational licenses for schools/universities
- API access to the pattern database for third-party tools

## Future Enhancements (Not in MVP)

- Admin panel for pattern CRUD
- Public API with key auth (`/api/v1/`)
- Community pattern submissions
- Firefox / Edge / Safari support
- Analytics dashboard
- Leaderboards and social features
