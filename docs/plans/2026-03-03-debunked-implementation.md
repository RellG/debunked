# Debunked Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Chrome extension that detects misinformation patterns on web pages and gamifies media literacy through a Bingo card mechanic.

**Architecture:** Monolith Chrome extension (Manifest V3) with vanilla JS handles pattern matching, Bingo state, UI, and image generation. Thin Node.js/Express backend on Railway proxies AI analysis to OpenRouter and serves pattern database updates.

**Tech Stack:** Vanilla JS, Chrome Extension Manifest V3, Node.js, Express, OpenRouter API, Canvas API

---

### Task 1: Project Scaffolding & Pattern Database

**Files:**
- Create: `extension/manifest.json`
- Create: `extension/data/patterns.json`
- Create: `backend/package.json`
- Create: `backend/server.js`
- Create: `backend/.env.example`
- Create: `.gitignore`

**Step 1: Create `.gitignore`**

```
node_modules/
.env
*.zip
dist/
```

**Step 2: Create extension manifest**

```json
{
  "manifest_version": 3,
  "name": "Debunked",
  "version": "1.0.0",
  "description": "Fake News Bingo — spot misinformation patterns and fill your Bingo card!",
  "permissions": ["storage", "activeTab"],
  "host_permissions": ["<all_urls>"],
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
        "src/lib/patterns.js",
        "src/lib/bingo.js",
        "src/content/scanner.js",
        "src/content/highlighter.js",
        "src/content/widget.js"
      ],
      "css": ["src/content/content.css"],
      "run_at": "document_idle"
    }
  ],
  "icons": {
    "16": "src/assets/icon16.png",
    "48": "src/assets/icon48.png",
    "128": "src/assets/icon128.png"
  }
}
```

**Step 3: Create the pattern database**

Create `extension/data/patterns.json` with the full initial pattern database covering all 10 categories. Include at least 3-5 patterns per category for a total of ~40 patterns. Each pattern has: `id`, `category`, `type` (one of: `regex`, `keyword`, `phrase`), `pattern`, `flags` (optional, e.g., `"i"` for case-insensitive), `severity` (1-5), `description`, `bingoLabel`.

Categories and example patterns:

- **fear_urgency**: `"they don'?t want you to (know|see|hear)"`, `"wake up,? (people|america|sheeple)"`, `"before it'?s too late"`, `"this is (extremely |very )?dangerous"`
- **ad_hominem**: `"liberal snowflake"`, `"right-wing nut"`, `"libtard"`, `"nazi"` (when used as generic insult), `"sheep"`
- **appeal_to_authority**: `"experts agree"`, `"scientists say"`, `"studies show"` (without citation), `"research proves"`
- **false_dichotomy**: `"you'?re either with us or against us"`, `"there are only two (options|choices)"`, `"if you'?re not .+, you'?re .+"`
- **emotional_manipulation**: ALL CAPS detection (3+ consecutive uppercase words), excessive punctuation (`!!!`, `???`), `"think of the children"`
- **weasel_words**: `"some people say"`, `"many believe"`, `"it is well known"`, `"everyone knows"`, `"sources say"`
- **conspiracy_markers**: `"follow the money"`, `"do your own research"`, `"open your eyes"`, `"connect the dots"`, `"the mainstream media"`
- **clickbait**: `"shocking truth"`, `"you won'?t believe"`, `"what .+ doesn'?t want you to (know|see)"`, `"number \\d+ will (shock|surprise) you"`
- **cherry_picking**: (type: `ai_required`) `"cherry_picking_stats"` — flagged for AI analysis
- **logical_fallacy**: (type: `ai_required`) `"straw_man"`, `"slippery_slope"`, `"whataboutism"` — flagged for AI analysis

**Step 4: Create backend package.json**

```json
{
  "name": "debunked-backend",
  "version": "1.0.0",
  "description": "Backend API for Debunked browser extension",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "express": "^4.18.0",
    "cors": "^2.8.5",
    "express-rate-limit": "^7.1.0"
  }
}
```

**Step 5: Create minimal backend server**

Create `backend/server.js` with:
- Express app on `process.env.PORT || 3000`
- CORS middleware
- Rate limiting (100 requests per 15 minutes per IP)
- `GET /api/health` returning `{ status: "ok" }`
- Placeholder route imports for `/api/patterns` and `/api/analyze`

**Step 6: Create `.env.example`**

```
OPENROUTER_API_KEY=your_key_here
PORT=3000
```

**Step 7: Commit**

```bash
git add .gitignore extension/manifest.json extension/data/patterns.json backend/package.json backend/server.js backend/.env.example
git commit -m "feat: scaffold project structure with manifest, pattern DB, and backend skeleton"
```

---

### Task 2: Pattern Matching Engine

**Files:**
- Create: `extension/src/lib/patterns.js`
- Create: `extension/src/content/scanner.js`

**Step 1: Build the pattern manager (`extension/src/lib/patterns.js`)**

This module manages the local pattern database. It must work as a content script (no ES modules — use IIFEs or global namespace `window.Debunked`).

