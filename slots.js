'use strict';

/* ═══════════════════════════════════════════════
   SIZZLING HOT — Slot Machine (Păcănele)
   5 reels × 3 rows, 5 paylines
   ═══════════════════════════════════════════════ */

// ── Symbols ──
// Sizzling Hot classic: Cherry, Lemon, Orange, Plum, Watermelon, Grapes, Star(scatter/7)
const SYMBOLS = [
  { id: 'cherry',     emoji: '🍒', type: 'emoji' },
  { id: 'lemon',      emoji: '🍋', type: 'emoji' },
  { id: 'orange',     emoji: '🍊', type: 'emoji' },
  { id: 'plum',       emoji: '🍇', type: 'emoji' },
  { id: 'watermelon', emoji: '🍉', type: 'emoji' },
  { id: 'grapes',     emoji: '🫐', type: 'emoji' },
  { id: 'seven',      emoji: '',   type: 'img', src: 'client/hangman-head.png' },
  { id: 'star',       emoji: '⭐', type: 'emoji' },  // scatter
];

// Weighted reel strip — balanced: cherry slightly less, others more, stars rarer
// Index into SYMBOLS array
const REEL_STRIP = [
  0, 0, 0, 0, 0, 0, 0,                    // cherry (7) — slightly reduced
  1, 1, 1, 1, 1,                           // lemon (5) — increased
  2, 2, 2, 2, 2,                           // orange (5) — increased
  3, 3, 3, 3,                              // plum (4) — increased
  4, 4, 4,                                 // watermelon (3) — increased
  5, 5,                                    // grapes (2) — unchanged
  6, 6,                                    // seven (2) — unchanged
  7,                                        // star/scatter (1) — reduced from 2
  0, 1, 2, 3, 4, 5, 6                     // blanks (7) — reduced
];

// ── Paytable (multipliers per bet-per-line) — reduced for realism ──
// Format: { symbolId: { 2: mult, 3: mult, 4: mult, 5: mult } }
const PAYTABLE = {
  cherry:     { 2: 2,   3: 4,    4: 12,   5: 30 },
  lemon:      { 3: 8,   4: 20,   5: 50 },
  orange:     { 3: 10,  4: 25,   5: 75 },
  plum:       { 3: 12,  4: 40,   5: 100 },
  watermelon: { 3: 20,  4: 60,   5: 200 },
  grapes:     { 3: 60,  4: 200,  5: 600 },
  seven:      { 3: 200, 4: 1000, 5: 5000 },
  star:       { 3: 3,   4: 10,   5: 50 },  // scatter pays on any position
};

// ── 5 Paylines (row indices: 0=top, 1=mid, 2=bottom) ──
const PAYLINES = [
  [1, 1, 1, 1, 1], // Line 1: middle row
  [0, 0, 0, 0, 0], // Line 2: top row
  [2, 2, 2, 2, 2], // Line 3: bottom row
  [0, 1, 2, 1, 0], // Line 4: V shape
  [2, 1, 0, 1, 2], // Line 5: inverted V
];

// ── Game State ──
const WIN_BET_CAP = 100; // winnings capped as if bet were 100/line max
let slotsBalance = 0;
let currentBet = 1;     // per line
let currentLines = 1;
let isSpinning = false;
let currentGrid = [];   // 5 columns × 3 rows (SYMBOLS indices)
let lastWin = 0;
let gambleWin = 0;

// ── DOM refs (set on init) ──
let balanceEl, totalBetEl, winDisplay, winText;
let gambleSection, gambleAmountEl;
let spinBtn;

// ══════════════════════════════════════
// BALANCE — read/write from Supabase
// ══════════════════════════════════════

