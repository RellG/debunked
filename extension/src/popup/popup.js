document.addEventListener('DOMContentLoaded', async () => {
  const statusCard = document.getElementById('status-card');
  const statusText = document.getElementById('status-text');
  const analyzeBtn = document.getElementById('analyze-btn');
  const analyzeBtnText = analyzeBtn.querySelector('span');

  document.getElementById('settings-btn').addEventListener('click', () => {
    window.location.href = '../settings/settings.html';
  });

  // Dynamic version
  const versionEl = document.getElementById('version-text');
  versionEl.textContent = 'v' + chrome.runtime.getManifest().version;

  // Rate limit display
  const rateLimitInfo = document.getElementById('rate-limit-info');
  let isRateLimited = false;
  try {
    const { rateLimitRemaining, rateLimitDate } = await chrome.storage.local.get(['rateLimitRemaining', 'rateLimitDate']);
    const today = new Date().toISOString().slice(0, 10);
    if (rateLimitDate === today && rateLimitRemaining !== undefined) {
      const used = 10 - rateLimitRemaining;
      rateLimitInfo.textContent = `${used}/10 analyses today`;
      rateLimitInfo.style.display = 'block';
      if (rateLimitRemaining === 0) {
        isRateLimited = true;
        rateLimitInfo.textContent = 'Daily limit reached (10/10). Resets at midnight.';
        rateLimitInfo.classList.add('limit-reached');
        analyzeBtn.disabled = true;
        analyzeBtnText.textContent = 'Limit Reached';
        setStatus('empty', 'Daily analysis limit reached.');
      }
    }
  } catch { /* ignore */ }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (tab) {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getAnalysis' });

      if (response?.isAnalyzing) {
        setStatus('analyzing', 'Analyzing page content...');
        analyzeBtn.disabled = true;
        analyzeBtn.classList.add('loading');
        analyzeBtnText.textContent = 'Analyzing...';
      } else if (response?.analysis) {
        const a = response.analysis;
        const total = a.claims.length;
        const issues = a.claims.filter(c =>
          ['misleading', 'false', 'unverified'].includes(c.verdict)
        ).length;

        if (issues === 0) {
          setStatus('done', `${total} claim${total !== 1 ? 's' : ''} checked — all clear.`);
        } else {
          setStatus('done', `${total} claim${total !== 1 ? 's' : ''} analyzed, ${issues} issue${issues !== 1 ? 's' : ''} found.`);
        }
        analyzeBtnText.textContent = 'Re-analyze';
      } else {
        setStatus('empty', 'No analysis yet for this page.');
      }
    } catch {
      setStatus('empty', 'Open a page to start fact-checking.');
    }
  }

  analyzeBtn.addEventListener('click', async () => {
    analyzeBtn.disabled = true;
    analyzeBtn.classList.add('loading');
    analyzeBtnText.textContent = 'Analyzing...';
    setStatus('analyzing', 'Sending content to AI...');

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { action: 'analyze' }).catch(() => {});
    }

    setTimeout(() => window.close(), 600);
  });

  function setStatus(state, text) {
    statusCard.className = state;
    statusText.textContent = text;
  }
});
