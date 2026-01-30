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
    p.textContent = 'Nu avem încă întâlniri planificate. Adaugă prima voastră dată!';
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

window.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if (page === 'planner') {
    initPlanner();
  }
});
