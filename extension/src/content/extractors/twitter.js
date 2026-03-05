window.Debunked = window.Debunked || {};
window.Debunked.Extractors = window.Debunked.Extractors || {};

window.Debunked.Extractors.twitter = {
  canExtract() {
    const host = window.location.hostname;
    return host === 'twitter.com' || host === 'x.com' || host.endsWith('.twitter.com') || host.endsWith('.x.com');
  },

  extract() {
    const tweets = [];
    const tweetEls = document.querySelectorAll('[data-testid="tweetText"]');
    tweetEls.forEach(el => {
      const text = el.textContent?.trim();
      if (text) tweets.push(text);
    });

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