async function loadSlotsBalance() {
  const user = getLoggedInUser();
  if (!user) {
    slotsBalance = 0;
    updateBalanceUI();
    return;
  }

  try {
    const { data, error } = await _supabase
      .from('LoginUsers')
      .select('wins_bulls_cows, wins_hangman, wins_memory, wins_macao, wins_razboi, wins_triangles, wins_balloon, wins_puzzle, shop_spent')
      .eq('id', user.id)
      .maybeSingle();

    if (error || !data) {
      slotsBalance = 0;
      updateBalanceUI();
      return;
    }

    const bulls = Number.isFinite(data.wins_bulls_cows) ? data.wins_bulls_cows : 0;
    const hangman = Number.isFinite(data.wins_hangman) ? data.wins_hangman : 0;
    const memory = Number.isFinite(data.wins_memory) ? data.wins_memory : 0;
    const macao = Number.isFinite(data.wins_macao) ? data.wins_macao : 0;
    const razboi = Number.isFinite(data.wins_razboi) ? data.wins_razboi : 0;
    const triangles = Number.isFinite(data.wins_triangles) ? data.wins_triangles : 0;
    const balloon = Number.isFinite(data.wins_balloon) ? data.wins_balloon : 0;
    const puzzle = Number.isFinite(data.wins_puzzle) ? data.wins_puzzle : 0;
    const totalWins = bulls + hangman + memory + macao + razboi + triangles + balloon + puzzle;
    const spent = Number.isFinite(data.shop_spent) ? data.shop_spent : 0;

    slotsBalance = Math.max(0, totalWins - spent);
    updateBalanceUI();
  } catch (e) {
    console.error('Slots: eroare la citirea balanței:', e);
    slotsBalance = 0;
    updateBalanceUI();
  }
}

// Modify shop_spent to reflect bets/wins
async function adjustSpent(amount) {
  // amount > 0 means player spent (bet), amount < 0 means player won (reduce spent)
  const user = getLoggedInUser();
  if (!user) return;

  try {
    const { data, error } = await _supabase
      .from('LoginUsers')
      .select('shop_spent')
      .eq('id', user.id)
      .maybeSingle();

    if (error || !data) return;

    const current = Number.isFinite(data.shop_spent) ? data.shop_spent : 0;
    const newSpent = current + amount;

    await _supabase
      .from('LoginUsers')
      .update({ shop_spent: newSpent })
      .eq('id', user.id);
  } catch (e) {
    console.error('Slots: eroare la actualizarea shop_spent:', e);
  }
}

function updateBalanceUI() {
  if (balanceEl) balanceEl.textContent = slotsBalance;
}

// ══════════════════════════════════════
// REELS — generate & display
// ══════════════════════════════════════

function randomSymbolIndex() {
  return REEL_STRIP[Math.floor(Math.random() * REEL_STRIP.length)];
}

function generateGrid() {
  // 5 columns, each with 3 symbols
  const grid = [];
  for (let col = 0; col < 5; col++) {
    const column = [];
    for (let row = 0; row < 3; row++) {
      column.push(randomSymbolIndex());
    }
    grid.push(column);
  }

  // 23% chance: nudge a near-win into a small win
  if (Math.random() < 0.23) {
    nudgeGrid(grid);
  }

  return grid;
}

// Nudge: pick a random payline row, pick a common symbol, force 3 in a row (balanced)
function nudgeGrid(grid) {
  const row = Math.floor(Math.random() * 3); // 0, 1, or 2
  // Pick from symbols - cherry/lemon/orange most common, plum/watermelon rare, grapes/seven very rare, stars rare
  const rand = Math.random();
  let sym;
  if (rand < 0.60) {
    // 60% - cherry, lemon, orange
    sym = Math.floor(Math.random() * 3);
  } else if (rand < 0.85) {
    // 25% - plum, watermelon
    sym = 3 + Math.floor(Math.random() * 2);
  } else if (rand < 0.95) {
    // 10% - grapes, seven
    sym = 5 + Math.floor(Math.random() * 2);
  } else {
    // 5% - star (scatter)
    sym = 7;
  }
  // Force first 3 reels to have this symbol on this row
  for (let col = 0; col < 3; col++) {
    grid[col][row] = sym;
  }
  // Chance to extend to 4 (16%)
  if (Math.random() < 0.16) {
    grid[3][row] = sym;
    // Chance for 5 (8%)
    if (Math.random() < 0.08) {
      grid[4][row] = sym;
    }
  }
}

