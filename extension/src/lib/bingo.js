window.Debunked = window.Debunked || {};

window.Debunked.Bingo = {
  GRID_SIZE: 5,
  card: null,

  generateCard(categories) {
    // categories: array of { category, bingoLabel } from pattern DB
    // Shuffle and pick 24 (5x5 minus free space)
    const shuffled = [...categories].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 24);

    const grid = [];
    let idx = 0;
    for (let row = 0; row < 5; row++) {
      grid[row] = [];
      for (let col = 0; col < 5; col++) {
        if (row === 2 && col === 2) {
          grid[row][col] = { label: 'FREE', category: 'free', filled: true, matches: [] };
        } else {
          grid[row][col] = {
            label: selected[idx].bingoLabel,
            category: selected[idx].category,
            filled: false,
            matches: []
          };
          idx++;
        }
      }
    }

    this.card = { grid, score: 0, bingos: [], createdAt: Date.now() };
    return this.card;
  },

  addMatch(match) {
    // Find the first unfilled square matching this category and fill it
    if (!this.card) return null;
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        const cell = this.card.grid[row][col];
        if (cell.category === match.category && !cell.filled) {
          cell.filled = true;
          cell.matches.push(match);
          this.card.score++;
          const newBingos = this.checkBingos();
          return { row, col, cell, newBingos };
        }
        if (cell.category === match.category && cell.filled) {
          cell.matches.push(match);
          return { row, col, cell, newBingos: [] };
        }
      }
    }
    return null;
  },

  checkBingos() {
    const newBingos = [];
    const grid = this.card.grid;

    // Check rows
    for (let r = 0; r < 5; r++) {
      const key = `row-${r}`;
      if (!this.card.bingos.includes(key) && grid[r].every(c => c.filled)) {
        this.card.bingos.push(key);
        newBingos.push(key);
      }
    }

    // Check columns
    for (let c = 0; c < 5; c++) {
      const key = `col-${c}`;
      if (!this.card.bingos.includes(key) && [0,1,2,3,4].every(r => grid[r][c].filled)) {
        this.card.bingos.push(key);
        newBingos.push(key);
      }
    }

    // Check diagonals
    const diag1Key = 'diag-1';
    if (!this.card.bingos.includes(diag1Key) && [0,1,2,3,4].every(i => grid[i][i].filled)) {
      this.card.bingos.push(diag1Key);
      newBingos.push(diag1Key);
    }
    const diag2Key = 'diag-2';
    if (!this.card.bingos.includes(diag2Key) && [0,1,2,3,4].every(i => grid[i][4-i].filled)) {
      this.card.bingos.push(diag2Key);
      newBingos.push(diag2Key);
    }

    return newBingos;
  },

  isBlackout() {
    if (!this.card) return false;
    return this.card.grid.every(row => row.every(cell => cell.filled));
  },

  getFilledCount() {
    if (!this.card) return 0;
    return this.card.grid.flat().filter(c => c.filled).length;
  },

  async saveState() {
    if (this.card) {
      await chrome.storage.local.set({ bingoCard: this.card });
    }
  },

  async loadState() {
    const stored = await chrome.storage.local.get('bingoCard');
    if (stored.bingoCard) {
      this.card = stored.bingoCard;
      return true;
    }
    return false;
  }
};
