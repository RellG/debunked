# Debunked v2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild Debunked as an AI-powered debunking agent that analyzes political content across news sites, social media, and YouTube, presenting inline claim highlights and a sidebar analysis panel.

**Architecture:** Content scripts detect page type and extract text using platform-specific extractors. The backend proxies content to OpenRouter for AI analysis and returns structured claim-by-claim verdicts. Results are rendered as color-coded inline highlights and a slide-in sidebar panel.

**Tech Stack:** Vanilla JS (Chrome Manifest V3), Node.js/Express backend, OpenRouter AI, Railway deployment

---

### Task 1: Clean Up v1 Files & Update Manifest

**Files:**
- Delete: `extension/data/patterns.json`
- Delete: `extension/src/lib/patterns.js`
- Delete: `extension/src/lib/bingo.js`
- Delete: `extension/src/content/scanner.js`
- Delete: `extension/src/content/widget.js`
- Delete: `extension/src/content/highlighter.js`
- Delete: `extension/src/content/content.css`
- Delete: `extension/src/popup/popup.js`
- Delete: `extension/src/popup/popup.css`
- Delete: `extension/src/popup/popup.html`
- Delete: `backend/routes/patterns.js`
- Delete: `backend/data/patterns.json`
- Modify: `extension/manifest.json`
- Create: `extension/data/domains.json`

**Step 1: Delete all v1-specific files**

```bash
rm extension/data/patterns.json
rm extension/src/lib/patterns.js
rm extension/src/lib/bingo.js
rm extension/src/content/scanner.js
rm extension/src/content/widget.js
rm extension/src/content/highlighter.js
rm extension/src/content/content.css
rm extension/src/popup/popup.js
rm extension/src/popup/popup.css
rm extension/src/popup/popup.html
rm backend/routes/patterns.js
rm backend/data/patterns.json
```

**Step 2: Create domains.json**

```json
{
  "version": "1.0.0",
  "domains": [
    "cnn.com",
    "foxnews.com",
    "msnbc.com",
    "nytimes.com",
    "washingtonpost.com",
    "breitbart.com",
    "bbc.com",
    "bbc.co.uk",
    "npr.org",
    "apnews.com",
    "reuters.com",
    "theguardian.com",
    "politico.com",
    "thehill.com",
    "dailywire.com",
    "huffpost.com",
    "twitter.com",
    "x.com",
    "reddit.com",
    "youtube.com",
    "facebook.com",
    "nbcnews.com",
    "abcnews.go.com",
    "cbsnews.com",
    "usatoday.com",
    "nypost.com",
    "axios.com",
    "thedailybeast.com",
    "salon.com",
    "slate.com",
    "vox.com",
    "theintercept.com",
    "newsmax.com",
    "oann.com",
    "infowars.com"
  ]
}
```

**Step 3: Rewrite manifest.json**

```json
{
  "manifest_version": 3,
  "name": "Debunked",
  "version": "2.0.0",
  "description": "AI-powered fact-checking for political news, social media, and videos.",
  "permissions": ["storage", "activeTab", "alarms"],
  "host_permissions": ["https://debunked-production.up.railway.app/*"],
  "action": {
    "default_popup": "src/popup/popup.html",
    "default_icon": {
      "16": "src/assets/icon16.png",
      "48": "src/assets/icon48.png",
      "128": "src/assets/icon128.png"
    }
  },
  "background": {
    "service_worker": "src/background/service-worker.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": [
        "src/content/extractors/article.js",
        "src/content/extractors/twitter.js",
        "src/content/extractors/reddit.js",
        "src/content/extractors/youtube.js",
        "src/content/extractors/generic.js",
        "src/content/detector.js",
        "src/content/highlighter.js",
        "src/content/sidebar.js"
      ],
      "css": ["src/content/content.css"],
      "run_at": "document_idle"
    }
  ],
  "web_accessible_resources": [
    {
      "resources": ["data/domains.json"],
      "matches": ["<all_urls>"]
    }
  ],
  "icons": {
    "16": "src/assets/icon16.png",
    "48": "src/assets/icon48.png",
    "128": "src/assets/icon128.png"
  }
}
```

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: remove v1 files and update manifest for v2"
```

---

### Task 2: Backend — Debunking Prompt & Analyze Route

**Files:**
- Create: `backend/prompts/debunk.js`
- Rewrite: `backend/routes/analyze.js`
- Create: `backend/routes/domains.js`
- Modify: `backend/server.js`

**Step 1: Create the debunking prompt module**

Create `backend/prompts/debunk.js`:

```javascript
function getSystemPrompt(contentType) {
  const typeContext = {
    article: 'a news article',
    tweet: 'a social media post from Twitter/X',
    reddit: 'a Reddit post and its comments',
    youtube: 'a YouTube video transcript',
    generic: 'web content'
  };

  const context = typeContext[contentType] || typeContext.generic;

  return `You are a nonpartisan, rigorous fact-checker analyzing ${context}. Your job is to:

1. IDENTIFY all verifiable factual claims (ignore opinions, predictions, and subjective statements)
2. EVALUATE each claim's accuracy based on your knowledge
3. DETECT logical fallacies and rhetorical manipulation tactics
4. PROVIDE an overall credibility assessment

For each claim, you MUST include the "originalQuote" field containing the EXACT text from the source that contains the claim. This is critical for highlighting in the UI.

Respond with ONLY valid JSON in this exact format:
{
  "overallVerdict": "green|yellow|red",
  "summary": "1-2 sentence overall assessment",
  "claims": [
    {
      "id": 1,
      "text": "The claim restated clearly",
      "verdict": "true|mostly_true|misleading|false|unverified",
      "explanation": "1-2 sentence explanation of why this verdict was given",
      "originalQuote": "exact quote from source text"
    }
  ],
  "fallacies": [
    {
      "type": "fallacy_name",
      "explanation": "Brief explanation of how this fallacy appears in the content"
    }
  ]
}

Rules:
- Be balanced and nonpartisan. Apply the same standard regardless of political leaning.
- Only flag verifiable factual claims, not opinions or editorial positions.
- "originalQuote" must be a verbatim substring from the provided text.
- If no factual claims are found, return an empty claims array with overallVerdict "green".
- Limit to the 10 most significant claims if there are many.
- For the overallVerdict: "green" = mostly accurate, "yellow" = mixed or needs context, "red" = significant factual issues.`;
}