function symbolToHTML(symIndex) {
  const sym = SYMBOLS[symIndex];
  if (sym.type === 'img') {
    return `<img src="${sym.src}" alt="${sym.id}" draggable="false">`;
  }
  return sym.emoji;
}

function renderGrid(grid) {
  for (let col = 0; col < 5; col++) {
    const reel = document.getElementById(`reel-${col}`);
    if (!reel) continue;
    const inner = reel.querySelector('.slots-reel-inner');
    if (!inner) continue;
    const cells = inner.querySelectorAll('.slots-symbol');
    for (let row = 0; row < 3; row++) {
      if (cells[row]) {
        cells[row].innerHTML = symbolToHTML(grid[col][row]);
        cells[row].classList.remove('winning');
      }
    }
  }
}

// ══════════════════════════════════════
// SPIN — animation & logic
// ══════════════════════════════════════

async function spin() {
  if (isSpinning) return;

  const totalBet = currentBet * currentLines;

  if (slotsBalance < totalBet) {
    alert('Nu ai suficiente puncte! Câștigă mai multe din jocuri.');
    return;
  }

  isSpinning = true;
  spinBtn.disabled = true;
  lastWin = 0;
  gambleWin = 0;
  hideGamble();
  hideWin();
  hidePaylines();

  // Deduct bet (UI only, DB update after result)
  slotsBalance -= totalBet;
  updateBalanceUI();

  // Generate final result
  const finalGrid = generateGrid();

  // Animate reels
  await animateReels(finalGrid);

  currentGrid = finalGrid;

  // Check wins
  const { totalWin, winningCells } = evaluateWins(finalGrid);

  // Single DB update with net result (bet - win)
  const netSpent = totalBet - totalWin;
  await adjustSpent(netSpent);

  if (totalWin > 0) {
    lastWin = totalWin;
    slotsBalance += totalWin;
    updateBalanceUI();

    showWin(totalWin);
    highlightWinningCells(winningCells);

    // Show gamble option
    gambleWin = totalWin;
    showGamble(totalWin);
  }

  isSpinning = false;
  spinBtn.disabled = false;
}

function animateReels(finalGrid) {
  return new Promise((resolve) => {
    const reels = [];
    for (let col = 0; col < 5; col++) {
      reels.push(document.getElementById(`reel-${col}`));
    }

    // Start all reels spinning
    reels.forEach(r => r.classList.add('spinning'));

    // Stop reels one by one with delay
    const stopDelay = 400; // ms between each reel stopping
    const baseDelay = 600; // minimum spin time

    let stopped = 0;

    for (let col = 0; col < 5; col++) {
      setTimeout(() => {
        const reel = reels[col];
        reel.classList.remove('spinning');

        // Set final symbols
        const inner = reel.querySelector('.slots-reel-inner');
        const cells = inner.querySelectorAll('.slots-symbol');
        for (let row = 0; row < 3; row++) {
          cells[row].innerHTML = symbolToHTML(finalGrid[col][row]);
          cells[row].classList.remove('winning');
        }

        stopped++;
        if (stopped === 5) {
          setTimeout(resolve, 150);
        }
      }, baseDelay + col * stopDelay);
    }

    // Rapid random symbols while spinning
    const spinInterval = setInterval(() => {
      for (let col = 0; col < 5; col++) {
        if (reels[col].classList.contains('spinning')) {
          const inner = reels[col].querySelector('.slots-reel-inner');
          const cells = inner.querySelectorAll('.slots-symbol');
          for (let row = 0; row < 3; row++) {
            cells[row].innerHTML = symbolToHTML(randomSymbolIndex());
          }
        }
      }
    }, 70);

    // Stop interval when all done
    setTimeout(() => {
      clearInterval(spinInterval);
    }, baseDelay + 5 * stopDelay + 200);
  });
}

// ══════════════════════════════════════
// WIN EVALUATION
// ══════════════════════════════════════

