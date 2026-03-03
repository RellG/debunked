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
