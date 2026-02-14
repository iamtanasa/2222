'use strict';

// Planificator de întâlniri pentru Universul 2222 (stocat în Supabase)

let plannerEvents = [];
let countdownTimer = null;

async function loadPlannerEvents() {
  if (typeof _supabase === 'undefined') {
    plannerEvents = [];
    return;
  }
  const { data, error } = await _supabase
    .from('PlannerEvents')
    .select('id, title, event_time')
    .order('event_time', { ascending: true });

  if (error || !Array.isArray(data)) {
    plannerEvents = [];
    return;
  }

  const now = Date.now();
  plannerEvents = data
    .map((row) => ({
      id: row.id,
      title: String(row.title || ''),
      time: new Date(row.event_time).getTime(),
    }))
    .filter((e) => e.title && !Number.isNaN(e.time) && e.time > now)
    .sort((a, b) => a.time - b.time);
}

async function addPlannerEvent(title, dateStr, timeStr) {
  if (typeof _supabase === 'undefined') return false;

  const date = dateStr ? new Date(dateStr + 'T' + (timeStr || '00:00')) : null;
  if (!date || Number.isNaN(date.getTime())) return false;

  const now = Date.now();
  if (date.getTime() <= now) return false;

  const { data, error } = await _supabase
    .from('PlannerEvents')
    .insert({ title, event_time: date.toISOString() })
    .select('id, title, event_time')
    .single();

  if (error || !data) return false;

  const ev = {
    id: data.id,
    title: String(data.title || ''),
    time: new Date(data.event_time).getTime(),
  };
  plannerEvents.push(ev);
  plannerEvents.sort((a, b) => a.time - b.time);
  return true;
}

async function deletePlannerEvent(id) {
  if (typeof _supabase === 'undefined') return;
  const ok = confirm('Sigur vrei să ștergi această întâlnire?');
  if (!ok) return;

  const { error } = await _supabase.from('PlannerEvents').delete().eq('id', id);
  if (error) {
    alert('Nu am putut șterge întâlnirea: ' + error.message);
    return;
  }
  plannerEvents = plannerEvents.filter((e) => e.id !== id);
  renderPlannerList();
  updatePlannerCountdown();
}