function evaluateWins(grid) {
  let totalWin = 0;
  const winningCells = new Set(); // "col-row" strings

  // 1) Check paylines
  for (let lineIdx = 0; lineIdx < currentLines; lineIdx++) {
    const line = PAYLINES[lineIdx];
    const lineSymbols = line.map((row, col) => grid[col][row]);

    // Find longest match from left
    const firstSym = lineSymbols[0];
    let matchCount = 1;
    for (let i = 1; i < 5; i++) {
      if (lineSymbols[i] === firstSym) {
        matchCount++;
      } else {
        break;
      }
    }

    // Cherry pays from 2 matches, rest from 3
    const minMatch = (SYMBOLS[firstSym].id === 'cherry') ? 2 : 3;

    if (matchCount >= minMatch) {
      const symId = SYMBOLS[firstSym].id;
      if (symId !== 'star') { // star is scatter, handled separately
        const mult = PAYTABLE[symId][matchCount] || 0;
        const lineWin = mult * Math.min(currentBet, WIN_BET_CAP);
        totalWin += lineWin;

        // Mark winning cells
        for (let i = 0; i < matchCount; i++) {
          winningCells.add(`${i}-${line[i]}`);
        }
      }
    }
  }

  // 2) Check scatter (star) — counts anywhere on all 5 reels
  const starIdx = SYMBOLS.findIndex(s => s.id === 'star');
  let starCount = 0;
  const starPositions = [];
  for (let col = 0; col < 5; col++) {
    for (let row = 0; row < 3; row++) {
      if (grid[col][row] === starIdx) {
        starCount++;
        starPositions.push(`${col}-${row}`);
      }
    }
  }

  if (starCount >= 3) {
    const scatterMult = PAYTABLE.star[Math.min(starCount, 5)] || 0;
    const scatterWin = scatterMult * Math.min(currentBet, WIN_BET_CAP) * currentLines;
    totalWin += scatterWin;
    starPositions.forEach(pos => winningCells.add(pos));
  }

  return { totalWin, winningCells };
}

function highlightWinningCells(winningCells) {
  winningCells.forEach(key => {
    const [col, row] = key.split('-').map(Number);
    const reel = document.getElementById(`reel-${col}`);
    if (!reel) return;
    const cells = reel.querySelectorAll('.slots-symbol');
    if (cells[row]) cells[row].classList.add('winning');
  });
}

// ══════════════════════════════════════
// UI HELPERS
// ══════════════════════════════════════

function showWin(amount) {
  if (winDisplay && winText) {
    winText.textContent = `🎉 Câștig: ${amount} puncte!`;
    winDisplay.classList.remove('hidden');
  }
}

function hideWin() {
  if (winDisplay) winDisplay.classList.add('hidden');
}

function showGamble(amount) {
  if (gambleSection && gambleAmountEl) {
    gambleAmountEl.textContent = amount;
    clearHistory();
    resetGambleCard();
    gambleAnimating = false;
    setGambleButtonsEnabled(true);
    const redBtn = document.getElementById('gamble-red-btn');
    const blackBtn = document.getElementById('gamble-black-btn');
    if (redBtn) redBtn.classList.remove('chosen');
    if (blackBtn) blackBtn.classList.remove('chosen');
    gambleSection.classList.remove('hidden');
  }
}

function hideGamble() {
  if (gambleSection) gambleSection.classList.add('hidden');
}

function updateTotalBet() {
  const total = currentBet * currentLines;
  if (totalBetEl) totalBetEl.textContent = total;
  updatePaylineVisuals();
}

function updatePaylineVisuals() {
  const allLines = document.querySelectorAll('.slots-payline');
  allLines.forEach(el => {
    const lineNum = parseInt(el.dataset.line, 10);
    if (lineNum <= currentLines) {
      el.classList.add('visible');
    } else {
      el.classList.remove('visible');
    }
  });
}

function hidePaylines() {
  document.querySelectorAll('.slots-payline').forEach(el => {
    el.classList.remove('visible');
  });
}