```javascript
// Attach to window.Debunked namespace
window.Debunked = window.Debunked || {};

window.Debunked.PatternManager = {
  patterns: [],

  async load() {
    // Try chrome.storage.local first (cached from backend updates)
    // Fall back to bundled patterns.json via chrome.runtime.getURL
    const stored = await chrome.storage.local.get('patternDB');
    if (stored.patternDB) {
      this.patterns = stored.patternDB.patterns;
      return;
    }
    const url = chrome.runtime.getURL('data/patterns.json');
    const resp = await fetch(url);
    const db = await resp.json();
    this.patterns = db.patterns;
    await chrome.storage.local.set({ patternDB: db });
  },

  getByCategory(category) {
    return this.patterns.filter(p => p.category === category);
  },

  getLocalPatterns() {
    return this.patterns.filter(p => p.type !== 'ai_required');
  },

  getAIPatterns() {
    return this.patterns.filter(p => p.type === 'ai_required');
  },

  getCategories() {
    return [...new Set(this.patterns.map(p => p.category))];
  }
};
```

**Step 2: Build the scanner (`extension/src/content/scanner.js`)**

The scanner extracts visible text from the page and runs it against local patterns. Returns an array of match objects.

```javascript
window.Debunked = window.Debunked || {};

window.Debunked.Scanner = {
  scan(textContent) {
    const matches = [];
    const localPatterns = window.Debunked.PatternManager.getLocalPatterns();

    for (const pattern of localPatterns) {
      let regex;
      if (pattern.type === 'regex') {
        regex = new RegExp(pattern.pattern, pattern.flags || 'gi');
      } else if (pattern.type === 'keyword') {
        // Word-boundary match
        regex = new RegExp(`\\b${escapeRegex(pattern.pattern)}\\b`, 'gi');
      } else if (pattern.type === 'phrase') {
        regex = new RegExp(escapeRegex(pattern.pattern), 'gi');
      }

      let match;
      while ((match = regex.exec(textContent)) !== null) {
        matches.push({
          patternId: pattern.id,
          category: pattern.category,
          matched: match[0],
          index: match.index,
          severity: pattern.severity,
          bingoLabel: pattern.bingoLabel,
          description: pattern.description
        });
      }
    }

    return matches;
  },

  getPageText() {
    // Get visible text from body, excluding scripts/styles
    const body = document.body;
    if (!body) return '';
    const clone = body.cloneNode(true);
    clone.querySelectorAll('script, style, noscript').forEach(el => el.remove());
    return clone.textContent || '';
  }
};

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

**Step 3: Test manually**

Load the extension in Chrome (`chrome://extensions` → Developer mode → Load unpacked → select `extension/` folder). Navigate to a news article. Open the console and run:

```javascript
await window.Debunked.PatternManager.load();
const text = window.Debunked.Scanner.getPageText();
const matches = window.Debunked.Scanner.scan(text);
console.log('Matches found:', matches);
```

Verify matches appear for pages with misinformation patterns.

**Step 4: Commit**

```bash
git add extension/src/lib/patterns.js extension/src/content/scanner.js
git commit -m "feat: add pattern matching engine with regex, keyword, and phrase support"
```

---

### Task 3: Bingo Card Logic

**Files:**
- Create: `extension/src/lib/bingo.js`

**Step 1: Build Bingo card logic**

The Bingo module manages card generation, state tracking, and win detection. Must work in content script context (global namespace).

```javascript
window.Debunked = window.Debunked || {};

window.Debunked.Bingo = {
  GRID_SIZE: 5,
  card: null,

  generateCard(categories) {
    // categories: array of { category, bingoLabel } from pattern DB
    // Shuffle and pick 24 (5x5 minus free space)
    const shuffled = [...categories].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 24);

    const grid = [];
    let idx = 0;
    for (let row = 0; row < 5; row++) {
      grid[row] = [];
      for (let col = 0; col < 5; col++) {
        if (row === 2 && col === 2) {
          grid[row][col] = { label: 'FREE', category: 'free', filled: true, matches: [] };
        } else {
          grid[row][col] = {
            label: selected[idx].bingoLabel,
            category: selected[idx].category,
            filled: false,
            matches: []
          };
          idx++;
        }
      }
    }

    this.card = { grid, score: 0, bingos: [], createdAt: Date.now() };
    return this.card;
  },

  addMatch(match) {
    // Find the first unfilled square matching this category and fill it
    if (!this.card) return null;
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        const cell = this.card.grid[row][col];
        if (cell.category === match.category && !cell.filled) {
          cell.filled = true;
          cell.matches.push(match);
          this.card.score++;
          const newBingos = this.checkBingos();
          return { row, col, cell, newBingos };
        }
        // If already filled with same category, just add the match count
        if (cell.category === match.category && cell.filled) {
          cell.matches.push(match);
          return { row, col, cell, newBingos: [] };
        }
      }
    }
    return null;
  },

  checkBingos() {
    const newBingos = [];
    const grid = this.card.grid;

    // Check rows
    for (let r = 0; r < 5; r++) {
      const key = `row-${r}`;
      if (!this.card.bingos.includes(key) && grid[r].every(c => c.filled)) {
        this.card.bingos.push(key);
        newBingos.push(key);
      }
    }

    // Check columns
    for (let c = 0; c < 5; c++) {
      const key = `col-${c}`;
      if (!this.card.bingos.includes(key) && [0,1,2,3,4].every(r => grid[r][c].filled)) {
        this.card.bingos.push(key);
        newBingos.push(key);
      }
    }

    // Check diagonals
    const diag1Key = 'diag-1';
    if (!this.card.bingos.includes(diag1Key) && [0,1,2,3,4].every(i => grid[i][i].filled)) {
      this.card.bingos.push(diag1Key);
      newBingos.push(diag1Key);
    }
    const diag2Key = 'diag-2';
    if (!this.card.bingos.includes(diag2Key) && [0,1,2,3,4].every(i => grid[i][4-i].filled)) {
      this.card.bingos.push(diag2Key);
      newBingos.push(diag2Key);
    }

    return newBingos;
  },

  isBlackout() {
    if (!this.card) return false;
    return this.card.grid.every(row => row.every(cell => cell.filled));
  },

  getFilledCount() {
    if (!this.card) return 0;
    return this.card.grid.flat().filter(c => c.filled).length;
  },

  async saveState() {
    if (this.card) {
      await chrome.storage.local.set({ bingoCard: this.card });
    }
  },

  async loadState() {
    const stored = await chrome.storage.local.get('bingoCard');
    if (stored.bingoCard) {
      this.card = stored.bingoCard;
      return true;
    }
    return false;
  }
};
```