module.exports = { getSystemPrompt };
```

**Step 2: Rewrite the analyze route**

Rewrite `backend/routes/analyze.js`:

```javascript
const express = require('express');
const { getSystemPrompt } = require('../prompts/debunk');

const router = express.Router();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

router.post('/', async (req, res) => {
  const { content, type, url } = req.body;

  if (!content || typeof content !== 'string') {
    return res.status(400).json({ error: 'content field is required' });
  }

  if (!OPENROUTER_API_KEY) {
    return res.status(503).json({ error: 'AI analysis not configured' });
  }

  const contentType = type || 'generic';
  const truncated = content.slice(0, 6000);

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://debunked.app',
        'X-Title': 'Debunked'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.1-8b-instruct:free',
        messages: [
          { role: 'system', content: getSystemPrompt(contentType) },
          { role: 'user', content: `Analyze this ${contentType} content from ${url || 'unknown source'}:\n\n${truncated}` }
        ],
        max_tokens: 2000,
        temperature: 0.2
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter returned ${response.status}`);
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || '{}';

    let analysis;
    try {
      analysis = JSON.parse(raw);
    } catch {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : {
        overallVerdict: 'yellow',
        summary: 'Analysis could not be fully parsed.',
        claims: [],
        fallacies: []
      };
    }

    // Validate structure
    analysis.overallVerdict = analysis.overallVerdict || 'yellow';
    analysis.summary = analysis.summary || 'No summary available.';
    analysis.claims = Array.isArray(analysis.claims) ? analysis.claims : [];
    analysis.fallacies = Array.isArray(analysis.fallacies) ? analysis.fallacies : [];

    res.json(analysis);
  } catch (err) {
    console.error('[Debunked] Analysis error:', err.message);
    res.status(500).json({
      error: 'Analysis failed',
      overallVerdict: 'yellow',
      summary: 'Analysis temporarily unavailable.',
      claims: [],
      fallacies: []
    });
  }
});

module.exports = router;
```

**Step 3: Create the domains route**

Create `backend/routes/domains.js`:

```javascript
const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Serve a domain whitelist — for now read from a static file
// Future: move to a database for dynamic updates
const DOMAINS_PATH = path.join(__dirname, '..', 'data', 'domains.json');

router.get('/', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(DOMAINS_PATH, 'utf-8'));
    res.set('Cache-Control', 'public, max-age=86400');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load domains', domains: [] });
  }
});

module.exports = router;
```

**Step 4: Create backend/data/domains.json**

Copy the same domains list from `extension/data/domains.json` to `backend/data/domains.json`.

**Step 5: Update server.js**

Replace `backend/server.js`:

```javascript
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const analyzeRouter = require('./routes/analyze');
const domainsRouter = require('./routes/domains');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '100kb' }));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many requests, please try again later' }
}));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '2.0.0', timestamp: new Date().toISOString() });
});

app.use('/api/analyze', analyzeRouter);
app.use('/api/domains', domainsRouter);

app.listen(PORT, () => {
  console.log(`[Debunked v2] Backend running on port ${PORT}`);
});
```

**Step 6: Commit**

```bash
git add backend/ extension/data/domains.json
git commit -m "feat: add v2 backend with debunking prompt, analyze route, and domains endpoint"
```

---

### Task 3: Content Extractors

**Files:**
- Create: `extension/src/content/extractors/article.js`
- Create: `extension/src/content/extractors/twitter.js`
- Create: `extension/src/content/extractors/reddit.js`
- Create: `extension/src/content/extractors/youtube.js`
- Create: `extension/src/content/extractors/generic.js`

**Step 1: Create article extractor**

```javascript
window.Debunked = window.Debunked || {};
window.Debunked.Extractors = window.Debunked.Extractors || {};

window.Debunked.Extractors.article = {
  canExtract() {
    return !!document.querySelector('article') ||
           !!document.querySelector('[role="article"]') ||
           !!document.querySelector('.article-body, .story-body, .post-content');
  },

  extract() {
    const article = document.querySelector('article') ||
                    document.querySelector('[role="article"]') ||
                    document.querySelector('.article-body, .story-body, .post-content');

    if (!article) return null;

    const headline = document.querySelector('h1')?.textContent?.trim() || '';
    const author = document.querySelector('[rel="author"], .author, .byline, meta[name="author"]');
    const authorText = author?.textContent?.trim() || author?.getAttribute('content') || '';
    const dateEl = document.querySelector('time, [datetime], .publish-date, .date');
    const date = dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim() || '';

    // Get article text, removing scripts/styles/nav
    const clone = article.cloneNode(true);
    clone.querySelectorAll('script, style, nav, aside, .ad, .advertisement, .social-share, figure, figcaption').forEach(el => el.remove());
    const body = clone.textContent?.trim() || '';

    if (body.length < 100) return null;

    return {
      type: 'article',
      headline,
      author: authorText,
      date,
      content: `${headline}\n\nBy ${authorText}\n${date}\n\n${body}`.slice(0, 6000)
    };
  }
};
```

**Step 2: Create Twitter/X extractor**

```javascript
window.Debunked = window.Debunked || {};
window.Debunked.Extractors = window.Debunked.Extractors || {};

window.Debunked.Extractors.twitter = {
  canExtract() {
    const host = window.location.hostname;
    return host === 'twitter.com' || host === 'x.com' || host.endsWith('.twitter.com') || host.endsWith('.x.com');
  },

  extract() {
    const tweets = [];

    // Get tweet text elements
    const tweetEls = document.querySelectorAll('[data-testid="tweetText"]');
    tweetEls.forEach(el => {
      const text = el.textContent?.trim();
      if (text) tweets.push(text);
    });

    // Get the author
    const authorEl = document.querySelector('[data-testid="User-Name"]');
    const author = authorEl?.textContent?.trim() || '';

    if (tweets.length === 0) return null;

    return {
      type: 'tweet',
      author,
      content: tweets.join('\n\n---\n\n').slice(0, 6000)
    };
  }
};
```

**Step 3: Create Reddit extractor**

```javascript
window.Debunked = window.Debunked || {};
window.Debunked.Extractors = window.Debunked.Extractors || {};

window.Debunked.Extractors.reddit = {
  canExtract() {
    return window.location.hostname.includes('reddit.com');
  },

  extract() {
    // Post title
    const titleEl = document.querySelector('h1, [data-testid="post-title"], shreddit-post');
    const title = titleEl?.textContent?.trim() || '';

    // Post body
    const bodyEl = document.querySelector('[data-testid="post-content"], .RichTextJSON-root, [slot="text-body"]');
    const body = bodyEl?.textContent?.trim() || '';

    // Top comments
    const commentEls = document.querySelectorAll('[data-testid="comment"] p, .Comment .RichTextJSON-root, shreddit-comment');
    const comments = [];
    commentEls.forEach((el, i) => {
      if (i < 10) {
        const text = el.textContent?.trim();
        if (text && text.length > 20) comments.push(text);
      }
    });

    if (!title && !body) return null;

    const parts = [`Title: ${title}`];
    if (body) parts.push(`Post: ${body}`);
    if (comments.length > 0) parts.push(`Top comments:\n${comments.join('\n\n')}`);

    return {
      type: 'reddit',
      content: parts.join('\n\n').slice(0, 6000)
    };
  }
};
```

**Step 4: Create YouTube extractor**

```javascript
window.Debunked = window.Debunked || {};
window.Debunked.Extractors = window.Debunked.Extractors || {};

window.Debunked.Extractors.youtube = {
  canExtract() {
    return window.location.hostname === 'www.youtube.com' &&
           window.location.pathname === '/watch';
  },

  async extract() {
    const title = document.querySelector('h1.ytd-watch-metadata yt-formatted-string, h1.ytd-video-primary-info-renderer')?.textContent?.trim() || '';
    const channel = document.querySelector('#channel-name yt-formatted-string a, ytd-channel-name yt-formatted-string a')?.textContent?.trim() || '';

    // Try to get transcript
    let transcript = '';
    try {
      transcript = await this.fetchTranscript();
    } catch (err) {
      console.warn('[Debunked] Could not fetch YouTube transcript:', err.message);
    }

    // Fall back to video description if no transcript
    if (!transcript) {
      const descEl = document.querySelector('#description-inline-expander, ytd-text-inline-expander, #description');
      transcript = descEl?.textContent?.trim() || '';
    }

    if (!transcript && !title) return null;

    return {
      type: 'youtube',
      content: `Video: ${title}\nChannel: ${channel}\n\nTranscript:\n${transcript}`.slice(0, 6000)
    };
  },

  async fetchTranscript() {
    // Extract the video ID from the URL
    const videoId = new URLSearchParams(window.location.search).get('v');
    if (!videoId) throw new Error('No video ID');

    // Fetch the page HTML to find caption tracks
    const resp = await fetch(window.location.href);
    const html = await resp.text();

    // Find the captions URL in the page data
    const captionMatch = html.match(/"captionTracks":\[.*?"baseUrl":"(.*?)"/);
    if (!captionMatch) throw new Error('No captions found');

    const captionUrl = captionMatch[1].replace(/\\u0026/g, '&');
    const captionResp = await fetch(captionUrl);
    const captionXml = await captionResp.text();

    // Parse the XML to extract text
    const parser = new DOMParser();
    const doc = parser.parseFromString(captionXml, 'text/xml');
    const texts = doc.querySelectorAll('text');
    const lines = [];
    texts.forEach(t => {
      const line = t.textContent?.trim();
      if (line) lines.push(line);
    });

    return lines.join(' ');
  }
};
```

**Step 5: Create generic extractor**

```javascript
window.Debunked = window.Debunked || {};
window.Debunked.Extractors = window.Debunked.Extractors || {};

window.Debunked.Extractors.generic = {
  canExtract() {
    return true; // Always available as fallback
  },

  extract() {
    const body = document.body;
    if (!body) return null;

    // Try to find the main content area
    const main = document.querySelector('main, [role="main"], #content, .content, #main-content') || body;

    const clone = main.cloneNode(true);
    clone.querySelectorAll('script, style, nav, aside, header, footer, .ad, .sidebar, .menu, .nav').forEach(el => el.remove());

    const text = clone.textContent?.trim() || '';
    if (text.length < 200) return null;

    return {
      type: 'generic',
      content: text.slice(0, 6000)
    };
  }
};
```

**Step 6: Commit**

```bash
git add extension/src/content/extractors/
git commit -m "feat: add platform-specific content extractors (article, twitter, reddit, youtube, generic)"
```

---

### Task 4: Page Detector & Orchestrator

**Files:**
- Create: `extension/src/content/detector.js`

**Step 1: Create the detector**

This is the main content script orchestrator. It detects the page type, checks if it should auto-trigger, extracts content, sends it for analysis, and renders results.

```javascript
window.Debunked = window.Debunked || {};

window.Debunked.Detector = {
  domains: [],
  analysisResult: null,
  isAnalyzing: false,

  async init() {
    try {
      await this.loadDomains();
      const shouldAuto = this.shouldAutoTrigger();

      if (shouldAuto) {
        await this.analyze();
      }

      // Listen for manual trigger from popup/service worker
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'analyze') {
          this.analyze().then(() => sendResponse({ success: true }));
          return true;
        }
        if (message.action === 'getAnalysis') {
          sendResponse({ analysis: this.analysisResult, isAnalyzing: this.isAnalyzing });
          return false;
        }
      });
    } catch (err) {
      console.error('[Debunked] Detector init failed:', err);
    }
  },

  async loadDomains() {
    // Try cached domains first
    const stored = await chrome.storage.local.get('domainList');
    if (stored.domainList && stored.domainList.domains) {
      this.domains = stored.domainList.domains;
      return;
    }
    // Fall back to bundled domains.json
    try {
      const url = chrome.runtime.getURL('data/domains.json');
      const resp = await fetch(url);
      const data = await resp.json();
      this.domains = data.domains || [];
      await chrome.storage.local.set({ domainList: data });
    } catch {
      this.domains = [];
    }
  },

  shouldAutoTrigger() {
    // Check user preference
    // For now, auto-trigger is always on for whitelisted domains
    const hostname = window.location.hostname.replace(/^www\./, '');
    return this.domains.some(d => hostname === d || hostname.endsWith('.' + d));
  },

  detectPageType() {
    const extractors = window.Debunked.Extractors;
    // Check platform-specific extractors first (order matters)
    if (extractors.youtube.canExtract()) return 'youtube';
    if (extractors.twitter.canExtract()) return 'twitter';
    if (extractors.reddit.canExtract()) return 'reddit';
    if (extractors.article.canExtract()) return 'article';
    return 'generic';
  },

  async extractContent() {
    const type = this.detectPageType();
    const extractor = window.Debunked.Extractors[type];

    // YouTube extractor is async
    const result = type === 'youtube' ? await extractor.extract() : extractor.extract();
    return result;
  },

  async analyze() {
    if (this.isAnalyzing) return;
    this.isAnalyzing = true;

    // Notify service worker that analysis started (for icon badge)
    chrome.runtime.sendMessage({ action: 'analysisStarted' });

    try {
      const extracted = await this.extractContent();
      if (!extracted) {
        this.isAnalyzing = false;
        chrome.runtime.sendMessage({ action: 'analysisEmpty' });
        return;
      }

      // Send to backend via service worker
      const response = await chrome.runtime.sendMessage({
        action: 'analyzeContent',
        payload: {
          content: extracted.content,
          type: extracted.type,
          url: window.location.href
        }
      });

      if (response && response.claims) {
        this.analysisResult = response;

        // Render inline highlights
        window.Debunked.Highlighter.highlightClaims(response.claims);

        // Render sidebar
        window.Debunked.Sidebar.render(response);

        // Notify service worker with results (for icon badge)
        const issueCount = response.claims.filter(c =>
          ['misleading', 'false', 'unverified'].includes(c.verdict)
        ).length;
        chrome.runtime.sendMessage({
          action: 'analysisComplete',
          verdict: response.overallVerdict,
          issueCount
        });
      }
    } catch (err) {
      console.error('[Debunked] Analysis failed:', err);
      chrome.runtime.sendMessage({ action: 'analysisFailed' });
    } finally {
      this.isAnalyzing = false;
    }
  }
};

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.Debunked.Detector.init());
} else {
  window.Debunked.Detector.init();
}
```

**Step 2: Commit**

```bash
git add extension/src/content/detector.js
git commit -m "feat: add page type detector and analysis orchestrator"
```

---

### Task 5: Inline Highlighter (v2)

**Files:**
- Create: `extension/src/content/highlighter.js`

**Step 1: Create the v2 highlighter**

This highlights specific AI-identified claims in the page with color-coded borders and tooltips.

```javascript
window.Debunked = window.Debunked || {};

window.Debunked.Highlighter = {
  highlights: [],

  highlightClaims(claims) {
    this.clearHighlights();

    for (const claim of claims) {
      if (!claim.originalQuote) continue;
      this.findAndHighlight(claim);
    }
  },

  findAndHighlight(claim) {
    const searchText = claim.originalQuote.toLowerCase();
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName.toLowerCase();
          if (['script', 'style', 'noscript', 'textarea', 'input'].includes(tag)) {
            return NodeFilter.FILTER_REJECT;
          }
          if (parent.classList.contains('debunked-claim')) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let node;
    while ((node = walker.nextNode())) {
      const nodeText = node.textContent.toLowerCase();
      const idx = nodeText.indexOf(searchText);
      if (idx === -1) continue;

      try {
        const range = document.createRange();
        range.setStart(node, idx);
        range.setEnd(node, idx + claim.originalQuote.length);

        const mark = document.createElement('mark');
        mark.className = `debunked-claim debunked-verdict-${claim.verdict}`;
        mark.dataset.claimId = claim.id;
        mark.title = `${this.verdictLabel(claim.verdict)}: ${claim.explanation}`;

        // Click to scroll sidebar to this claim
        mark.addEventListener('click', () => {
          window.Debunked.Sidebar.scrollToClaim(claim.id);
        });

        range.surroundContents(mark);
        this.highlights.push(mark);
      } catch (e) {
        // Range may cross element boundaries
      }
      break; // Only highlight first occurrence
    }
  },

  verdictLabel(verdict) {
    const labels = {
      true: 'True',
      mostly_true: 'Mostly True',
      misleading: 'Misleading',
      false: 'False',
      unverified: 'Unverified'
    };
    return labels[verdict] || 'Unknown';
  },

  clearHighlights() {
    for (const mark of this.highlights) {
      const parent = mark.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(mark.textContent), mark);
        parent.normalize();
      }
    }
    this.highlights = [];
  }
};
```

**Step 2: Commit**

```bash
git add extension/src/content/highlighter.js
git commit -m "feat: add v2 claim highlighter with verdict-colored inline marks"
```

---

### Task 6: Sidebar Panel

**Files:**
- Create: `extension/src/content/sidebar.js`
- Create: `extension/src/content/content.css`

**Step 1: Create the sidebar**

```javascript
window.Debunked = window.Debunked || {};

window.Debunked.Sidebar = {
  sidebarEl: null,
  tabEl: null,
  isOpen: false,

  render(analysis) {
    if (!document.body) return;
    this.remove();
    this.createSidebar(analysis);
    this.createTab(analysis.overallVerdict);
  },

  createSidebar(analysis) {
    this.sidebarEl = document.createElement('div');
    this.sidebarEl.id = 'debunked-sidebar';

    const verdictColor = { green: '#4caf50', yellow: '#ff9800', red: '#f44336' };
    const verdictText = { green: 'Mostly Reliable', yellow: 'Mixed Accuracy', red: 'Significant Issues' };
    const color = verdictColor[analysis.overallVerdict] || verdictColor.yellow;

    let claimsHtml = '';
    for (const claim of analysis.claims) {
      claimsHtml += `
        <div class="debunked-claim-card" id="debunked-claim-${claim.id}">
          <div class="debunked-claim-verdict debunked-verdict-${claim.verdict}">
            ${this.verdictBadge(claim.verdict)}
          </div>
          <blockquote class="debunked-claim-quote">"${this.escapeHtml(claim.originalQuote || claim.text)}"</blockquote>
          <p class="debunked-claim-explanation">${this.escapeHtml(claim.explanation)}</p>
        </div>
      `;
    }

    let fallaciesHtml = '';
    if (analysis.fallacies && analysis.fallacies.length > 0) {
      fallaciesHtml = `
        <div class="debunked-section">
          <h3 class="debunked-section-title">Logical Fallacies</h3>
          ${analysis.fallacies.map(f => `
            <div class="debunked-fallacy-card">
              <strong>${this.escapeHtml(f.type.replace(/_/g, ' '))}</strong>
              <p>${this.escapeHtml(f.explanation)}</p>
            </div>
          `).join('')}
        </div>
      `;
    }

    this.sidebarEl.innerHTML = `
      <div class="debunked-sidebar-header">
        <div class="debunked-sidebar-title">
          <span class="debunked-logo">DEBUNKED</span>
          <button class="debunked-close-btn" id="debunked-close">&times;</button>
        </div>
        <div class="debunked-verdict-bar" style="background:${color}">
          <span class="debunked-verdict-icon">${analysis.overallVerdict === 'green' ? '&#10003;' : analysis.overallVerdict === 'red' ? '&#10007;' : '&#9888;'}</span>
          <span>${verdictText[analysis.overallVerdict] || 'Analysis Complete'}</span>
        </div>
        <p class="debunked-summary">${this.escapeHtml(analysis.summary)}</p>
      </div>
      <div class="debunked-sidebar-body">
        <div class="debunked-section">
          <h3 class="debunked-section-title">Claims (${analysis.claims.length})</h3>
          ${claimsHtml || '<p class="debunked-empty">No factual claims detected.</p>'}
        </div>
        ${fallaciesHtml}
      </div>
      <div class="debunked-sidebar-footer">
        Powered by Debunked
      </div>
    `;

    document.body.appendChild(this.sidebarEl);

    // Close button
    this.sidebarEl.querySelector('#debunked-close').addEventListener('click', () => {
      this.toggle();
    });

    // Auto-open
    this.isOpen = true;
    this.sidebarEl.classList.add('open');
  },

  createTab(verdict) {
    this.tabEl = document.createElement('div');
    this.tabEl.id = 'debunked-tab';
    this.tabEl.className = `debunked-tab-${verdict}`;
    this.tabEl.textContent = 'D';
    this.tabEl.title = 'Toggle Debunked sidebar';
    this.tabEl.addEventListener('click', () => this.toggle());
    document.body.appendChild(this.tabEl);
  },

  toggle() {
    this.isOpen = !this.isOpen;
    if (this.sidebarEl) {
      this.sidebarEl.classList.toggle('open', this.isOpen);
    }
  },

  scrollToClaim(claimId) {
    if (!this.isOpen) this.toggle();
    const el = this.sidebarEl?.querySelector(`#debunked-claim-${claimId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('debunked-flash');
      setTimeout(() => el.classList.remove('debunked-flash'), 1000);
    }
  },

  verdictBadge(verdict) {
    const labels = {
      true: 'TRUE',
      mostly_true: 'MOSTLY TRUE',
      misleading: 'MISLEADING',
      false: 'FALSE',
      unverified: 'UNVERIFIED'
    };
    return labels[verdict] || verdict.toUpperCase();
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  remove() {
    this.sidebarEl?.remove();
    this.tabEl?.remove();
    this.sidebarEl = null;
    this.tabEl = null;
    this.isOpen = false;
  }
};
```

**Step 2: Create content.css**

```css
/* ============================================
   DEBUNKED v2 — Content Script Styles
   ============================================ */

