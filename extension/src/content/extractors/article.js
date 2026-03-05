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
