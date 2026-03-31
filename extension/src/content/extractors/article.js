window.Debunked = window.Debunked || {};
window.Debunked.Extractors = window.Debunked.Extractors || {};

window.Debunked.Extractors.article = {
  // Common article container selectors across major news sites
  ARTICLE_SELECTORS: [
    'article',
    '[role="article"]',
    '.article-body',
    '.story-body',
    '.post-content',
    '.entry-content',
    '.article-content',
    '.article__body',
    '.story-content',
    '.article-text',
    '.body-text',
    '.article__content',
    '.content-body',
    '.field-body',
    '.rich-text',
    '[data-testid="article-body"]',
    '[itemprop="articleBody"]',
    '.caas-body',               // Yahoo News
    '.paywall',                 // Generic paywall content
    '#article-body',
    '#story-body',
    '#content-body',
    '.pg-article',
    '.zn-body__paragraph',      // CNN
    '.article-page',
    '.story__content',
    '.RichTextStoryBody',        // AP News
    '.Page-content',             // AP News
    '.article-body-text',        // Various
    '[data-testid="storyBody"]'  // Various React news sites
  ],

  HEADLINE_SELECTORS: [
    'h1',
    '[data-testid="headline"]',
    '.headline',
    '.article-title',
    '.entry-title',
    '.story-title',
    '.pg-headline',
    '[itemprop="headline"]'
  ],

  AUTHOR_SELECTORS: [
    '[rel="author"]',
    '.author',
    '.byline',
    '.article-author',
    '.entry-author',
    '[itemprop="author"]',
    'meta[name="author"]',
    '.story-meta__authors',
    '[data-testid="byline"]',
    '.byline__name'
  ],

  canExtract() {
    // Check for any known article container
    for (const sel of this.ARTICLE_SELECTORS) {
      if (document.querySelector(sel)) return true;
    }
    // Also detect by meta tags common on news sites
    if (document.querySelector('meta[property="og:type"][content="article"]')) return true;
    if (document.querySelector('meta[name="news_keywords"]')) return true;
    if (document.querySelector('[itemtype*="NewsArticle"], [itemtype*="Article"]')) return true;
    return false;
  },

  extract() {
    // Find article body using priority list
    let article = null;
    for (const sel of this.ARTICLE_SELECTORS) {
      article = document.querySelector(sel);
      if (article) break;
    }

    // Fallback: look for structured data
    if (!article) {
      article = document.querySelector('[itemtype*="NewsArticle"], [itemtype*="Article"]');
    }

    if (!article) return null;

    // Get headline
    let headline = '';
    for (const sel of this.HEADLINE_SELECTORS) {
      const el = document.querySelector(sel);
      if (el?.textContent?.trim()) {
        headline = el.textContent.trim();
        break;
      }
    }

    // Get author
    let authorText = '';
    for (const sel of this.AUTHOR_SELECTORS) {
      const el = document.querySelector(sel);
      if (el) {
        authorText = el.textContent?.trim() || el.getAttribute('content') || '';
        if (authorText) break;
      }
    }

    // Get date
    const dateEl = document.querySelector('time, [datetime], .publish-date, .date, [itemprop="datePublished"], meta[property="article:published_time"]');
    const date = dateEl?.getAttribute('datetime') || dateEl?.getAttribute('content') || dateEl?.textContent?.trim() || '';

    // Clean and extract body text
    const clone = article.cloneNode(true);
    clone.querySelectorAll([
      'script', 'style', 'nav', 'aside', 'figure', 'figcaption',
      '.ad', '.advertisement', '.social-share', '.related-articles',
      '.newsletter-signup', '.comments', '.comment-section',
      '[data-ad]', '[aria-label="advertisement"]',
      '.promo', '.sidebar', '.share-tools', '.recirculation'
    ].join(', ')).forEach(el => el.remove());

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