/* --- Inline Claim Highlights --- */
.debunked-claim {
  border-radius: 2px;
  cursor: pointer;
  transition: background-color 0.2s;
  padding: 1px 0;
}

.debunked-verdict-true {
  background-color: rgba(76, 175, 80, 0.15);
  border-bottom: 2px solid #4caf50;
}

.debunked-verdict-mostly_true {
  background-color: rgba(139, 195, 74, 0.15);
  border-bottom: 2px solid #8bc34a;
}

.debunked-verdict-misleading {
  background-color: rgba(255, 152, 0, 0.2);
  border-bottom: 2px solid #ff9800;
}

.debunked-verdict-false {
  background-color: rgba(244, 67, 54, 0.2);
  border-bottom: 2px solid #f44336;
}

.debunked-verdict-unverified {
  background-color: rgba(158, 158, 158, 0.15);
  border-bottom: 2px dashed #9e9e9e;
}

.debunked-claim:hover {
  filter: brightness(0.95);
}

/* --- Sidebar Panel --- */
#debunked-sidebar {
  position: fixed;
  top: 0;
  right: -380px;
  width: 380px;
  height: 100vh;
  background: #1a1a2e;
  color: #e0e0e0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  z-index: 2147483647;
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  transition: right 0.3s ease;
  overflow: hidden;
}

