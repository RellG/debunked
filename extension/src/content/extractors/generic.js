window.Debunked = window.Debunked || {};
window.Debunked.Extractors = window.Debunked.Extractors || {};

window.Debunked.Extractors.generic = {
  canExtract() {
    return true; // Always available as fallback
  },

  extract() {
    const body = document.body;
    if (!body) return null;

    // Try multiple selectors for the main content area
    const mainSelectors = [
      'main',
      '[role="main"]',
      '#content',
      '#main-content',
      '.main-content',
      '.page-content',
      '.content-area',
      '.entry-content',
      '.post-body',
      '.story',
      '.article',
      '.content'
    ];

    let main = null;
    for (const sel of mainSelectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim().length > 200) {
        main = el;
        break;
      }
    }

    if (!main) main = body;

    const clone = main.cloneNode(true);
    clone.querySelectorAll([
      'script', 'style', 'nav', 'aside', 'header', 'footer',
      '.ad', '.sidebar', '.menu', '.nav', '.navigation',
      '.social-share', '.comments', '.related', '.newsletter',
      '[aria-label="advertisement"]', '[data-ad]',
      '.cookie-banner', '.popup', '.modal'
    ].join(', ')).forEach(el => el.remove());

    // Get headline if available
    const headline = document.querySelector('h1')?.textContent?.trim() || '';

    const text = clone.textContent?.trim() || '';
    if (text.length < 200) return null;

    const content = headline ? `${headline}\n\n${text}` : text;

    return {
      type: 'generic',
      content: content.slice(0, 6000)
    };
  }
};
