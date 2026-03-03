document.addEventListener('DOMContentLoaded', async () => {
  const stored = await chrome.storage.local.get('bingoCard');
  const card = stored.bingoCard;

  if (card) {
    renderGrid(card);
    renderScore(card);
    renderMatches(card);
  } else {
    document.getElementById('bingo-grid').innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#666;padding:20px;">Visit a page to start detecting patterns!</p>';
  }

  document.getElementById('share-btn').addEventListener('click', () => shareCard(card));

  document.getElementById('new-card-btn').addEventListener('click', async () => {
    await chrome.storage.local.remove('bingoCard');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { action: 'newCard' });
    }
    window.close();
  });
});

function renderGrid(card) {
  const grid = document.getElementById('bingo-grid');
  grid.innerHTML = '';
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const cell = card.grid[r][c];
      const div = document.createElement('div');
      div.className = 'bingo-cell';
      if (cell.category === 'free') div.classList.add('free');
      else if (cell.filled) div.classList.add('filled');

      const inBingo = card.bingos.some(b => {
        if (b.startsWith('row-') && parseInt(b.split('-')[1]) === r) return true;
        if (b.startsWith('col-') && parseInt(b.split('-')[1]) === c) return true;
        if (b === 'diag-1' && r === c) return true;
        if (b === 'diag-2' && r + c === 4) return true;
        return false;
      });
      if (inBingo) div.classList.add('bingo-line');

      div.textContent = cell.label;
      if (cell.matches.length > 1) {
        const badge = document.createElement('span');
        badge.className = 'match-count';
        badge.textContent = cell.matches.length;
        div.appendChild(badge);
      }
      div.title = cell.description || cell.label;
      grid.appendChild(div);
    }
  }
}

function renderScore(card) {
  const filled = card.grid.flat().filter(c => c.filled).length;
  document.getElementById('score-text').textContent = `${filled}/25`;
  const status = document.getElementById('bingo-status');
  if (filled === 25) {
    status.textContent = 'BLACKOUT!';
    status.className = 'blackout';
  } else if (card.bingos.length > 0) {
    status.textContent = `BINGO x${card.bingos.length}!`;
    status.className = 'bingo';
  }
}

function renderMatches(card) {
  const ul = document.getElementById('matches-ul');
  ul.innerHTML = '';
  const allMatches = card.grid.flat().flatMap(c => c.matches);
  const seen = new Set();
  for (const m of allMatches) {
    const key = `${m.category}-${m.matched}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const li = document.createElement('li');
    li.innerHTML = `<span class="category-tag">${m.category.replace(/_/g, ' ')}</span> "${m.matched}"`;
    ul.appendChild(li);
  }
  if (allMatches.length === 0) {
    ul.innerHTML = '<li class="empty">No patterns detected on this page yet.</li>';
  }
}

async function shareCard(card) {
  if (!card) return;

  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 700;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, 600, 700);

  // Title
  ctx.fillStyle = '#ffc107';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('DEBUNKED', 300, 40);
  ctx.fillStyle = '#aaa';
  ctx.font = '14px sans-serif';
  ctx.fillText('Fake News Bingo', 300, 60);

  // Grid
  const cellSize = 100;
  const gridX = 50;
  const gridY = 80;
  const gap = 4;

  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const cell = card.grid[r][c];
      const x = gridX + c * (cellSize + gap);
      const y = gridY + r * (cellSize + gap);

      if (cell.category === 'free') ctx.fillStyle = '#ffc107';
      else if (cell.filled) ctx.fillStyle = '#4caf50';
      else ctx.fillStyle = '#2a2a4a';

      ctx.beginPath();
      ctx.roundRect(x, y, cellSize, cellSize, 6);
      ctx.fill();

      ctx.fillStyle = cell.filled || cell.category === 'free' ? '#fff' : '#888';
      ctx.font = cell.category === 'free' ? 'bold 14px sans-serif' : '10px sans-serif';
      ctx.textAlign = 'center';

      const words = cell.label.split(' ');
      let lines = [];
      let currentLine = '';
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (ctx.measureText(testLine).width > cellSize - 10) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      lines.push(currentLine);

      const lineHeight = 13;
      const startY = y + (cellSize - lines.length * lineHeight) / 2 + lineHeight;
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], x + cellSize / 2, startY + i * lineHeight);
      }
    }
  }

  const filled = card.grid.flat().filter(c => c.filled).length;
  ctx.fillStyle = '#e0e0e0';
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${filled}/25 patterns detected | ${card.bingos.length} bingos`, 300, 620);

  ctx.fillStyle = '#666';
  ctx.font = '12px sans-serif';
  ctx.fillText('#Debunked', 300, 660);

  canvas.toBlob(async (blob) => {
    const item = new ClipboardItem({ 'image/png': blob });
    await navigator.clipboard.write([item]);

    const text = `This article hit ${filled - 1} misinformation tropes! #Debunked`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(twitterUrl, '_blank');
  }, 'image/png');
}