#debunked-sidebar.open {
  right: 0;
}

.debunked-sidebar-header {
  padding: 16px;
  border-bottom: 1px solid #2a2a4a;
  flex-shrink: 0;
}

.debunked-sidebar-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.debunked-logo {
  font-size: 18px;
  font-weight: 800;
  color: #ffc107;
  letter-spacing: 2px;
}

.debunked-close-btn {
  background: none;
  border: none;
  color: #888;
  font-size: 24px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}

.debunked-close-btn:hover {
  color: #fff;
}

.debunked-verdict-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  color: white;
  margin-bottom: 10px;
}

.debunked-verdict-icon {
  font-size: 18px;
}

.debunked-summary {
  font-size: 13px;
  color: #aaa;
  line-height: 1.4;
  margin: 0;
}

.debunked-sidebar-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.debunked-section {
  margin-bottom: 20px;
}

.debunked-section-title {
  font-size: 13px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin: 0 0 12px;
}

/* --- Claim Cards --- */
.debunked-claim-card {
  background: #2a2a4a;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 10px;
  transition: background-color 0.3s;
}

.debunked-claim-card.debunked-flash {
  background: #3a3a5a;
}

.debunked-claim-verdict {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  padding: 3px 8px;
  border-radius: 4px;
  display: inline-block;
  margin-bottom: 8px;
}