function formatDateTime(ts) {
  const d = new Date(ts);
  const day = d.toLocaleDateString('ro-RO', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const time = d.toLocaleTimeString('ro-RO', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${day}, ora ${time}`;
}

function diffToParts(ts) {
  const now = Date.now();
  let diff = Math.max(0, ts - now);
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  diff -= days * 24 * 60 * 60 * 1000;
  const hours = Math.floor(diff / (60 * 60 * 1000));
  diff -= hours * 60 * 60 * 1000;
  const mins = Math.floor(diff / (60 * 1000));
  diff -= mins * 60 * 1000;
  const secs = Math.floor(diff / 1000);
  return { days, hours, mins, secs };
}

function renderPlannerList() {
  const list = document.getElementById('planner-list');
  if (!list) return;
  list.innerHTML = '';

  const now = Date.now();
  const upcoming = plannerEvents.filter((e) => e.time > now);

  if (!upcoming.length) {
    const p = document.createElement('p');
    p.className = 'helper-text';
    p.textContent = 'Nu avem încă întâlniri planificate';
    list.appendChild(p);
    return;
  }

  upcoming.forEach((ev) => {
    const item = document.createElement('div');
    item.className = 'planner-item';

    const header = document.createElement('div');
    header.className = 'planner-item-header';

    const titleEl = document.createElement('div');
    titleEl.className = 'planner-item-title';
    titleEl.textContent = ev.title;

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'planner-delete';
    delBtn.textContent = 'Șterge';
    delBtn.addEventListener('click', () => deletePlannerEvent(ev.id));

    header.appendChild(titleEl);
    header.appendChild(delBtn);

    const dateEl = document.createElement('div');
    dateEl.className = 'planner-item-date';
    dateEl.textContent = formatDateTime(ev.time);

    const remEl = document.createElement('div');
    remEl.className = 'planner-item-remaining';
    const parts = diffToParts(ev.time);
    remEl.textContent = `In ${parts.days}z ${parts.hours}h ${parts.mins}m`;

    item.appendChild(header);
    item.appendChild(dateEl);
    item.appendChild(remEl);

    list.appendChild(item);
  });
}

function updatePlannerCountdown() {
  const titleEl = document.getElementById('planner-next-title');
  const cd = document.getElementById('planner-countdown');
  const dateEl = document.getElementById('planner-next-date');
  if (!titleEl || !cd || !dateEl) return;

  const now = Date.now();
  const upcoming = plannerEvents.filter((e) => e.time > now);
  if (!upcoming.length) {
    titleEl.textContent = 'Încă nu am planificat nimic...';
    cd.classList.add('hidden');
    dateEl.textContent = '';
    return;
  }

  const next = upcoming[0];
  titleEl.textContent = next.title;
  dateEl.textContent = formatDateTime(next.time);
  cd.classList.remove('hidden');

  const parts = diffToParts(next.time);
  document.getElementById('cd-days').textContent = parts.days;
  document.getElementById('cd-hours').textContent = parts.hours;
  document.getElementById('cd-mins').textContent = parts.mins;
  document.getElementById('cd-secs').textContent = parts.secs;
}

function startPlannerTimer() {
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    updatePlannerCountdown();
    renderPlannerList();
  }, 1000);
}

function initPlanner() {
  const titleInput = document.getElementById('planner-title');
  const dateInput = document.getElementById('planner-date');
  const timeInput = document.getElementById('planner-time');
  const addBtn = document.getElementById('planner-add');
  const presetCards = document.querySelectorAll('.planner-preset');

  (async () => {
    await loadPlannerEvents();
    updatePlannerCountdown();
    renderPlannerList();
    startPlannerTimer();
  })();

  if (addBtn) {
    addBtn.addEventListener('click', async () => {
      const title = (titleInput.value || '').trim() || 'Întâlnire specială';
      const dateVal = dateInput.value;
      const timeVal = timeInput.value;

      if (!dateVal) {
        alert('Te rog să alegi o dată.');
        return;
      }

      const ok = await addPlannerEvent(title, dateVal, timeVal);
      if (!ok) {
        alert('Data aleasă trebuie să fie în viitor.');
        return;
      }

      titleInput.value = '';
      // nu resetăm neapărat data/ora, ca să fie ușor pentru mai multe întâlniri apropiate

      updatePlannerCountdown();
      renderPlannerList();
    });
  }

  presetCards.forEach((card) => {
    card.addEventListener('click', () => {
      const title = card.dataset.title || '';
      if (titleInput) {
        titleInput.value = title;
        titleInput.focus();
      }
    });
  });
}

/* ═══════════════════════════════════════════════
   ROATA NOROCOASĂ
   ═══════════════════════════════════════════════ */

const WHEEL_PRESETS = [
  { label: 'Faleză', icon: '🌊' },
  { label: 'Tacos King', icon: '🌮' },
  { label: 'Parcul Carol', icon: '🌳' },
  { label: 'București', icon: '🏙️' },
  { label: 'Gară Galați', icon: '🚆' },
  { label: 'Film', icon: '🎬' },
  { label: 'Mall', icon: '🛍️' },
  { label: 'Pe deal', icon: '⛰️' },
  { label: 'La pescuit', icon: '🎣' },
  { label: 'Acasă', icon: '🏡' },
];

const WHEEL_COLORS = [
  '#FF6B8A', '#845EC2', '#FFC75F', '#00C9A7',
  '#4B8BF5', '#FF9671', '#D65DB1', '#00D2FC',
  '#F9F871', '#FF6F91', '#2EC4B6', '#E8A0BF',
];

const CUSTOM_STORAGE_KEY = 'wheel_custom_items';

let wheelItems = [];
let customItems = [];
let wheelAngle = 0;
let wheelSpinning = false;

function loadCustomItems() {
  try {
    const raw = localStorage.getItem(CUSTOM_STORAGE_KEY);
    customItems = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(customItems)) customItems = [];
  } catch {
    customItems = [];
  }
}

function saveCustomItems() {
  localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(customItems));
}

let wheelMode = 'all'; // 'all' or 'custom'

function rebuildWheelItems() {
  const presets = wheelMode === 'all'
    ? WHEEL_PRESETS.map(p => ({ label: p.label, icon: p.icon }))
    : [];
  wheelItems = [
    ...presets,
    ...customItems.map(c => ({ label: c, icon: '✨' })),
  ];
}

function drawWheel(targetCanvasId) {
  const canvas = document.getElementById(targetCanvasId || 'wheel-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const cx = W / 2;
  const cy = H / 2;
  const R = Math.min(cx, cy) - 2;

  ctx.clearRect(0, 0, W, H);

  const n = wheelItems.length;
  if (n === 0) return;
  const sliceAngle = (2 * Math.PI) / n;

  for (let i = 0; i < n; i++) {
    const startA = wheelAngle + i * sliceAngle;
    const endA = startA + sliceAngle;

    // Slice fill
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, startA, endA);
    ctx.closePath();
    ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length];
    ctx.fill();

    // Slice border
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Text
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(startA + sliceAngle / 2);

    const item = wheelItems[i];
    const textR = R * 0.62;
    // Scale font size proportionally to canvas size
    const baseFont = n > 14 ? 9 : n > 10 ? 10 : 11;
    const scaleFactor = W / 320; // 320 is the base canvas width
    const fontSize = Math.round(baseFont * scaleFactor);

    ctx.fillStyle = '#fff';
    ctx.font = `bold ${fontSize}px Quicksand, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 3;

    // Truncate label if needed
    let lbl = item.label;
    if (lbl.length > 12 && n > 8 && W <= 320) lbl = lbl.slice(0, 10) + '…';

    ctx.fillText(item.icon + ' ' + lbl, textR, 0);
    ctx.restore();
  }

  // Center circle
  const centerR = Math.max(18, R * 0.14);
  ctx.beginPath();
  ctx.arc(cx, cy, centerR, 0, 2 * Math.PI);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#fff';
  const centerFontSize = Math.round(16 * (W / 320));
  ctx.font = `bold ${centerFontSize}px Quicksand`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 2;
  ctx.fillText('💕', cx, cy);
}

function spinWheel() {
  if (wheelSpinning || wheelItems.length === 0) return;
  wheelSpinning = true;

  const resultEl = document.getElementById('wheel-result');
  const spinBtn = document.getElementById('wheel-spin');
  const resultZoom = document.getElementById('wheel-result-zoom');
  if (resultEl) resultEl.classList.add('hidden');
  if (resultZoom) resultZoom.classList.add('hidden');

  // Auto-open zoom overlay when spinning
  const overlay = document.getElementById('wheel-zoom-overlay');
  if (overlay) {
    overlay.classList.remove('hidden');
    overlay.classList.remove('closing');
    drawWheel('wheel-canvas-zoom');
  }

  // Random: 4-8 full rotations + random final angle
  const totalRotation = (4 + Math.random() * 4) * 2 * Math.PI + Math.random() * 2 * Math.PI;
  const duration = 4000 + Math.random() * 1500; // 4-5.5 seconds
  const startAngle = wheelAngle;
  const startTime = performance.now();

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function animate(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeOutCubic(progress);

    wheelAngle = startAngle + totalRotation * eased;
    drawWheel('wheel-canvas');
    drawWheel('wheel-canvas-zoom');

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      wheelSpinning = false;
      showWheelResult();
    }
  }

  requestAnimationFrame(animate);
}

