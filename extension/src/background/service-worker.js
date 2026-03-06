const BACKEND_URL = 'https://debunked-production.up.railway.app';

// Update domain list periodically
chrome.runtime.onInstalled.addListener(async () => {
  await updateDomains();
  chrome.alarms.create('updateDomains', { periodInMinutes: 24 * 60 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'updateDomains') {
    await updateDomains();
  }
});

// Message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'analyzeContent') {
    analyzeContent(message.payload).then(sendResponse);
    return true;
  }

  if (message.action === 'shareAnalysis') {
    shareAnalysis(message.payload).then(sendResponse);
    return true;
  }

  if (message.action === 'analysisStarted') {
    // Set icon to "analyzing" state
    if (sender.tab?.id) {
      chrome.action.setBadgeText({ text: '...', tabId: sender.tab.id });
      chrome.action.setBadgeBackgroundColor({ color: '#666', tabId: sender.tab.id });
    }
  }

  if (message.action === 'analysisComplete') {
    if (sender.tab?.id) {
      const text = message.issueCount > 0 ? String(message.issueCount) : '';
      const colors = { green: '#4caf50', yellow: '#ff9800', red: '#f44336' };
      chrome.action.setBadgeText({ text, tabId: sender.tab.id });
      chrome.action.setBadgeBackgroundColor({
        color: colors[message.verdict] || '#666',
        tabId: sender.tab.id
      });
    }
  }

  if (message.action === 'analysisEmpty' || message.action === 'analysisFailed') {
    if (sender.tab?.id) {
      chrome.action.setBadgeText({ text: '', tabId: sender.tab.id });
    }
  }

  return false;
});

async function analyzeContent(payload) {
  try {
    const resp = await fetch(`${BACKEND_URL}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } catch (err) {
    console.error('[Debunked] Backend analysis failed:', err.message);
    return {
      overallVerdict: 'yellow',
      summary: 'Analysis temporarily unavailable. Please try again.',
      claims: [],
      fallacies: []
    };
  }
}

async function shareAnalysis(payload) {
  try {
    const resp = await fetch(`${BACKEND_URL}/api/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } catch (err) {
    console.error('[Debunked] Share failed:', err.message);
    return { error: err.message };
  }
}

async function updateDomains() {
  try {
    const resp = await fetch(`${BACKEND_URL}/api/domains`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    await chrome.storage.local.set({ domainList: data });
    console.log('[Debunked] Domain list updated:', data.domains?.length, 'domains');
  } catch (err) {
    console.warn('[Debunked] Failed to update domains:', err.message);
  }
}