**Step 2: Test manually in console**

```javascript
const categories = window.Debunked.PatternManager.patterns.map(p => ({
  category: p.category, bingoLabel: p.bingoLabel
}));
const card = window.Debunked.Bingo.generateCard(categories);
console.log('Generated card:', card.grid.map(row => row.map(c => c.label)));
```

**Step 3: Commit**

```bash
git add extension/src/lib/bingo.js
git commit -m "feat: add Bingo card generation, match tracking, and win detection"
```

---

### Task 4: Content Script — Highlighter & CSS

**Files:**
- Create: `extension/src/content/highlighter.js`
- Create: `extension/src/content/content.css`

**Step 1: Build the highlighter**

The highlighter walks the DOM text nodes and wraps matched phrases with `<mark>` elements styled by Debunked.

```javascript
window.Debunked = window.Debunked || {};

window.Debunked.Highlighter = {
  highlighted: [],

  highlightMatches(matches) {
    // Group matches by their text position for efficient DOM walking
    this.clearHighlights();

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          // Skip script, style, and already-highlighted nodes
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName.toLowerCase();
          if (['script', 'style', 'noscript', 'textarea', 'input'].includes(tag)) {
            return NodeFilter.FILTER_REJECT;
          }
          if (parent.classList.contains('debunked-highlight')) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) {
      textNodes.push(node);
    }

    for (const textNode of textNodes) {
      const text = textNode.textContent;
      for (const match of matches) {
        const idx = text.toLowerCase().indexOf(match.matched.toLowerCase());
        if (idx === -1) continue;

        const range = document.createRange();
        range.setStart(textNode, idx);
        range.setEnd(textNode, idx + match.matched.length);

        const mark = document.createElement('mark');
        mark.className = 'debunked-highlight';
        mark.dataset.category = match.category;
        mark.dataset.patternId = match.patternId;
        mark.title = `${match.description} [${match.category}]`;

        try {
          range.surroundContents(mark);
          this.highlighted.push(mark);
        } catch (e) {
          // Range may cross element boundaries — skip gracefully
        }
        break; // Only highlight first occurrence per text node
      }
    }
  },

  clearHighlights() {
    for (const mark of this.highlighted) {
      const parent = mark.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(mark.textContent), mark);
        parent.normalize();
      }
    }
    this.highlighted = [];
  }
};
```

**Step 2: Create content.css**

Style the highlights and the floating widget container. Use a color scheme per severity level.

```css
/* Debunked highlight styles */
.debunked-highlight {
  background-color: rgba(255, 193, 7, 0.3);
  border-bottom: 2px solid #ffc107;
  border-radius: 2px;
  cursor: help;
  transition: background-color 0.2s;
}

.debunked-highlight:hover {
  background-color: rgba(255, 193, 7, 0.5);
}

.debunked-highlight[data-category="fear_urgency"] {
  background-color: rgba(244, 67, 54, 0.2);
  border-bottom-color: #f44336;
}

.debunked-highlight[data-category="ad_hominem"] {
  background-color: rgba(233, 30, 99, 0.2);
  border-bottom-color: #e91e63;
}

.debunked-highlight[data-category="conspiracy_markers"] {
  background-color: rgba(156, 39, 176, 0.2);
  border-bottom-color: #9c27b0;
}

.debunked-highlight[data-category="clickbait"] {
  background-color: rgba(255, 152, 0, 0.2);
  border-bottom-color: #ff9800;
}

.debunked-highlight[data-category="emotional_manipulation"] {
  background-color: rgba(244, 67, 54, 0.25);
  border-bottom-color: #ef5350;
}

/* Floating widget styles */
#debunked-widget {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 2147483647;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  user-select: none;
}

#debunked-widget-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #1a1a2e;
  color: #e0e0e0;
  border-radius: 24px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  transition: transform 0.2s, box-shadow 0.2s;
}

#debunked-widget-pill:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
}

#debunked-widget-pill.pulse {
  animation: debunked-pulse 0.6s ease-in-out;
}

@keyframes debunked-pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

#debunked-mini-grid {
  display: grid;
  grid-template-columns: repeat(5, 6px);
  grid-template-rows: repeat(5, 6px);
  gap: 1px;
}

#debunked-mini-grid .cell {
  width: 6px;
  height: 6px;
  border-radius: 1px;
  background: #333;
}

#debunked-mini-grid .cell.filled {
  background: #4caf50;
}

#debunked-mini-grid .cell.bingo {
  background: #ffc107;
}

#debunked-widget-count {
  font-weight: 600;
  font-size: 13px;
}

/* Expanded widget card overlay */
#debunked-expanded {
  position: fixed;
  bottom: 70px;
  right: 20px;
  width: 320px;
  max-height: 400px;
  background: #1a1a2e;
  color: #e0e0e0;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  z-index: 2147483647;
  overflow-y: auto;
  padding: 16px;
  display: none;
}

#debunked-expanded.visible {
  display: block;
}

#debunked-expanded .bingo-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
  margin-top: 12px;
}

#debunked-expanded .bingo-cell {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #2a2a4a;
  border-radius: 6px;
  font-size: 9px;
  text-align: center;
  padding: 2px;
  word-break: break-word;
  line-height: 1.1;
}

#debunked-expanded .bingo-cell.filled {
  background: #4caf50;
  color: white;
  font-weight: 600;
}

#debunked-expanded .bingo-cell.free {
  background: #ffc107;
  color: #1a1a2e;
  font-weight: 700;
}

#debunked-expanded .bingo-cell.bingo-line {
  box-shadow: 0 0 0 2px #ffc107;
}

#debunked-expanded h3 {
  margin: 0 0 4px;
  font-size: 16px;
  color: #ffc107;
}

#debunked-expanded .score {
  font-size: 12px;
  color: #aaa;
}
```