function showWheelResult() {
  const n = wheelItems.length;
  if (n === 0) return;

  const sliceAngle = (2 * Math.PI) / n;

  // The pointer is at the top (–π/2 = 270°). Find which slice is there.
  let pointerAngle = (-Math.PI / 2 - wheelAngle) % (2 * Math.PI);
  if (pointerAngle < 0) pointerAngle += 2 * Math.PI;

  const winIndex = Math.floor(pointerAngle / sliceAngle) % n;
  const winner = wheelItems[winIndex];

  // Show result in both the main area and zoom overlay
  ['wheel-result', 'wheel-result-zoom'].forEach(elId => {
    const resultEl = document.getElementById(elId);
    if (resultEl) {
      resultEl.innerHTML = `
        <span class="wheel-result-label">Roata a ales:</span>
        <span class="wheel-result-pick">${winner.icon} ${winner.label}</span>
        <div class="wheel-result-actions">
          <button onclick="wheelPlanDate('${winner.label.replace(/'/g, "\\'")}')">📅 Planifică</button>
          <button onclick="spinWheel()">🔄 Învârte iar</button>
        </div>
      `;
      resultEl.classList.remove('hidden');
      resultEl.style.animation = 'none';
      resultEl.offsetHeight;
      resultEl.style.animation = '';
    }
  });
}

