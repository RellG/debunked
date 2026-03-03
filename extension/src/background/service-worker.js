const BACKEND_URL = 'https://debunked-backend.up.railway.app'; // Update after deploy
const UPDATE_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

chrome.runtime.onInstalled.addListener(async () => {
  await updatePatternDB();
  chrome.alarms.create('updatePatterns', { periodInMinutes: 24 * 60 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'updatePatterns') {
    await updatePatternDB();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'analyzeText') {
    analyzeWithAI(message.text).then(sendResponse);
    return true;
  }
  if (message.action === 'getPatterns') {
    chrome.storage.local.get('patternDB').then(sendResponse);
    return true;
  }
});

async function updatePatternDB() {
  try {
    const stored = await chrome.storage.local.get('patternDB');
    const headers = {};
    if (stored.patternDB?.etag) {
      headers['If-None-Match'] = stored.patternDB.etag;
    }

    const resp = await fetch(`${BACKEND_URL}/api/patterns`, { headers });
    if (resp.status === 304) return;
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const data = await resp.json();
    const etag = resp.headers.get('ETag');
    await chrome.storage.local.set({
      patternDB: { ...data, etag, lastUpdated: Date.now() }
    });
    console.log('[Debunked] Pattern DB updated:', data.patterns.length, 'patterns');
  } catch (err) {
    console.warn('[Debunked] Failed to update pattern DB, using cached version:', err.message);
  }
}

async function analyzeWithAI(text) {
  try {
    const resp = await fetch(`${BACKEND_URL}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.slice(0, 3000) })
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } catch (err) {
    console.warn('[Debunked] AI analysis failed:', err.message);
    return { fallacies: [] };
  }
}