.debunked-claim-verdict.debunked-verdict-true {
  background: rgba(76, 175, 80, 0.2);
  color: #4caf50;
}

.debunked-claim-verdict.debunked-verdict-mostly_true {
  background: rgba(139, 195, 74, 0.2);
  color: #8bc34a;
}

.debunked-claim-verdict.debunked-verdict-misleading {
  background: rgba(255, 152, 0, 0.2);
  color: #ff9800;
}

.debunked-claim-verdict.debunked-verdict-false {
  background: rgba(244, 67, 54, 0.2);
  color: #f44336;
}

.debunked-claim-verdict.debunked-verdict-unverified {
  background: rgba(158, 158, 158, 0.2);
  color: #9e9e9e;
}

.debunked-claim-quote {
  font-style: italic;
  color: #ccc;
  margin: 0 0 8px;
  padding-left: 10px;
  border-left: 2px solid #444;
  font-size: 13px;
  line-height: 1.4;
}

.debunked-claim-explanation {
  margin: 0;
  font-size: 13px;
  color: #aaa;
  line-height: 1.4;
}

.debunked-empty {
  color: #666;
  font-style: italic;
  font-size: 13px;
}

/* --- Fallacy Cards --- */
.debunked-fallacy-card {
  background: #2a2a4a;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 10px;
}