**Step 3: Commit**

```bash
git add extension/src/content/highlighter.js extension/src/content/content.css
git commit -m "feat: add DOM text highlighter and content styles with category colors"
```

---

### Task 5: Floating Mini-Widget

**Files:**
- Create: `extension/src/content/widget.js`

**Step 1: Build the floating widget**

This is the main entry point for the content script. It initializes everything, creates the widget DOM, and orchestrates scanning.

```javascript
window.Debunked = window.Debunked || {};

window.Debunked.Widget = {
  widgetEl: null,
  expandedEl: null,
  isExpanded: false,
  isDragging: false,
  dragOffset: { x: 0, y: 0 },

  async init() {
    // Load patterns
    await window.Debunked.PatternManager.load();

    // Load or generate Bingo card
    const loaded = await window.Debunked.Bingo.loadState();
    if (!loaded) {
      const categories = this.getUniqueCategories();
      window.Debunked.Bingo.generateCard(categories);
      await window.Debunked.Bingo.saveState();
    }

    // Create widget UI
    this.createWidget();

    // Scan the page
    this.scanPage();
  },

  getUniqueCategories() {
    const seen = new Set();
    const result = [];
    for (const p of window.Debunked.PatternManager.patterns) {
      if (!seen.has(p.category)) {
        seen.add(p.category);
        result.push({ category: p.category, bingoLabel: p.bingoLabel });
      }
      // Also add duplicates with different labels for variety
      if (result.length < 24) {
        result.push({ category: p.category, bingoLabel: p.bingoLabel });
      }
    }
    return result;
  },

  createWidget() {
    // Pill widget
    this.widgetEl = document.createElement('div');
    this.widgetEl.id = 'debunked-widget';
    this.widgetEl.innerHTML = `
      <div id="debunked-widget-pill">
        <div id="debunked-mini-grid">${this.renderMiniGrid()}</div>
        <span id="debunked-widget-count">${window.Debunked.Bingo.getFilledCount()}/24</span>
        <span style="font-size:11px;opacity:0.7">DEBUNKED</span>
      </div>
    `;
    document.body.appendChild(this.widgetEl);

    // Expanded card
    this.expandedEl = document.createElement('div');
    this.expandedEl.id = 'debunked-expanded';
    this.expandedEl.innerHTML = this.renderExpandedCard();
    document.body.appendChild(this.expandedEl);

    // Event listeners
    this.widgetEl.querySelector('#debunked-widget-pill').addEventListener('click', () => {
      this.toggleExpanded();
    });

    // Dragging
    this.setupDrag();
  },

  renderMiniGrid() {
    const card = window.Debunked.Bingo.card;
    if (!card) return '';
    let html = '';
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const cell = card.grid[r][c];
        const cls = cell.filled ? 'cell filled' : 'cell';
        html += `<div class="${cls}"></div>`;
      }
    }
    return html;
  },

  renderExpandedCard() {
    const card = window.Debunked.Bingo.card;
    if (!card) return '<p>No card loaded</p>';

    let gridHtml = '';
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const cell = card.grid[r][c];
        let cls = 'bingo-cell';
        if (cell.category === 'free') cls += ' free';
        else if (cell.filled) cls += ' filled';
        // Check if part of a bingo line
        const inBingo = card.bingos.some(b => {
          if (b.startsWith('row-') && parseInt(b.split('-')[1]) === r) return true;
          if (b.startsWith('col-') && parseInt(b.split('-')[1]) === c) return true;
          if (b === 'diag-1' && r === c) return true;
          if (b === 'diag-2' && r + c === 4) return true;
          return false;
        });
        if (inBingo) cls += ' bingo-line';

        const count = cell.matches.length > 1 ? ` (${cell.matches.length})` : '';
        gridHtml += `<div class="${cls}" title="${cell.description || ''}">${cell.label}${count}</div>`;
      }
    }

    const bingosText = card.bingos.length > 0
      ? `BINGO x${card.bingos.length}!`
      : 'No bingos yet';

    return `
      <h3>Debunked Bingo</h3>
      <p class="score">${window.Debunked.Bingo.getFilledCount()}/24 squares | ${bingosText}</p>
      <div class="bingo-grid">${gridHtml}</div>
    `;
  },

  toggleExpanded() {
    this.isExpanded = !this.isExpanded;
    this.expandedEl.classList.toggle('visible', this.isExpanded);
  },

  scanPage() {
    const text = window.Debunked.Scanner.getPageText();
    const matches = window.Debunked.Scanner.scan(text);

    // Deduplicate by category — only process unique categories
    const seenCategories = new Set();
    const uniqueMatches = [];
    for (const m of matches) {
      if (!seenCategories.has(m.category)) {
        seenCategories.add(m.category);
        uniqueMatches.push(m);
      }
    }

    // Add matches to bingo card
    let newFills = 0;
    for (const match of matches) {
      const result = window.Debunked.Bingo.addMatch(match);
      if (result && result.cell && result.newBingos.length > 0) {
        newFills++;
      }
    }

    // Highlight in DOM
    window.Debunked.Highlighter.highlightMatches(matches);

    // Update widget
    this.updateWidget();

    // Save state
    window.Debunked.Bingo.saveState();

    // Pulse animation if new matches found
    if (matches.length > 0) {
      const pill = this.widgetEl.querySelector('#debunked-widget-pill');
      pill.classList.add('pulse');
      setTimeout(() => pill.classList.remove('pulse'), 600);
    }

    // Check for BINGO or BLACKOUT
    if (window.Debunked.Bingo.isBlackout()) {
      this.showNotification('BLACKOUT! Every square filled!');
    } else if (window.Debunked.Bingo.card.bingos.length > 0 && newFills > 0) {
      this.showNotification('BINGO! You got a line!');
    }
  },

  updateWidget() {
    const countEl = this.widgetEl.querySelector('#debunked-widget-count');
    const gridEl = this.widgetEl.querySelector('#debunked-mini-grid');
    countEl.textContent = `${window.Debunked.Bingo.getFilledCount()}/24`;
    gridEl.innerHTML = this.renderMiniGrid();
    this.expandedEl.innerHTML = this.renderExpandedCard();
  },

  showNotification(message) {
    const notif = document.createElement('div');
    notif.style.cssText = `
      position: fixed; top: 20px; right: 20px; z-index: 2147483647;
      background: #1a1a2e; color: #ffc107; padding: 16px 24px;
      border-radius: 12px; font-family: sans-serif; font-size: 18px;
      font-weight: 700; box-shadow: 0 8px 24px rgba(0,0,0,0.4);
      animation: debunked-pulse 0.6s ease-in-out;
    `;
    notif.textContent = message;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 3000);
  },

  setupDrag() {
    const pill = this.widgetEl;
    pill.addEventListener('mousedown', (e) => {
      if (e.target.closest('#debunked-widget-pill')) {
        this.isDragging = true;
        this.dragOffset = {
          x: e.clientX - pill.getBoundingClientRect().left,
          y: e.clientY - pill.getBoundingClientRect().top
        };
        e.preventDefault();
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      pill.style.position = 'fixed';
      pill.style.left = (e.clientX - this.dragOffset.x) + 'px';
      pill.style.top = (e.clientY - this.dragOffset.y) + 'px';
      pill.style.right = 'auto';
      pill.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
      this.isDragging = false;
    });
  }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.Debunked.Widget.init());
} else {
  window.Debunked.Widget.init();
}
```

