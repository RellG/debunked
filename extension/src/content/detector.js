window.Debunked = window.Debunked || {};

window.Debunked.Detector = {
  domains: [],
  analysisResult: null,
  isAnalyzing: false,
  loaderEl: null,

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
    const stored = await chrome.storage.local.get('domainList');
    if (stored.domainList && stored.domainList.domains) {
      this.domains = stored.domainList.domains;
      return;
    }
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
    const hostname = window.location.hostname.replace(/^www\./, '');
    return this.domains.some(d => hostname === d || hostname.endsWith('.' + d));
  },

  detectPageType() {
    const extractors = window.Debunked.Extractors;
    if (extractors.youtube.canExtract()) return 'youtube';
    if (extractors.twitter.canExtract()) return 'twitter';
    if (extractors.reddit.canExtract()) return 'reddit';
    if (extractors.article.canExtract()) return 'article';
    return 'generic';
  },

  async extractContent() {
    const type = this.detectPageType();
    const extractor = window.Debunked.Extractors[type];
    const result = type === 'youtube' ? await extractor.extract() : extractor.extract();
    return result;
  },

  // --- Loading Indicator ---
  showLoader() {
    if (this.loaderEl) return;
    this.loaderEl = document.createElement('div');
    this.loaderEl.id = 'debunked-loader';
    this.loaderEl.innerHTML = `
      <div class="debunked-loader-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" stroke="currentColor" stroke-width="1.5" fill="none"/>
          <path d="M8.5 12.5L11 15l5-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        </svg>
      </div>
      <span class="debunked-loader-text">Debunked is analyzing this page...</span>
      <div class="debunked-loader-progress"></div>
    `;
    document.body.appendChild(this.loaderEl);
    // Trigger entrance animation
    requestAnimationFrame(() => this.loaderEl.classList.add('visible'));
  },

  updateLoader(text) {
    if (!this.loaderEl) return;
    const textEl = this.loaderEl.querySelector('.debunked-loader-text');
    if (textEl) textEl.textContent = text;
  },

  hideLoader() {
    if (!this.loaderEl) return;
    this.loaderEl.classList.remove('visible');
    this.loaderEl.classList.add('hiding');
    setTimeout(() => {
      this.loaderEl?.remove();
      this.loaderEl = null;
    }, 400);
  },

  async analyze() {
    if (this.isAnalyzing) return;
    this.isAnalyzing = true;

    this.showLoader();
    chrome.runtime.sendMessage({ action: 'analysisStarted' });

    try {
      this.updateLoader('Extracting page content...');
      const extracted = await this.extractContent();
      if (!extracted) {
        this.isAnalyzing = false;
        this.hideLoader();
        chrome.runtime.sendMessage({ action: 'analysisEmpty' });
        return;
      }

      this.updateLoader('Sending to AI for fact-checking...');

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
        this.updateLoader(`Found ${response.claims.length} claims. Rendering results...`);

        // Small delay so users see the final status before sidebar opens
        await new Promise(r => setTimeout(r, 600));

        window.Debunked.Highlighter.highlightClaims(response.claims);
        window.Debunked.Sidebar.render(response);

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
      this.hideLoader();
    }
  }
};

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.Debunked.Detector.init());
} else {
  window.Debunked.Detector.init();
}