.debunked-fallacy-card strong {
  color: #ff9800;
  text-transform: capitalize;
  font-size: 13px;
}

.debunked-fallacy-card p {
  margin: 6px 0 0;
  color: #aaa;
  font-size: 13px;
  line-height: 1.4;
}

/* --- Sidebar Footer --- */
.debunked-sidebar-footer {
  padding: 12px 16px;
  border-top: 1px solid #2a2a4a;
  font-size: 11px;
  color: #555;
  text-align: center;
  flex-shrink: 0;
}

/* --- Edge Tab --- */
#debunked-tab {
  position: fixed;
  top: 50%;
  right: 0;
  transform: translateY(-50%);
  width: 28px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: -apple-system, sans-serif;
  font-weight: 800;
  font-size: 14px;
  color: white;
  border-radius: 6px 0 0 6px;
  cursor: pointer;
  z-index: 2147483646;
  writing-mode: vertical-lr;
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.3);
  transition: opacity 0.2s;
}

#debunked-tab:hover {
  opacity: 0.9;
}

.debunked-tab-green { background: #4caf50; }
.debunked-tab-yellow { background: #ff9800; }
.debunked-tab-red { background: #f44336; }

/* --- Scrollbar --- */
.debunked-sidebar-body::-webkit-scrollbar { width: 4px; }
.debunked-sidebar-body::-webkit-scrollbar-track { background: transparent; }
.debunked-sidebar-body::-webkit-scrollbar-thumb { background: #444; border-radius: 2px; }
```

**Step 3: Commit**

```bash
git add extension/src/content/sidebar.js extension/src/content/content.css
git commit -m "feat: add sidebar panel and content styles for v2"
```

---

### Task 7: Service Worker (v2)

**Files:**
- Rewrite: `extension/src/background/service-worker.js`

**Step 1: Rewrite the service worker**

```javascript
const BACKEND_URL = 'https://debunked-production.up.railway.app';

// Update domain list periodically
chrome.runtime.onInstalled.addListener(async () => {
  await updateDomains();
  chrome.alarms.create('updateDomains', { periodInMinutes: 24 * 60 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'updateDomains') {
    await updateDomains();
  }
});

// Message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'analyzeContent') {
    analyzeContent(message.payload).then(sendResponse);
    return true;
  }

  if (message.action === 'analysisStarted') {
    // Set icon to "analyzing" state
    if (sender.tab?.id) {
      chrome.action.setBadgeText({ text: '...', tabId: sender.tab.id });
      chrome.action.setBadgeBackgroundColor({ color: '#666', tabId: sender.tab.id });
    }
  }

  if (message.action === 'analysisComplete') {
    if (sender.tab?.id) {
      const text = message.issueCount > 0 ? String(message.issueCount) : '';
      const colors = { green: '#4caf50', yellow: '#ff9800', red: '#f44336' };
      chrome.action.setBadgeText({ text, tabId: sender.tab.id });
      chrome.action.setBadgeBackgroundColor({
        color: colors[message.verdict] || '#666',
        tabId: sender.tab.id
      });
    }
  }

  if (message.action === 'analysisEmpty' || message.action === 'analysisFailed') {
    if (sender.tab?.id) {
      chrome.action.setBadgeText({ text: '', tabId: sender.tab.id });
    }
  }

  return false;
});

async function analyzeContent(payload) {
  try {
    const resp = await fetch(`${BACKEND_URL}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } catch (err) {
    console.error('[Debunked] Backend analysis failed:', err.message);
    return {
      overallVerdict: 'yellow',
      summary: 'Analysis temporarily unavailable. Please try again.',
      claims: [],
      fallacies: []
    };
  }
}

async function updateDomains() {
  try {
    const resp = await fetch(`${BACKEND_URL}/api/domains`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    await chrome.storage.local.set({ domainList: data });
    console.log('[Debunked] Domain list updated:', data.domains?.length, 'domains');
  } catch (err) {
    console.warn('[Debunked] Failed to update domains:', err.message);
  }
}
```

**Step 2: Commit**

```bash
git add extension/src/background/service-worker.js
git commit -m "feat: rewrite service worker for v2 analysis flow and icon badges"
```

---

### Task 8: Popup UI (v2)

**Files:**
- Create: `extension/src/popup/popup.html`
- Create: `extension/src/popup/popup.css`
- Create: `extension/src/popup/popup.js`

**Step 1: Create popup.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Debunked</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="popup-container">
    <header>
      <h1>DEBUNKED</h1>
      <p class="subtitle">AI Fact-Checker</p>
    </header>

    <div id="status"></div>

    <div class="actions">
      <button id="analyze-btn" class="btn btn-primary">Analyze This Page</button>
    </div>

    <footer>
      <button id="settings-btn" class="btn-link">Settings</button>
    </footer>
  </div>
  <script src="popup.js"></script>
</body>
</html>
```

**Step 2: Create popup.css**

```css
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  width: 300px;
  background: #1a1a2e;
  color: #e0e0e0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.popup-container { padding: 20px; }

header { text-align: center; margin-bottom: 16px; }

header h1 {
  color: #ffc107;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: 3px;
}

header .subtitle {
  color: #888;
  font-size: 11px;
  margin-top: 2px;
  letter-spacing: 1px;
}

#status {
  text-align: center;
  padding: 12px;
  margin-bottom: 12px;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.4;
}

.status-analyzing {
  background: #2a2a4a;
  color: #ffc107;
}

.status-done {
  background: #2a2a4a;
  color: #4caf50;
}

.status-empty {
  background: #2a2a4a;
  color: #888;
}

.actions { margin-top: 8px; }

.btn {
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn:hover { opacity: 0.85; }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-primary {
  background: #ffc107;
  color: #1a1a2e;
}

.btn-link {
  background: none;
  border: none;
  color: #666;
  font-size: 12px;
  cursor: pointer;
  padding: 8px 0;
  width: 100%;
}

.btn-link:hover { color: #aaa; }

footer { text-align: center; margin-top: 12px; }
```

**Step 3: Create popup.js**

```javascript
document.addEventListener('DOMContentLoaded', async () => {
  const statusEl = document.getElementById('status');
  const analyzeBtn = document.getElementById('analyze-btn');

  // Check if current tab has analysis results
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (tab) {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getAnalysis' });

      if (response?.isAnalyzing) {
        statusEl.textContent = 'Analyzing page...';
        statusEl.className = 'status-analyzing';
        analyzeBtn.disabled = true;
        analyzeBtn.textContent = 'Analyzing...';
      } else if (response?.analysis) {
        const a = response.analysis;
        const issueCount = a.claims.filter(c =>
          ['misleading', 'false', 'unverified'].includes(c.verdict)
        ).length;
        statusEl.textContent = `${a.claims.length} claims analyzed, ${issueCount} issue${issueCount !== 1 ? 's' : ''} found.`;
        statusEl.className = 'status-done';
        analyzeBtn.textContent = 'Re-analyze';
      } else {
        statusEl.textContent = 'No analysis yet for this page.';
        statusEl.className = 'status-empty';
      }
    } catch {
      statusEl.textContent = 'Navigate to a page to analyze.';
      statusEl.className = 'status-empty';
    }
  }

  analyzeBtn.addEventListener('click', async () => {
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'Analyzing...';
    statusEl.textContent = 'Sending to AI for analysis...';
    statusEl.className = 'status-analyzing';

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { action: 'analyze' }).catch(() => {});
    }

    // Close popup — results will appear in sidebar
    setTimeout(() => window.close(), 500);
  });
});
```

**Step 4: Commit**

```bash
git add extension/src/popup/
git commit -m "feat: add v2 popup with analyze button and status display"
```

---

### Task 9: Integration Testing & Polish

**Step 1: Install backend deps and test endpoints locally**

```bash
cd backend && npm install && node -e "
const app = require('./server.js');
"
```

Test:
```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/domains
```

**Step 2: Verify all JS files have valid syntax**

```bash
for f in extension/src/content/extractors/*.js extension/src/content/*.js extension/src/popup/popup.js extension/src/background/service-worker.js; do
  node --check "$f" && echo "$f: OK" || echo "$f: SYNTAX ERROR"
done
```

**Step 3: Load extension in Chrome and test**

1. `chrome://extensions` → Developer mode → Load unpacked → select `extension/`
2. Visit a news article (e.g., CNN, Fox News) — should auto-trigger analysis
3. Verify: sidebar slides in with claims, inline highlights appear
4. Visit YouTube political video — should extract transcript and analyze
5. Visit Twitter/X — should extract tweet text and analyze
6. Visit a non-news site (e.g., Amazon) — should remain inactive
7. Click extension icon on non-news site → "Analyze This Page" button should work

**Step 4: Fix any issues found during testing**

**Step 5: Final commit**

```bash
git add -A
git commit -m "fix: integration testing fixes and polish for v2"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Clean up v1 files, update manifest, add domains.json | ~14 deleted, 2 modified, 1 created |
| 2 | Backend debunking prompt, analyze route, domains route | 4 files |
| 3 | Content extractors (article, twitter, reddit, youtube, generic) | 5 files |
| 4 | Page detector & orchestrator | 1 file |
| 5 | Inline highlighter v2 | 1 file |
| 6 | Sidebar panel + content CSS | 2 files |
| 7 | Service worker v2 | 1 file (rewrite) |
| 8 | Popup UI v2 | 3 files |
| 9 | Integration testing | 0 files |

**Total: 9 tasks, ~17 new files, ~14 deleted**