**Step 2: Test by loading extension**

Load extension in Chrome, visit a news article or opinion site. Verify:
- Floating pill appears in bottom-right
- Mini grid shows filled squares
- Clicking pill opens expanded Bingo card
- Highlights appear on matched text
- Count updates correctly

**Step 3: Commit**

```bash
git add extension/src/content/widget.js
git commit -m "feat: add floating mini-widget with Bingo card, scanning, and drag support"
```

---

### Task 6: Extension Popup UI

**Files:**
- Create: `extension/src/popup/popup.html`
- Create: `extension/src/popup/popup.css`
- Create: `extension/src/popup/popup.js`

**Step 1: Create popup HTML**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Debunked</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="popup-container">
    <header>
      <h1>Debunked</h1>
      <p class="subtitle">Fake News Bingo</p>
    </header>

    <div id="bingo-card">
      <div id="bingo-grid"></div>
      <div id="score-bar">
        <span id="score-text">0/24</span>
        <span id="bingo-status"></span>
      </div>
    </div>

    <div id="matches-list">
      <h3>Detected Patterns</h3>
      <ul id="matches-ul"></ul>
    </div>

    <div class="actions">
      <button id="share-btn" class="btn btn-primary">Share to X</button>
      <button id="new-card-btn" class="btn btn-secondary">New Card</button>
    </div>

    <footer>
      <button id="settings-btn" class="btn-link">Settings</button>
    </footer>
  </div>

  <script src="popup.js"></script>
</body>
</html>
```

**Step 2: Create popup CSS**

Style the popup to be 380px wide with the dark theme matching the widget. Full 5x5 Bingo grid with square cells, color coding for filled/bingo-line states. Matches list below the grid showing detected patterns. Share and New Card action buttons.

Key styles:
- `body`: `width: 380px`, dark background `#1a1a2e`, white text
- `.bingo-grid`: CSS Grid `5x5`, gap `4px`
- `.bingo-cell`: square aspect ratio, centered text, `#2a2a4a` background
- `.bingo-cell.filled`: green background `#4caf50`
- `.bingo-cell.free`: gold background `#ffc107`
- `.btn-primary`: gold button matching brand
- Matches list: scrollable, each item shows category icon and matched text

**Step 3: Create popup JS**

