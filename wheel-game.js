'use strict';

/* ═══════════════════════════════════════════════
   ROATA NOROCULUI — Wheel of Fortune with Points
   ═══════════════════════════════════════════════ */

// ── Wheel Segments ──
// multiplier: applied to bet. Positive = win, negative = lose, 0 = lose bet
const WHEEL_SEGMENTS = [
  { label: '×1.5',    icon: '✨', multiplier: 1.5,  color: '#4B8BF5' },
  { label: 'Nimic',   icon: '💨', multiplier: 0,    color: '#555'    },
  { label: '−50%',    icon: '📉', multiplier: 0.5,  color: '#FF6B8A' },
  { label: 'Nimic',   icon: '💨', multiplier: 0,    color: '#555'    },
  { label: '×2',      icon: '💰', multiplier: 2,    color: '#00C9A7' },
  { label: '−50%',    icon: '📉', multiplier: 0.5,  color: '#FF6B8A' },
  { label: 'Nimic',   icon: '💨', multiplier: 0,    color: '#555'    },
  { label: '×3',      icon: '🤑', multiplier: 3,    color: '#845EC2' },
  { label: 'Nimic',   icon: '💨', multiplier: 0,    color: '#555'    },
  { label: '−50%',    icon: '📉', multiplier: 0.5,  color: '#FF6B8A' },
  { label: '×5',      icon: '🔥', multiplier: 5,    color: '#FFC75F' },
  { label: 'Nimic',   icon: '💨', multiplier: 0,    color: '#555'    },
  { label: '−Totul',  icon: '💀', multiplier: -1,   color: '#2a2a2a' },
  { label: '×1.5',    icon: '✨', multiplier: 1.5,  color: '#4B8BF5' },
  { label: 'Nimic',   icon: '💨', multiplier: 0,    color: '#555'    },
  { label: '−50%',    icon: '📉', multiplier: 0.5,  color: '#FF6B8A' },
  { label: 'Nimic',   icon: '💨', multiplier: 0,    color: '#555'    },
  { label: '×10',     icon: '👑', multiplier: 10,   color: '#D65DB1' },
];

// ── State ──
let wgBalance = 0;
let wgBet = 10;
let wgSpinning = false;
let wgAngle = 0;
let wgTotalProfit = 0;

// ══════════════════════════════════════
// BALANCE — same as slots
// ══════════════════════════════════════

async function wgLoadBalance() {
  const user = getLoggedInUser();
  if (!user) { wgBalance = 0; wgUpdateBalanceUI(); return; }

  try {
    const { data, error } = await _supabase
      .from('LoginUsers')
      .select('wins_bulls_cows, wins_hangman, wins_memory, wins_macao, wins_razboi, wins_triangles, wins_balloon, wins_puzzle, shop_spent')
      .eq('id', user.id)
      .maybeSingle();

    if (error || !data) { wgBalance = 0; wgUpdateBalanceUI(); return; }

    const fields = ['wins_bulls_cows','wins_hangman','wins_memory','wins_macao','wins_razboi','wins_triangles','wins_balloon','wins_puzzle'];
    const totalWins = fields.reduce((s, f) => s + (Number.isFinite(data[f]) ? data[f] : 0), 0);
    const spent = Number.isFinite(data.shop_spent) ? data.shop_spent : 0;

    wgBalance = Math.max(0, totalWins - spent);
    wgUpdateBalanceUI();
  } catch (e) {
    console.error('Wheel: eroare la citirea balanței:', e);
    wgBalance = 0;
    wgUpdateBalanceUI();
  }
}

async function wgAdjustSpent(amount) {
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
    await _supabase.from('LoginUsers').update({ shop_spent: current + amount }).eq('id', user.id);
  } catch (e) {
    console.error('Wheel: eroare la actualizarea shop_spent:', e);
  }
}

function wgUpdateBalanceUI() {
  const el = document.getElementById('wg-balance');
  if (el) el.textContent = wgBalance;
}

// ══════════════════════════════════════
// DRAW WHEEL
// ══════════════════════════════════════

