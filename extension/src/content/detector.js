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

  async analyze() {
    if (this.isAnalyzing) return;
    this.isAnalyzing = true;

    chrome.runtime.sendMessage({ action: 'analysisStarted' });

    try {
      const extracted = await this.extractContent();
      if (!extracted) {
        this.isAnalyzing = false;
        chrome.runtime.sendMessage({ action: 'analysisEmpty' });
        return;
      }

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
    }
  }
};

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.Debunked.Detector.init());
} else {
  window.Debunked.Detector.init();
}