// ══════════════════════════════════════
// GAMBLE (Double or Nothing) — Card Color Pick
// ══════════════════════════════════════

const CARD_PATH = 'server/node_modules/svg-cards/png/2x/';
const GAMBLE_CARDS = [];

// Build deck of aces only for gamble
['heart', 'diamond', 'club', 'spade'].forEach(suit => {
  GAMBLE_CARDS.push({
    suit,
    rank: '1',
    color: (suit === 'heart' || suit === 'diamond') ? 'red' : 'black',
    img: `${CARD_PATH}${suit}_1.png`
  });
});

let gambleHistory = [];
let gambleAnimating = false;

function getRandomCard() {
  return GAMBLE_CARDS[Math.floor(Math.random() * GAMBLE_CARDS.length)];
}

function resetGambleCard() {
  const card = document.getElementById('gamble-card');
  const cardImg = document.getElementById('gamble-card-img');
  if (card) {
    card.classList.remove('flipped', 'win-glow', 'lose-glow');
  }
  if (cardImg) cardImg.src = '';
}

function addHistoryDot(color, suit) {
  const hist = document.getElementById('gamble-history');
  if (!hist) return;
  const dot = document.createElement('div');
  dot.className = `gamble-history-dot ${color}`;
  const suitIcon = suit === 'heart' ? '♥' : suit === 'diamond' ? '♦' : suit === 'club' ? '♣' : '♠';
  dot.textContent = suitIcon;
  hist.appendChild(dot);
}

function clearHistory() {
  const hist = document.getElementById('gamble-history');
  if (hist) hist.innerHTML = '';
  gambleHistory = [];
}

function setGambleButtonsEnabled(enabled) {
  const redBtn = document.getElementById('gamble-red-btn');
  const blackBtn = document.getElementById('gamble-black-btn');
  if (redBtn) redBtn.disabled = !enabled;
  if (blackBtn) blackBtn.disabled = !enabled;
}

async function doGambleChoice(chosenColor) {
  if (gambleWin <= 0 || gambleAnimating) return;

  gambleAnimating = true;
  setGambleButtonsEnabled(false);

  // Highlight chosen button
  const redBtn = document.getElementById('gamble-red-btn');
  const blackBtn = document.getElementById('gamble-black-btn');
  if (redBtn) redBtn.classList.remove('chosen');
  if (blackBtn) blackBtn.classList.remove('chosen');
  const chosenBtn = chosenColor === 'red' ? redBtn : blackBtn;
  if (chosenBtn) chosenBtn.classList.add('chosen');

  // Reset card for new round
  resetGambleCard();

  // Pick random card
  const drawnCard = getRandomCard();
  const win = drawnCard.color === chosenColor;

  // Set card front image
  const cardImg = document.getElementById('gamble-card-img');
  if (cardImg) cardImg.src = drawnCard.img;

  // Small delay then flip
  await new Promise(r => setTimeout(r, 300));

  const card = document.getElementById('gamble-card');
  if (card) card.classList.add('flipped');

  // Wait for flip animation
  await new Promise(r => setTimeout(r, 700));

  // Add glow effect
  if (card) card.classList.add(win ? 'win-glow' : 'lose-glow');

  // Add to history
  addHistoryDot(drawnCard.color, drawnCard.suit);
  gambleHistory.push(drawnCard);

  if (win) {
    const doubled = gambleWin * 2;
    const gained = doubled - gambleWin;
    slotsBalance += gained;
    gambleWin = doubled;
    await adjustSpent(-gained);
    updateBalanceUI();
    showWin(doubled);
    if (gambleAmountEl) gambleAmountEl.textContent = doubled;

    // Wait then reset card for next round
    await new Promise(r => setTimeout(r, 1200));
    resetGambleCard();
    gambleAnimating = false;
    setGambleButtonsEnabled(true);
    if (redBtn) redBtn.classList.remove('chosen');
    if (blackBtn) blackBtn.classList.remove('chosen');
  } else {
    // Lost everything
    slotsBalance -= gambleWin;
    await adjustSpent(gambleWin);
    updateBalanceUI();
    gambleWin = 0;

    if (winText) winText.textContent = '😢 Ai pierdut la gamble...';
    if (winDisplay) winDisplay.classList.remove('hidden');

    await new Promise(r => setTimeout(r, 1800));
    hideGamble();
    clearHistory();
    setTimeout(hideWin, 1000);
    gambleAnimating = false;
  }
}

