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

    const verdictColor = { green: '#4caf50', yellow: '#ff9800', red: '#f44336' };
    const verdictText = { green: 'Mostly Reliable', yellow: 'Mixed Accuracy', red: 'Significant Issues' };
    const color = verdictColor[analysis.overallVerdict] || verdictColor.yellow;

    let claimsHtml = '';
    for (const claim of analysis.claims) {
      claimsHtml += `
        <div class="debunked-claim-card" id="debunked-claim-${claim.id}">
          <div class="debunked-claim-verdict debunked-verdict-${claim.verdict}">
            ${this.verdictBadge(claim.verdict)}
          </div>
          <blockquote class="debunked-claim-quote">"${this.escapeHtml(claim.originalQuote || claim.text)}"</blockquote>
          <p class="debunked-claim-explanation">${this.escapeHtml(claim.explanation)}</p>
        </div>
      `;
    }

    let fallaciesHtml = '';
    if (analysis.fallacies && analysis.fallacies.length > 0) {
      fallaciesHtml = `
        <div class="debunked-section">
          <h3 class="debunked-section-title">Logical Fallacies</h3>
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
          <button class="debunked-close-btn" id="debunked-close">&times;</button>
        </div>
        <div class="debunked-verdict-bar" style="background:${color}">
          <span class="debunked-verdict-icon">${analysis.overallVerdict === 'green' ? '&#10003;' : analysis.overallVerdict === 'red' ? '&#10007;' : '&#9888;'}</span>
          <span>${verdictText[analysis.overallVerdict] || 'Analysis Complete'}</span>
        </div>
        <p class="debunked-summary">${this.escapeHtml(analysis.summary)}</p>
      </div>
      <div class="debunked-sidebar-body">
        <div class="debunked-section">
          <h3 class="debunked-section-title">Claims (${analysis.claims.length})</h3>
          ${claimsHtml || '<p class="debunked-empty">No factual claims detected.</p>'}
        </div>
        ${fallaciesHtml}
      </div>
      <div class="debunked-sidebar-footer">
        Powered by Debunked
      </div>
    `;

    document.body.appendChild(this.sidebarEl);

    this.sidebarEl.querySelector('#debunked-close').addEventListener('click', () => {
      this.toggle();
    });

    this.isOpen = true;
    this.sidebarEl.classList.add('open');
  },

  createTab(verdict) {
    this.tabEl = document.createElement('div');
    this.tabEl.id = 'debunked-tab';
    this.tabEl.className = `debunked-tab-${verdict}`;
    this.tabEl.textContent = 'D';
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
      setTimeout(() => el.classList.remove('debunked-flash'), 1000);
    }
  },

  verdictBadge(verdict) {
    const labels = {
      true: 'TRUE',
      mostly_true: 'MOSTLY TRUE',
      misleading: 'MISLEADING',
      false: 'FALSE',
      unverified: 'UNVERIFIED'
    };
    return labels[verdict] || verdict.toUpperCase();
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