```javascript
document.addEventListener('DOMContentLoaded', async () => {
  // Load bingo card state from storage
  const stored = await chrome.storage.local.get('bingoCard');
  const card = stored.bingoCard;

  if (card) {
    renderGrid(card);
    renderScore(card);
    renderMatches(card);
  } else {
    document.getElementById('bingo-grid').innerHTML = '<p>Visit a page to start detecting patterns!</p>';
  }

  // Share button
  document.getElementById('share-btn').addEventListener('click', () => shareCard(card));

  // New card button
  document.getElementById('new-card-btn').addEventListener('click', async () => {
    await chrome.storage.local.remove('bingoCard');
    // Notify content script to regenerate
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { action: 'newCard' });
    }
    window.close();
  });
});

function renderGrid(card) {
  const grid = document.getElementById('bingo-grid');
  grid.innerHTML = '';
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const cell = card.grid[r][c];
      const div = document.createElement('div');
      div.className = 'bingo-cell';
      if (cell.category === 'free') div.classList.add('free');
      else if (cell.filled) div.classList.add('filled');

      // Check bingo lines
      const inBingo = card.bingos.some(b => {
        if (b.startsWith('row-') && parseInt(b.split('-')[1]) === r) return true;
        if (b.startsWith('col-') && parseInt(b.split('-')[1]) === c) return true;
        if (b === 'diag-1' && r === c) return true;
        if (b === 'diag-2' && r + c === 4) return true;
        return false;
      });
      if (inBingo) div.classList.add('bingo-line');

      div.textContent = cell.label;
      if (cell.matches.length > 1) {
        const badge = document.createElement('span');
        badge.className = 'match-count';
        badge.textContent = cell.matches.length;
        div.appendChild(badge);
      }
      div.title = cell.description || cell.label;
      grid.appendChild(div);
    }
  }
}

function renderScore(card) {
  const filled = card.grid.flat().filter(c => c.filled).length;
  document.getElementById('score-text').textContent = `${filled}/25`;
  const status = document.getElementById('bingo-status');
  if (filled === 25) {
    status.textContent = 'BLACKOUT!';
    status.className = 'blackout';
  } else if (card.bingos.length > 0) {
    status.textContent = `BINGO x${card.bingos.length}!`;
    status.className = 'bingo';
  }
}

function renderMatches(card) {
  const ul = document.getElementById('matches-ul');
  ul.innerHTML = '';
  const allMatches = card.grid.flat().flatMap(c => c.matches);
  // Deduplicate and show unique matched texts
  const seen = new Set();
  for (const m of allMatches) {
    const key = `${m.category}-${m.matched}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const li = document.createElement('li');
    li.innerHTML = `<span class="category-tag">${m.category.replace('_', ' ')}</span> "${m.matched}"`;
    ul.appendChild(li);
  }
  if (allMatches.length === 0) {
    ul.innerHTML = '<li class="empty">No patterns detected on this page yet.</li>';
  }
}

async function shareCard(card) {
  if (!card) return;

  // Render bingo card to canvas
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 700;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, 600, 700);

  // Title
  ctx.fillStyle = '#ffc107';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('DEBUNKED', 300, 40);
  ctx.fillStyle = '#aaa';
  ctx.font = '14px sans-serif';
  ctx.fillText('Fake News Bingo', 300, 60);

  // Grid
  const cellSize = 100;
  const gridX = 50;
  const gridY = 80;
  const gap = 4;

  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const cell = card.grid[r][c];
      const x = gridX + c * (cellSize + gap);
      const y = gridY + r * (cellSize + gap);

      // Cell background
      if (cell.category === 'free') ctx.fillStyle = '#ffc107';
      else if (cell.filled) ctx.fillStyle = '#4caf50';
      else ctx.fillStyle = '#2a2a4a';

      ctx.beginPath();
      ctx.roundRect(x, y, cellSize, cellSize, 6);
      ctx.fill();

      // Cell text
      ctx.fillStyle = cell.filled || cell.category === 'free' ? '#fff' : '#888';
      ctx.font = cell.category === 'free' ? 'bold 14px sans-serif' : '10px sans-serif';
      ctx.textAlign = 'center';

      // Word wrap
      const words = cell.label.split(' ');
      let lines = [];
      let currentLine = '';
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (ctx.measureText(testLine).width > cellSize - 10) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      lines.push(currentLine);

      const lineHeight = 13;
      const startY = y + (cellSize - lines.length * lineHeight) / 2 + lineHeight;
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], x + cellSize / 2, startY + i * lineHeight);
      }
    }
  }

  // Score
  const filled = card.grid.flat().filter(c => c.filled).length;
  ctx.fillStyle = '#e0e0e0';
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${filled}/25 patterns detected | ${card.bingos.length} bingos`, 300, 620);

  // Branding
  ctx.fillStyle = '#666';
  ctx.font = '12px sans-serif';
  ctx.fillText('debunked.app | #Debunked', 300, 660);

  // Convert to blob and open share
  canvas.toBlob(async (blob) => {
    const item = new ClipboardItem({ 'image/png': blob });
    await navigator.clipboard.write([item]);

    const text = `This article hit ${filled - 1} misinformation tropes! #Debunked`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(twitterUrl, '_blank');
  }, 'image/png');
}
```

**Step 4: Commit**

```bash
git add extension/src/popup/popup.html extension/src/popup/popup.css extension/src/popup/popup.js
git commit -m "feat: add extension popup with Bingo grid, match list, and share to X"
```

---

### Task 7: Service Worker (Background Script)

**Files:**
- Create: `extension/src/background/service-worker.js`

**Step 1: Create the service worker**

Handles pattern DB updates, message passing, and AI analysis requests.

```javascript
const BACKEND_URL = 'https://debunked-backend.up.railway.app'; // Update after deploy
const UPDATE_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

