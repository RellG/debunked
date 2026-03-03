window.Debunked = window.Debunked || {};

window.Debunked.Highlighter = {
  highlighted: [],

  highlightMatches(matches) {
    this.clearHighlights();

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
          if (parent.classList.contains('debunked-highlight')) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) {
      textNodes.push(node);
    }

    for (const textNode of textNodes) {
      const text = textNode.textContent;
      for (const match of matches) {
        const idx = text.toLowerCase().indexOf(match.matched.toLowerCase());
        if (idx === -1) continue;

        const range = document.createRange();
        range.setStart(textNode, idx);
        range.setEnd(textNode, idx + match.matched.length);

        const mark = document.createElement('mark');
        mark.className = 'debunked-highlight';
        mark.dataset.category = match.category;
        mark.dataset.patternId = match.patternId;
        mark.title = `${match.description} [${match.category}]`;

        try {
          range.surroundContents(mark);
          this.highlighted.push(mark);
        } catch (e) {
          // Range may cross element boundaries — skip gracefully
        }
        break; // Only highlight first occurrence per text node
      }
    }
  },

  clearHighlights() {
    for (const mark of this.highlighted) {
      const parent = mark.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(mark.textContent), mark);
        parent.normalize();
      }
    }
    this.highlighted = [];
  }
};