function wgDrawWheel(canvasId) {
  const canvas = document.getElementById(canvasId || 'wg-wheel-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2;
  const R = Math.min(cx, cy) - 2;

  ctx.clearRect(0, 0, W, H);

  const n = WHEEL_SEGMENTS.length;
  const sliceAngle = (2 * Math.PI) / n;

  for (let i = 0; i < n; i++) {
    const seg = WHEEL_SEGMENTS[i];
    const startA = wgAngle + i * sliceAngle;
    const endA = startA + sliceAngle;

    // Slice
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, startA, endA);
    ctx.closePath();
    ctx.fillStyle = seg.color;
    ctx.fill();

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Text
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(startA + sliceAngle / 2);

    const textR = R * 0.65;
    const scaleFactor = W / 320;
    const fontSize = Math.round(11 * scaleFactor);

    ctx.fillStyle = '#fff';
    ctx.font = `bold ${fontSize}px Quicksand, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 3;

    let lbl = seg.label;
    if (lbl.length > 8 && W <= 320) lbl = lbl.slice(0, 7) + '…';
    ctx.fillText(seg.icon + ' ' + lbl, textR, 0);
    ctx.restore();
  }

  // Outer ring glow
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, 2 * Math.PI);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Center circle
  const centerR = Math.max(22, R * 0.16);
  ctx.beginPath();
  ctx.arc(cx, cy, centerR, 0, 2 * Math.PI);
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, centerR);
  grad.addColorStop(0, 'rgba(255,255,255,0.3)');
  grad.addColorStop(1, 'rgba(255,255,255,0.08)');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#fff';
  const cfs = Math.round(18 * (W / 320));
  ctx.font = `bold ${cfs}px Quicksand`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 2;
  ctx.fillText('🎡', cx, cy);
}

// ══════════════════════════════════════
// SPIN
// ══════════════════════════════════════

async function wgSpin() {
  if (wgSpinning) return;

  // Read bet from input
  const betInput = document.getElementById('wg-bet-input');
  if (betInput) {
    const val = parseInt(betInput.value, 10);
    if (val > 0) wgBet = val;
  }

  if (wgBalance < wgBet) {
    alert('Nu ai suficiente puncte! Câștigă mai multe din jocuri.');
    return;
  }

  wgSpinning = true;

  // Hide previous result
  const resultDisplay = document.getElementById('wg-result-display');
  const resultZoom = document.getElementById('wg-result-zoom');
  if (resultDisplay) resultDisplay.classList.add('hidden');
  if (resultZoom) resultZoom.classList.add('hidden');

  // Deduct bet from UI
  wgBalance -= wgBet;
  wgUpdateBalanceUI();

  // Open zoom overlay
  const overlay = document.getElementById('wg-zoom-overlay');
  if (overlay) {
    overlay.classList.remove('hidden');
    wgDrawWheel('wg-wheel-canvas-zoom');
  }

  // Spin animation — only draw the visible canvas for performance
  const totalRotation = (5 + Math.random() * 5) * 2 * Math.PI + Math.random() * 2 * Math.PI;
  const duration = 2500 + Math.random() * 800;
  const startAngle = wgAngle;
  const startTime = performance.now();

  function easeOutExpo(t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }

  const zoomVisible = overlay && !overlay.classList.contains('hidden');

  function animate(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    wgAngle = startAngle + totalRotation * easeOutExpo(progress);

    // Only draw the canvas that's actually visible
    if (zoomVisible) {
      wgDrawWheel('wg-wheel-canvas-zoom');
    } else {
      wgDrawWheel('wg-wheel-canvas');
    }

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      // Sync the other canvas
      wgDrawWheel('wg-wheel-canvas');
      wgDrawWheel('wg-wheel-canvas-zoom');
      wgSpinning = false;
      wgShowResult();
    }
  }

  requestAnimationFrame(animate);
}

async function wgShowResult() {
  const n = WHEEL_SEGMENTS.length;
  const sliceAngle = (2 * Math.PI) / n;

  let pointerAngle = (-Math.PI / 2 - wgAngle) % (2 * Math.PI);
  if (pointerAngle < 0) pointerAngle += 2 * Math.PI;

  const winIndex = Math.floor(pointerAngle / sliceAngle) % n;
  const seg = WHEEL_SEGMENTS[winIndex];

  // Calculate payout
  let payout = 0;
  let netResult = 0;

  if (seg.multiplier >= 1.5) {
    payout = Math.round(wgBet * seg.multiplier);
    wgBalance += payout;
    netResult = payout - wgBet;
    await wgAdjustSpent(-netResult);
  } else if (seg.multiplier > 0 && seg.multiplier < 1) {
    payout = Math.round(wgBet * seg.multiplier);
    wgBalance += payout;
    netResult = -(wgBet - payout);
    await wgAdjustSpent(-netResult);
  } else if (seg.multiplier === 0) {
    netResult = -wgBet;
    await wgAdjustSpent(wgBet);
  } else if (seg.multiplier < 0) {
    netResult = -wgBet;
    await wgAdjustSpent(wgBet);
  }

  wgTotalProfit += netResult;
  wgUpdateBalanceUI();

  const message = netResult >= 0
    ? `🎉 +${netResult} puncte`
    : `💨 ${netResult} puncte`;

  const totalLine = wgTotalProfit >= 0
    ? `Total: +${wgTotalProfit}`
    : `Total: ${wgTotalProfit}`;

  // Show result
  ['wg-result-display', 'wg-result-zoom'].forEach(elId => {
    const el = document.getElementById(elId);
    if (el) {
      const isWin = netResult >= 0;
      el.className = elId === 'wg-result-display'
        ? `wg-result-display ${isWin ? 'wg-win' : 'wg-lose'}`
        : `wg-result-box ${isWin ? 'wg-win' : 'wg-lose'}`;
      el.innerHTML = `
        <span class="wg-result-text">${message}</span>
        <span class="wg-result-total">${totalLine}</span>
      `;
    }
  });
}

// ══════════════════════════════════════
// PRIZES TABLE
// ══════════════════════════════════════

function wgRenderPrizes() {
  const container = document.getElementById('wg-prizes-table');
  if (!container) return;

  const prizes = [
    { icon: '👑', label: '×10', color: '#D65DB1', desc: 'Pariezi 100 → câștigi 900', chance: '1/18' },
    { icon: '🔥', label: '×5',  color: '#FFC75F', desc: 'Pariezi 100 → câștigi 400', chance: '1/18' },
    { icon: '🤑', label: '×3',  color: '#845EC2', desc: 'Pariezi 100 → câștigi 200', chance: '1/18' },
    { icon: '💰', label: '×2',  color: '#00C9A7', desc: 'Pariezi 100 → câștigi 100', chance: '1/18' },
    { icon: '✨', label: '×1.5', color: '#4B8BF5', desc: 'Pariezi 100 → câștigi 50', chance: '2/18' },
    { icon: '📉', label: '−50%', color: '#FF6B8A', desc: 'Pariezi 100 → pierzi 50', chance: '4/18' },
    { icon: '💨', label: 'Nimic', color: '#555',   desc: 'Pariezi 100 → pierzi 100', chance: '7/18' },
    { icon: '💀', label: '−Totul', color: '#2a2a2a', desc: 'Pariezi 100 → pierzi 100', chance: '1/18' },
  ];

  let html = '';
  prizes.forEach(p => {
    html += `
      <div class="wg-prize-row">
        <span class="wg-prize-icon" style="background:${p.color}">${p.icon}</span>
        <span class="wg-prize-label">${p.label}</span>
        <span class="wg-prize-desc">${p.desc}</span>
        <span class="wg-prize-chance">${p.chance}</span>
      </div>
    `;
  });

  container.innerHTML = html;
}

// ══════════════════════════════════════
// INIT
// ══════════════════════════════════════

function initWheelGame() {
  wgLoadBalance();

  // Adapt canvas for small screens
  const canvas = document.getElementById('wg-wheel-canvas');
  if (canvas && window.innerWidth <= 400) {
    canvas.width = 270;
    canvas.height = 270;
  }

  wgDrawWheel('wg-wheel-canvas');
  wgDrawWheel('wg-wheel-canvas-zoom');
  wgRenderPrizes();

  // Tap canvas to spin
  const wgCanvas = document.getElementById('wg-wheel-canvas');
  if (wgCanvas) wgCanvas.addEventListener('click', wgSpin);

  const wgCanvasZoom = document.getElementById('wg-wheel-canvas-zoom');
  if (wgCanvasZoom) wgCanvasZoom.addEventListener('click', wgSpin);

  // Bet input
  const betInput = document.getElementById('wg-bet-input');
  if (betInput) {
    betInput.addEventListener('input', () => {
      const val = parseInt(betInput.value, 10);
      if (val > 0) wgBet = val;
    });
  }

  // Half button
  const halfBtn = document.getElementById('wg-bet-half');
  if (halfBtn) halfBtn.addEventListener('click', () => {
    if (wgSpinning) return;
    wgBet = Math.max(1, Math.floor(wgBalance / 2));
    if (betInput) betInput.value = wgBet;
  });

  // All-in button
  const allBtn = document.getElementById('wg-bet-all');
  if (allBtn) allBtn.addEventListener('click', () => {
    if (wgSpinning) return;
    wgBet = Math.max(1, wgBalance);
    if (betInput) betInput.value = wgBet;
  });

  // Zoom overlay close
  const overlay = document.getElementById('wg-zoom-overlay');
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (wgSpinning) return;
      // Don't close if clicking spin-again button
      if (e.target.closest('.wg-result-actions')) return;
      overlay.classList.add('hidden');
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  if (document.body.dataset.page === 'wheel-game') {
    initWheelGame();
  }
});