// On install, fetch latest patterns
chrome.runtime.onInstalled.addListener(async () => {
  await updatePatternDB();
  // Set up periodic updates
  chrome.alarms.create('updatePatterns', { periodInMinutes: 24 * 60 });
});

// Periodic pattern updates
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'updatePatterns') {
    await updatePatternDB();
  }
});

// Message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'analyzeText') {
    analyzeWithAI(message.text).then(sendResponse);
    return true; // async response
  }
  if (message.action === 'getPatterns') {
    chrome.storage.local.get('patternDB').then(sendResponse);
    return true;
  }
});

async function updatePatternDB() {
  try {
    const stored = await chrome.storage.local.get('patternDB');
    const headers = {};
    if (stored.patternDB?.etag) {
      headers['If-None-Match'] = stored.patternDB.etag;
    }

    const resp = await fetch(`${BACKEND_URL}/api/patterns`, { headers });
    if (resp.status === 304) return; // Not modified
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const data = await resp.json();
    const etag = resp.headers.get('ETag');
    await chrome.storage.local.set({
      patternDB: { ...data, etag, lastUpdated: Date.now() }
    });
    console.log('[Debunked] Pattern DB updated:', data.patterns.length, 'patterns');
  } catch (err) {
    console.warn('[Debunked] Failed to update pattern DB, using cached version:', err.message);
  }
}

