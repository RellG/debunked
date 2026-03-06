window.Debunked = window.Debunked || {};

window.Debunked.Sidebar = {
  sidebarEl: null,
  tabEl: null,
  isOpen: false,

  render(analysis) {
    if (!document.body) return;
    this.remove();
    this.createSidebar(analysis);
    this.createTab(analysis.overallVerdict);
  },

  createSidebar(analysis) {
    this.sidebarEl = document.createElement('div');
    this.sidebarEl.id = 'debunked-sidebar';

    const verdictText = {
      green: 'Content Verified',
      yellow: 'Mixed Accuracy',
      red: 'Issues Detected'
    };

    const verdictDesc = {
      green: 'Most claims in this content appear accurate.',
      yellow: 'Some claims need additional context or verification.',
      red: 'Significant factual concerns were identified.'
    };

    const verdict = analysis.overallVerdict || 'yellow';

    // Build confidence meter — 5 segments colored by claim distribution
    const claimStats = this.getClaimStats(analysis.claims);
    const meterHtml = this.buildMeter(claimStats);

    let claimsHtml = '';
    for (let i = 0; i < analysis.claims.length; i++) {
      const claim = analysis.claims[i];
      const verdictIcon = this.verdictIcon(claim.verdict);
      const sourcesHtml = (claim.sources && claim.sources.length > 0)
        ? `<div class="debunked-claim-sources">
            <span class="debunked-sources-label">Sources</span>
            <ul>${claim.sources.map(s => `<li>${this.escapeHtml(s)}</li>`).join('')}</ul>
          </div>`
        : '';

      claimsHtml += `
        <div class="debunked-claim-card" id="debunked-claim-${claim.id}">
          <div class="debunked-claim-verdict debunked-verdict-${claim.verdict}">
            ${verdictIcon} ${this.verdictBadge(claim.verdict)}
          </div>
          <blockquote class="debunked-claim-quote">${this.escapeHtml(claim.originalQuote || claim.text)}</blockquote>
          <p class="debunked-claim-explanation">${this.escapeHtml(claim.explanation)}</p>
          ${sourcesHtml}
        </div>
      `;
    }

    let fallaciesHtml = '';
    if (analysis.fallacies && analysis.fallacies.length > 0) {
      fallaciesHtml = `
        <div class="debunked-section">
          <h3 class="debunked-section-title">Fallacies Detected</h3>
          ${analysis.fallacies.map(f => `
            <div class="debunked-fallacy-card">
              <strong>${this.escapeHtml(f.type.replace(/_/g, ' '))}</strong>
              <p>${this.escapeHtml(f.explanation)}</p>
            </div>
          `).join('')}
        </div>
      `;
    }

    this.sidebarEl.innerHTML = `
      <div class="debunked-sidebar-header">
        <div class="debunked-sidebar-title">
          <span class="debunked-logo">DEBUNKED</span>
          <button class="debunked-close-btn" id="debunked-close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <div class="debunked-verdict-bar verdict-${verdict}">
          <span class="debunked-verdict-icon"><span class="debunked-verdict-dot"></span></span>
          <span>${verdictText[verdict] || 'Analysis Complete'}</span>
        </div>
        <p class="debunked-summary">${this.escapeHtml(analysis.summary)}</p>
        ${meterHtml}
      </div>
      <div class="debunked-sidebar-body">
        <div class="debunked-section">
          <h3 class="debunked-section-title">Claims Analyzed (${analysis.claims.length})</h3>
          ${claimsHtml || '<p class="debunked-empty">No verifiable factual claims detected in this content.</p>'}
        </div>
        ${fallaciesHtml}
      </div>
      <div class="debunked-sidebar-footer">
        <button class="debunked-share-btn" id="debunked-share">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          Share Fact-Check
        </button>
        <span class="debunked-footer-text">Powered by Debunked AI</span>
      </div>
    `;

    document.body.appendChild(this.sidebarEl);

    this.sidebarEl.querySelector('#debunked-close').addEventListener('click', () => {
      this.toggle();
    });

    // Share button
    this.sidebarEl.querySelector('#debunked-share').addEventListener('click', async () => {
      const btn = this.sidebarEl.querySelector('#debunked-share');
      btn.disabled = true;
      btn.textContent = 'Creating link...';
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'shareAnalysis',
          payload: { url: window.location.href, analysis }
        });
        if (response?.shareUrl) {
          await navigator.clipboard.writeText(response.shareUrl);
          btn.textContent = 'Link copied!';
          setTimeout(() => {
            btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg> Share Fact-Check`;
            btn.disabled = false;
          }, 2500);
        }
      } catch (err) {
        btn.textContent = 'Share failed';
        btn.disabled = false;
        console.error('[Debunked] Share failed:', err);
      }
    });

    // Stagger open for smooth feel
    requestAnimationFrame(() => {
      this.isOpen = true;
      this.sidebarEl.classList.add('open');
    });
  },

  getClaimStats(claims) {
    let green = 0, yellow = 0, red = 0;
    for (const c of claims) {
      if (c.verdict === 'true' || c.verdict === 'mostly_true') green++;
      else if (c.verdict === 'misleading' || c.verdict === 'unverified') yellow++;
      else if (c.verdict === 'false') red++;
    }
    return { green, yellow, red, total: claims.length };
  },

  buildMeter(stats) {
    if (stats.total === 0) return '';
    const segments = [];
    // Distribute 5 segments proportionally based on actual claim verdicts
    const total = stats.total;
    let greenSegs = Math.round((stats.green / total) * 5);
    let redSegs = Math.round((stats.red / total) * 5);
    let yellowSegs = Math.round((stats.yellow / total) * 5);

    // Adjust to exactly 5 segments — prioritize the largest group
    let sum = greenSegs + yellowSegs + redSegs;
    while (sum < 5) {
      if (stats.green >= stats.yellow && stats.green >= stats.red) greenSegs++;
      else if (stats.yellow >= stats.red) yellowSegs++;
      else redSegs++;
      sum++;
    }
    while (sum > 5) {
      if (greenSegs > 0 && stats.green <= stats.yellow && stats.green <= stats.red) greenSegs--;
      else if (yellowSegs > 0 && stats.yellow <= stats.red) yellowSegs--;
      else if (redSegs > 0) redSegs--;
      else if (yellowSegs > 0) yellowSegs--;
      else greenSegs--;
      sum--;
    }

    // Only show colored segments for categories that have claims
    for (let i = 0; i < greenSegs; i++) segments.push('<div class="debunked-meter-segment filled seg-green"></div>');
    for (let i = 0; i < yellowSegs; i++) segments.push('<div class="debunked-meter-segment filled seg-yellow"></div>');
    for (let i = 0; i < redSegs; i++) segments.push('<div class="debunked-meter-segment filled seg-red"></div>');

    return `<div class="debunked-confidence-meter">${segments.join('')}</div>`;
  },

  createTab(verdict) {
    this.tabEl = document.createElement('div');
    this.tabEl.id = 'debunked-tab';
    this.tabEl.className = `debunked-tab-${verdict}`;
    // Use an SVG shield icon instead of just "D"
    this.tabEl.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5zm-1 15l-4-4 1.41-1.41L11 14.17l6.59-6.59L19 9l-8 8z"/></svg>`;
    this.tabEl.title = 'Toggle Debunked sidebar';
    this.tabEl.addEventListener('click', () => this.toggle());
    document.body.appendChild(this.tabEl);
  },

  toggle() {
    this.isOpen = !this.isOpen;
    if (this.sidebarEl) {
      this.sidebarEl.classList.toggle('open', this.isOpen);
    }
  },

  scrollToClaim(claimId) {
    if (!this.isOpen) this.toggle();
    const el = this.sidebarEl?.querySelector(`#debunked-claim-${claimId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('debunked-flash');
      setTimeout(() => el.classList.remove('debunked-flash'), 1500);
    }
  },

  verdictBadge(verdict) {
    const labels = {
      true: 'Verified',
      mostly_true: 'Mostly True',
      misleading: 'Misleading',
      false: 'False',
      unverified: 'Unverified'
    };
    return labels[verdict] || verdict.toUpperCase();
  },

  verdictIcon(verdict) {
    const icons = {
      true: '<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M4.5 8.5L2 6l-.7.7L4.5 9.9l7-7-.7-.7z"/></svg>',
      mostly_true: '<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M4.5 8.5L2 6l-.7.7L4.5 9.9l7-7-.7-.7z"/></svg>',
      misleading: '<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M6 1L0.5 11h11L6 1zm0 3.5c.28 0 .5.22.5.5v2c0 .28-.22.5-.5.5s-.5-.22-.5-.5V5c0-.28.22-.5.5-.5zM5.5 9h1v1h-1V9z"/></svg>',
      false: '<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M9.5 3.2L8.8 2.5 6 5.3 3.2 2.5l-.7.7L5.3 6 2.5 8.8l.7.7L6 6.7l2.8 2.8.7-.7L6.7 6z"/></svg>',
      unverified: '<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><circle cx="6" cy="8.5" r=".75"/><path d="M6 1.5A2.5 2.5 0 003.5 4h1.25A1.25 1.25 0 016 2.75c.69 0 1.25.56 1.25 1.25 0 .69-.56 1.25-1.25 1.25-.35 0-.625.28-.625.625V7h1.25v-.56A2.5 2.5 0 006 1.5z"/></svg>'
    };
    return icons[verdict] || '';
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  remove() {
    this.sidebarEl?.remove();
    this.tabEl?.remove();
    this.sidebarEl = null;
    this.tabEl = null;
    this.isOpen = false;
  }
};
