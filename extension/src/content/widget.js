window.Debunked = window.Debunked || {};

window.Debunked.Widget = {
  widgetEl: null,
  expandedEl: null,
  isExpanded: false,
  isDragging: false,
  dragOffset: { x: 0, y: 0 },

  async init() {
    try {
      await window.Debunked.PatternManager.load();

      const loaded = await window.Debunked.Bingo.loadState();
      if (!loaded) {
        const categories = this.getUniqueCategories();
        if (categories.length === 0) {
          console.warn('[Debunked] No patterns loaded, skipping card generation');
          return;
        }
        window.Debunked.Bingo.generateCard(categories);
        await window.Debunked.Bingo.saveState();
      }

      this.createWidget();
      this.scanPage();
    } catch (err) {
      console.error('[Debunked] Failed to initialize:', err);
    }
  },

  getUniqueCategories() {
    const patterns = window.Debunked.PatternManager.patterns;
    if (!patterns || patterns.length === 0) return [];

    // Use each pattern's unique bingoLabel as a card entry
    const result = [];
    const seenLabels = new Set();
    for (const p of patterns) {
      if (!seenLabels.has(p.bingoLabel)) {
        seenLabels.add(p.bingoLabel);
        result.push({ category: p.category, bingoLabel: p.bingoLabel, description: p.description });
      }
    }

    // Pad with duplicates if needed (need 24 for the card)
    let i = 0;
    while (result.length < 24) {
      result.push({ ...result[i % result.length] });
      i++;
    }

    return result;
  },

  createWidget() {
    if (!document.body) return;

    this.widgetEl = document.createElement('div');
    this.widgetEl.id = 'debunked-widget';
    const filledCount = Math.max(0, window.Debunked.Bingo.getFilledCount() - 1);
    this.widgetEl.innerHTML = `
      <div id="debunked-widget-pill">
        <div id="debunked-mini-grid">${this.renderMiniGrid()}</div>
        <span id="debunked-widget-count">${filledCount}/24</span>
        <span style="font-size:11px;opacity:0.7">DEBUNKED</span>
      </div>
    `;
    document.body.appendChild(this.widgetEl);

    this.expandedEl = document.createElement('div');
    this.expandedEl.id = 'debunked-expanded';
    this.expandedEl.innerHTML = this.renderExpandedCard();
    document.body.appendChild(this.expandedEl);

    this.widgetEl.querySelector('#debunked-widget-pill').addEventListener('click', () => {
      this.toggleExpanded();
    });

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

    const filledCount = Math.max(0, window.Debunked.Bingo.getFilledCount() - 1);
    const bingosText = card.bingos.length > 0
      ? `BINGO x${card.bingos.length}!`
      : 'No bingos yet';

    return `
      <h3>Debunked Bingo</h3>
      <p class="score">${filledCount}/24 squares | ${bingosText}</p>
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

    let newFills = 0;
    for (const match of matches) {
      const result = window.Debunked.Bingo.addMatch(match);
      if (result && result.cell && result.newBingos.length > 0) {
        newFills++;
      }
    }

    window.Debunked.Highlighter.highlightMatches(matches);
    this.updateWidget();
    window.Debunked.Bingo.saveState().catch(err =>
      console.error('[Debunked] Failed to save state:', err)
    );

    if (matches.length > 0) {
      const pill = this.widgetEl.querySelector('#debunked-widget-pill');
      pill.classList.add('pulse');
      setTimeout(() => pill.classList.remove('pulse'), 600);
    }

    if (window.Debunked.Bingo.isBlackout()) {
      this.showNotification('BLACKOUT! Every square filled!');
    } else if (window.Debunked.Bingo.card.bingos.length > 0 && newFills > 0) {
      this.showNotification('BINGO! You got a line!');
    }
  },

  updateWidget() {
    const countEl = this.widgetEl.querySelector('#debunked-widget-count');
    const gridEl = this.widgetEl.querySelector('#debunked-mini-grid');
    const filledCount = Math.max(0, window.Debunked.Bingo.getFilledCount() - 1);
    countEl.textContent = `${filledCount}/24`;
    gridEl.innerHTML = this.renderMiniGrid();
    this.expandedEl.innerHTML = this.renderExpandedCard();
  },

  showNotification(message) {
    if (!document.body) return;
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
      const maxX = window.innerWidth - pill.offsetWidth;
      const maxY = window.innerHeight - pill.offsetHeight;
      pill.style.position = 'fixed';
      pill.style.left = Math.max(0, Math.min(e.clientX - this.dragOffset.x, maxX)) + 'px';
      pill.style.top = Math.max(0, Math.min(e.clientY - this.dragOffset.y, maxY)) + 'px';
      pill.style.right = 'auto';
      pill.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
      this.isDragging = false;
    });
  }
};

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'newCard') {
    window.Debunked.Bingo.clearCard();
    const categories = window.Debunked.Widget.getUniqueCategories();
    window.Debunked.Bingo.generateCard(categories);
    window.Debunked.Bingo.saveState().then(() => {
      window.Debunked.Widget.scanPage();
      sendResponse({ success: true });
    });
    return true;
  }
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.Debunked.Widget.init());
} else {
  window.Debunked.Widget.init();
}