function wheelPlanDate(title) {
  const titleInput = document.getElementById('planner-title');
  if (titleInput) {
    titleInput.value = title;
    titleInput.focus();
    titleInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function renderCustomList() {
  const list = document.getElementById('wheel-custom-list');
  if (!list) return;
  list.innerHTML = '';

  customItems.forEach((item, i) => {
    const tag = document.createElement('span');
    tag.className = 'wheel-custom-tag';
    tag.innerHTML = `✨ ${item} <span class="wheel-tag-remove" data-idx="${i}">✕</span>`;
    list.appendChild(tag);
  });

  // Attach remove listeners
  list.querySelectorAll('.wheel-tag-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx, 10);
      customItems.splice(idx, 1);
      saveCustomItems();
      rebuildWheelItems();
      drawWheel('wheel-canvas');
      drawWheel('wheel-canvas-zoom');
      renderCustomList();
    });
  });
}

function initWheel() {
  loadCustomItems();
  rebuildWheelItems();

  // Adapt canvas size for small screens
  const canvas = document.getElementById('wheel-canvas');
  if (canvas && window.innerWidth <= 400) {
    canvas.width = 270;
    canvas.height = 270;
  }

  drawWheel('wheel-canvas');
  drawWheel('wheel-canvas-zoom');
  renderCustomList();

  // Mode toggle buttons
  const modeBtns = document.querySelectorAll('.wheel-mode-btn');
  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (wheelSpinning) return;
      modeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      wheelMode = btn.dataset.mode;
      rebuildWheelItems();
      drawWheel('wheel-canvas');
      drawWheel('wheel-canvas-zoom');
    });
  });

  // Tap on wheel canvas to spin
  const wheelCanvas = document.getElementById('wheel-canvas');
  if (wheelCanvas) wheelCanvas.addEventListener('click', spinWheel);

  // Tap on zoom canvas to spin again
  const wheelCanvasZoom = document.getElementById('wheel-canvas-zoom');
  if (wheelCanvasZoom) wheelCanvasZoom.addEventListener('click', spinWheel);

  // Zoom overlay logic
  const overlay = document.getElementById('wheel-zoom-overlay');

  if (overlay) {
    // Close zoom when clicking on overlay background (not on canvas or result actions)
    overlay.addEventListener('click', (e) => {
      const tag = e.target.tagName.toLowerCase();
      if (tag === 'button' || tag === 'canvas' || e.target.closest('.wheel-result-actions')) return;
      overlay.classList.add('closing');
      setTimeout(() => {
        overlay.classList.add('hidden');
        overlay.classList.remove('closing');
      }, 250);
    });
  }

  const addBtn = document.getElementById('wheel-add-btn');
  const addInput = document.getElementById('wheel-custom-input');

  function addCustomItem() {
    if (!addInput) return;
    const val = addInput.value.trim();
    if (!val) return;
    if (customItems.length >= 15) {
      alert('Maxim 15 opțiuni custom.');
      return;
    }
    customItems.push(val);
    saveCustomItems();
    rebuildWheelItems();
    drawWheel('wheel-canvas');
    drawWheel('wheel-canvas-zoom');
    renderCustomList();
    addInput.value = '';
  }

  if (addBtn) addBtn.addEventListener('click', addCustomItem);
  if (addInput) addInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addCustomItem();
  });
}

window.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if (page === 'planner') {
    initPlanner();
    initWheel();
  }
});