async function analyzeWithAI(text) {
  try {
    const resp = await fetch(`${BACKEND_URL}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.slice(0, 3000) }) // Limit text length
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } catch (err) {
    console.warn('[Debunked] AI analysis failed:', err.message);
    return { fallacies: [] };
  }
}
```

**Step 2: Add `alarms` permission to manifest.json**

Add `"alarms"` to the `permissions` array in `extension/manifest.json`.

**Step 3: Commit**

```bash
git add extension/src/background/service-worker.js extension/manifest.json
git commit -m "feat: add service worker with pattern DB updates and AI analysis proxy"
```

---

### Task 8: Backend — Pattern & Analysis Routes

**Files:**
- Create: `backend/routes/patterns.js`
- Create: `backend/routes/analyze.js`
- Modify: `backend/server.js` (wire up routes)
- Create: `backend/data/patterns.json` (copy from extension)

**Step 1: Create patterns route**

```javascript
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const router = express.Router();

router.get('/', (req, res) => {
  const dbPath = path.join(__dirname, '..', 'data', 'patterns.json');
  const data = fs.readFileSync(dbPath, 'utf-8');
  const etag = crypto.createHash('md5').update(data).digest('hex');

  // ETag caching
  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end();
  }

  res.set('ETag', etag);
  res.set('Cache-Control', 'public, max-age=3600');
  res.json(JSON.parse(data));
});

module.exports = router;
```

**Step 2: Create analyze route**

```javascript
const express = require('express');
const router = express.Router();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

router.post('/', async (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text field is required' });
  }

  if (!OPENROUTER_API_KEY) {
    return res.status(503).json({ error: 'AI analysis not configured' });
  }

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
          {
            role: 'system',
            content: `You are a media literacy analyst. Analyze the following text for logical fallacies and misinformation patterns. Return a JSON array of detected issues. Each item should have: "category" (one of: cherry_picking, straw_man, slippery_slope, whataboutism, false_equivalence, appeal_to_emotion, bandwagon, red_herring), "matched" (the relevant quote from the text), "description" (brief explanation of why this is a fallacy), "severity" (1-5). Return ONLY the JSON array, no other text.`
          },
          {
            role: 'user',
            content: text.slice(0, 3000)
          }
        ],
        max_tokens: 1000,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter returned ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '[]';

    // Parse the AI response — it should be a JSON array
    let fallacies;
    try {
      fallacies = JSON.parse(content);
    } catch {
      // If AI didn't return valid JSON, try to extract JSON from the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      fallacies = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    }

    res.json({ fallacies });
  } catch (err) {
    console.error('[Debunked] AI analysis error:', err.message);
    res.status(500).json({ error: 'Analysis failed', fallacies: [] });
  }
});

module.exports = router;
```

**Step 3: Wire up routes in server.js**

Update `backend/server.js` to import and use the routes:

```javascript
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const patternsRouter = require('./routes/patterns');
const analyzeRouter = require('./routes/analyze');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50kb' }));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later' }
}));

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/patterns', patternsRouter);
app.use('/api/analyze', analyzeRouter);

app.listen(PORT, () => {
  console.log(`[Debunked] Backend running on port ${PORT}`);
});
```

**Step 4: Copy patterns.json to backend/data/**

Copy `extension/data/patterns.json` to `backend/data/patterns.json` so the backend can serve it.

**Step 5: Commit**

```bash
git add backend/
git commit -m "feat: add backend routes for pattern serving and AI analysis proxy"
```

---

### Task 9: Extension Icons & Assets

**Files:**
- Create: `extension/src/assets/icon16.png`
- Create: `extension/src/assets/icon48.png`
- Create: `extension/src/assets/icon128.png`

**Step 1: Generate extension icons**

Create simple SVG-based icons for Debunked using Canvas API in a Node.js script. The icon should be a stylized "D" with a bingo grid overlay, or a magnifying glass with a checkmark, in the gold `#ffc107` and dark `#1a1a2e` color scheme.

Alternatively, create placeholder colored squares with "D" text at 16x16, 48x48, and 128x128 sizes. These can be replaced with designed icons later.

**Step 2: Commit**

```bash
git add extension/src/assets/
git commit -m "feat: add extension icons"
```

---

### Task 10: Backend Dockerfile & Railway Config

**Files:**
- Create: `backend/Dockerfile`
- Create: `backend/.dockerignore`

**Step 1: Create Dockerfile**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

**Step 2: Create .dockerignore**

```
node_modules
.env
*.md
```

**Step 3: Commit**

```bash
git add backend/Dockerfile backend/.dockerignore
git commit -m "feat: add Dockerfile for Railway deployment"
```

---

### Task 11: Integration Testing & Polish

**Step 1: Install backend dependencies and test locally**

```bash
cd backend && npm install && npm run dev
```

In another terminal, test the endpoints:
```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/patterns
```

**Step 2: Load extension in Chrome and end-to-end test**

1. Go to `chrome://extensions` → Developer mode → Load unpacked → select `extension/` folder
2. Visit various news/opinion sites
3. Verify: floating widget appears, patterns are detected and highlighted, Bingo card fills, popup shows correct state
4. Test "New Card" button
5. Test "Share to X" button (should copy image and open Twitter compose)

**Step 3: Fix any issues found during testing**

**Step 4: Final commit**

```bash
git add -A
git commit -m "fix: integration testing fixes and polish"
```

---

### Task 12: Popup CSS (Complete Styles)

**Files:**
- Create: `extension/src/popup/popup.css`

**Step 1: Write complete popup styles**

```css
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  width: 380px;
  min-height: 500px;
  background: #1a1a2e;
  color: #e0e0e0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.popup-container {
  padding: 16px;
}

header {
  text-align: center;
  margin-bottom: 16px;
}

header h1 {
  color: #ffc107;
  font-size: 24px;
  font-weight: 800;
  letter-spacing: 2px;
}

header .subtitle {
  color: #888;
  font-size: 12px;
  margin-top: 2px;
}

#bingo-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
  margin-bottom: 8px;
}

.bingo-cell {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #2a2a4a;
  border-radius: 6px;
  font-size: 9px;
  text-align: center;
  padding: 4px;
  word-break: break-word;
  line-height: 1.2;
  position: relative;
  cursor: default;
  transition: background-color 0.2s;
}

.bingo-cell.filled {
  background: #4caf50;
  color: white;
  font-weight: 600;
}

.bingo-cell.free {
  background: #ffc107;
  color: #1a1a2e;
  font-weight: 700;
  font-size: 11px;
}

.bingo-cell.bingo-line {
  box-shadow: 0 0 0 2px #ffc107;
}

.match-count {
  position: absolute;
  top: 2px;
  right: 4px;
  background: #ff5722;
  color: white;
  font-size: 8px;
  font-weight: 700;
  border-radius: 50%;
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

#score-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  font-size: 14px;
}

#score-text { color: #aaa; }

.bingo { color: #ffc107; font-weight: 700; }
.blackout { color: #ff5722; font-weight: 700; font-size: 16px; }

#matches-list {
  margin: 12px 0;
  max-height: 150px;
  overflow-y: auto;
}

#matches-list h3 {
  font-size: 13px;
  color: #888;
  margin-bottom: 8px;
}

#matches-ul {
  list-style: none;
}

#matches-ul li {
  padding: 6px 0;
  border-bottom: 1px solid #2a2a4a;
  font-size: 12px;
}

#matches-ul li.empty {
  color: #666;
  font-style: italic;
}

.category-tag {
  display: inline-block;
  background: #2a2a4a;
  color: #ffc107;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  margin-right: 4px;
}

.actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.btn {
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn:hover { opacity: 0.85; }

.btn-primary {
  background: #ffc107;
  color: #1a1a2e;
}

.btn-secondary {
  background: #2a2a4a;
  color: #e0e0e0;
}

.btn-link {
  background: none;
  border: none;
  color: #666;
  font-size: 12px;
  cursor: pointer;
  padding: 8px 0;
}

.btn-link:hover { color: #aaa; }

footer {
  text-align: center;
  margin-top: 8px;
}

/* Scrollbar styling */
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #444; border-radius: 2px; }
```

**Step 2: Commit**

```bash
git add extension/src/popup/popup.css
git commit -m "feat: add complete popup styles with dark theme"
```

---

## Summary

| Task | Description | Est. Files |
|------|-------------|------------|
| 1 | Project scaffolding, manifest, pattern DB, backend skeleton | 5 |
| 2 | Pattern matching engine (patterns.js, scanner.js) | 2 |
| 3 | Bingo card logic (generation, state, win detection) | 1 |
| 4 | DOM highlighter + content CSS | 2 |
| 5 | Floating mini-widget (main content script entry point) | 1 |
| 6 | Extension popup (HTML, CSS, JS) | 3 |
| 7 | Service worker (pattern updates, message passing) | 1 |
| 8 | Backend routes (patterns, analyze) + server wiring | 4 |
| 9 | Extension icons/assets | 3 |
| 10 | Backend Dockerfile + Railway config | 2 |
| 11 | Integration testing + polish | 0 |
| 12 | Complete popup CSS | 1 |

**Total: 12 tasks, ~25 files**
