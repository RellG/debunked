document.addEventListener('DOMContentLoaded', async () => {
  const statusEl = document.getElementById('status');
  const analyzeBtn = document.getElementById('analyze-btn');

  // Check if current tab has analysis results
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (tab) {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getAnalysis' });

      if (response?.isAnalyzing) {
        statusEl.textContent = 'Analyzing page...';
        statusEl.className = 'status-analyzing';
        analyzeBtn.disabled = true;
        analyzeBtn.textContent = 'Analyzing...';
      } else if (response?.analysis) {
        const a = response.analysis;
        const issueCount = a.claims.filter(c =>
          ['misleading', 'false', 'unverified'].includes(c.verdict)
        ).length;
        statusEl.textContent = `${a.claims.length} claims analyzed, ${issueCount} issue${issueCount !== 1 ? 's' : ''} found.`;
        statusEl.className = 'status-done';
        analyzeBtn.textContent = 'Re-analyze';
      } else {
        statusEl.textContent = 'No analysis yet for this page.';
        statusEl.className = 'status-empty';
      }
    } catch {
      statusEl.textContent = 'Navigate to a page to analyze.';
      statusEl.className = 'status-empty';
    }
  }

  analyzeBtn.addEventListener('click', async () => {
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'Analyzing...';
    statusEl.textContent = 'Sending to AI for analysis...';
    statusEl.className = 'status-analyzing';

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { action: 'analyze' }).catch(() => {});
    }

    // Close popup — results will appear in sidebar
    setTimeout(() => window.close(), 500);
  });
});
