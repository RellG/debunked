window.Debunked = window.Debunked || {};
window.Debunked.Extractors = window.Debunked.Extractors || {};

window.Debunked.Extractors.generic = {
  canExtract() {
    return true;
  },

  extract() {
    const body = document.body;
    if (!body) return null;

    const main = document.querySelector('main, [role="main"], #content, .content, #main-content') || body;

    const clone = main.cloneNode(true);
    clone.querySelectorAll('script, style, nav, aside, header, footer, .ad, .sidebar, .menu, .nav').forEach(el => el.remove());

    const text = clone.textContent?.trim() || '';
    if (text.length < 200) return null;

    return {
      type: 'generic',
      content: text.slice(0, 6000)
    };
  }
};