function collectGamble() {
  gambleWin = 0;
  hideGamble();
  clearHistory();
  resetGambleCard();
}

// ══════════════════════════════════════
// PAYTABLE DISPLAY
// ══════════════════════════════════════

function renderPaytable() {
  const container = document.getElementById('slots-paytable');
  if (!container) return;

  let html = '';

  SYMBOLS.forEach(sym => {
    const pays = PAYTABLE[sym.id];
    if (!pays) return;

    const icon = sym.type === 'img'
      ? `<img src="${sym.src}" alt="${sym.id}">`
      : sym.emoji;

    const label = sym.id === 'star' ? '(oriunde)' : '';

    const paysStr = pays[2]
      ? `×2=${pays[2]} | ×3=${pays[3]} | ×4=${pays[4]} | ×5=${pays[5]}`
      : `×3=${pays[3]} | ×4=${pays[4]} | ×5=${pays[5]}`;

    html += `
      <div class="slots-paytable-row">
        <span class="pt-symbol">${icon}</span>
        <span class="pt-name">${sym.id.charAt(0).toUpperCase() + sym.id.slice(1)} ${label}</span>
        <span class="pt-pays">${paysStr}</span>
      </div>
    `;
  });

  html += `
    <div class="slots-paytable-row" style="margin-top:8px; border-top:1px solid rgba(255,255,255,0.15); padding-top:8px;">
      <span class="pt-symbol">📏</span>
      <span class="pt-name">5 Linii de plată</span>
      <span class="pt-pays">Mijloc | Sus | Jos | V | Λ</span>
    </div>
  `;

  container.innerHTML = html;
}

// ══════════════════════════════════════
// INIT
// ══════════════════════════════════════

function initSlots() {
  balanceEl = document.getElementById('slots-balance');
  totalBetEl = document.getElementById('slots-total-bet');
  winDisplay = document.getElementById('slots-win-display');
  winText = document.getElementById('slots-win-text');
  gambleSection = document.getElementById('slots-gamble-section');
  gambleAmountEl = document.getElementById('slots-gamble-amount');
  spinBtn = document.getElementById('slots-spin-btn');

  // Load balance
  loadSlotsBalance();

  // Initial grid
  currentGrid = generateGrid();
  renderGrid(currentGrid);

  // Spin button
  if (spinBtn) spinBtn.addEventListener('click', spin);

  // Line buttons
  document.querySelectorAll('.slots-line-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (isSpinning) return;
      document.querySelectorAll('.slots-line-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentLines = parseInt(btn.dataset.lines, 10);
      updateTotalBet();
    });
  });

  // Bet buttons
  document.querySelectorAll('.slots-bet-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (isSpinning) return;
      document.querySelectorAll('.slots-bet-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentBet = parseInt(btn.dataset.bet, 10);
      updateTotalBet();
    });
  });

  // Gamble buttons
  const gambleRedBtn = document.getElementById('gamble-red-btn');
  const gambleBlackBtn = document.getElementById('gamble-black-btn');
  const collectBtn = document.getElementById('slots-collect-btn');
  if (gambleRedBtn) gambleRedBtn.addEventListener('click', () => doGambleChoice('red'));
  if (gambleBlackBtn) gambleBlackBtn.addEventListener('click', () => doGambleChoice('black'));
  if (collectBtn) collectBtn.addEventListener('click', collectGamble);

  // Render paytable
  renderPaytable();

  // Update total bet display
  updateTotalBet();
  updatePaylineVisuals();
}

window.addEventListener('DOMContentLoaded', () => {
  if (document.body.dataset.page === 'slots') {
    initSlots();
  }
});
