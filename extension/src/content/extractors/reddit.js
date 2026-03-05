window.Debunked = window.Debunked || {};
window.Debunked.Extractors = window.Debunked.Extractors || {};

window.Debunked.Extractors.reddit = {
  canExtract() {
    return window.location.hostname.includes('reddit.com');
  },

  extract() {
    const titleEl = document.querySelector('h1, [data-testid="post-title"], shreddit-post');
    const title = titleEl?.textContent?.trim() || '';

    const bodyEl = document.querySelector('[data-testid="post-content"], .RichTextJSON-root, [slot="text-body"]');
    const body = bodyEl?.textContent?.trim() || '';

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
