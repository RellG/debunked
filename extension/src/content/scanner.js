window.Debunked = window.Debunked || {};

window.Debunked.Scanner = {
  scan(textContent) {
    const matches = [];
    const localPatterns = window.Debunked.PatternManager.getLocalPatterns();

    for (const pattern of localPatterns) {
      let regex;
      if (pattern.type === 'regex') {
        regex = new RegExp(pattern.pattern, pattern.flags || 'gi');
      } else if (pattern.type === 'keyword') {
        regex = new RegExp(`\\b${escapeRegex(pattern.pattern)}\\b`, 'gi');
      } else if (pattern.type === 'phrase') {
        regex = new RegExp(escapeRegex(pattern.pattern), 'gi');
      }

      let match;
      while ((match = regex.exec(textContent)) !== null) {
        matches.push({
          patternId: pattern.id,
          category: pattern.category,
          matched: match[0],
          index: match.index,
          severity: pattern.severity,
          bingoLabel: pattern.bingoLabel,
          description: pattern.description
        });
      }
    }

    return matches;
  },

  getPageText() {
    const body = document.body;
    if (!body) return '';
    const clone = body.cloneNode(true);
    clone.querySelectorAll('script, style, noscript').forEach(el => el.remove());
    return clone.textContent || '';
  }
};

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
