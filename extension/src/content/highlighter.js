window.Debunked = window.Debunked || {};

window.Debunked.Highlighter = {
  highlights: [],

  highlightClaims(claims) {
    this.clearHighlights();

    for (const claim of claims) {
      if (!claim.originalQuote) continue;
      this.findAndHighlight(claim);
    }
  },

  findAndHighlight(claim) {
    const searchText = claim.originalQuote.toLowerCase();
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName.toLowerCase();
          if (['script', 'style', 'noscript', 'textarea', 'input'].includes(tag)) {
            return NodeFilter.FILTER_REJECT;
          }
          if (parent.classList.contains('debunked-claim')) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let node;
    while ((node = walker.nextNode())) {
      const nodeText = node.textContent.toLowerCase();
      const idx = nodeText.indexOf(searchText);
      if (idx === -1) continue;

      try {
        const range = document.createRange();
        range.setStart(node, idx);
        range.setEnd(node, idx + claim.originalQuote.length);

        const mark = document.createElement('mark');
        mark.className = `debunked-claim debunked-verdict-${claim.verdict}`;
        mark.dataset.claimId = claim.id;
        mark.title = `${this.verdictLabel(claim.verdict)}: ${claim.explanation}`;

        mark.addEventListener('click', () => {
          window.Debunked.Sidebar.scrollToClaim(claim.id);
        });

        range.surroundContents(mark);
        this.highlights.push(mark);
      } catch (e) {
        // Range may cross element boundaries
      }
      break; // Only highlight first occurrence
    }
  },

  verdictLabel(verdict) {
    const labels = {
      true: 'True',
      mostly_true: 'Mostly True',
      misleading: 'Misleading',
      false: 'False',
      unverified: 'Unverified'
    };
    return labels[verdict] || 'Unknown';
  },

  clearHighlights() {
    for (const mark of this.highlights) {
      const parent = mark.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(mark.textContent), mark);
        parent.normalize();
      }
    }
    this.highlights = [];
  }
};
