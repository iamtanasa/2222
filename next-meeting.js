// Funcție pentru afișarea countdown-ului către următoarea întâlnire din planificator

let nextMeetingCountdownTimer = null;

async function loadAndDisplayNextMeeting() {
  if (typeof _supabase === 'undefined') {
    hideNextMeetingCard();
    return;
  }

  try {
    // Încarcă evenimentele din planificator
    const { data, error } = await _supabase
      .from('PlannerEvents')
      .select('id, title, event_time')
      .order('event_time', { ascending: true });

    if (error || !Array.isArray(data) || data.length === 0) {
      hideNextMeetingCard();
      return;
    }

    // Găsim următoarea întâlnire din viitor
    const now = Date.now();
    const nextEvent = data.find((e) => new Date(e.event_time).getTime() > now);

    if (!nextEvent) {
      hideNextMeetingCard();
      return;
    }

    // Afișez card-ul și pornesc countdown-ul
    showNextMeetingCard(nextEvent);
    startNextMeetingCountdown();
  } catch (e) {
    console.warn('Nu pot încărca următoarea întâlnire:', e);
    hideNextMeetingCard();
  }
}

function showNextMeetingCard(event) {
  const card = document.getElementById('next-meeting-card');
  const textEl = document.getElementById('next-meeting-text');

  if (!card || !textEl) return;

  card.style.display = 'block';
  updateMeetingCountdownDisplay(event);
}

function hideNextMeetingCard() {
  const card = document.getElementById('next-meeting-card');
  if (card) card.style.display = 'none';
  if (nextMeetingCountdownTimer) {
    clearInterval(nextMeetingCountdownTimer);
    nextMeetingCountdownTimer = null;
  }
}

function updateMeetingCountdownDisplay(event) {
  const textEl = document.getElementById('next-meeting-text');
  if (!textEl) return;

  const eventTime = new Date(event.event_time).getTime();
  const now = Date.now();
  const diffMs = eventTime - now;

  if (diffMs <= 0) {
    textEl.innerHTML = `<strong>${event.title}</strong> - Acum! 🎉`;
    return;
  }

  // Calculez zile, ore, minute, secunde
  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // Format frumos
  let countdownText = '';
  if (days > 0) countdownText += `${days}d `;
  if (hours > 0) countdownText += `${hours}h `;
  if (minutes > 0) countdownText += `${minutes}m `;
  countdownText += `${seconds}s`;

  // Afis data și ora în format frumos
  const eventDate = new Date(event.event_time);
  const dateStr = eventDate.toLocaleDateString('ro-RO', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const timeStr = eventDate.toLocaleTimeString('ro-RO', {
    hour: '2-digit',
    minute: '2-digit',
  });

  textEl.innerHTML = `<strong>${event.title}</strong><br>
${dateStr} la ${timeStr}<br>
<span style="font-size: 1.1rem; font-weight: 600; color: #ffffff;">${countdownText}</span>`;
}

function startNextMeetingCountdown() {
  if (nextMeetingCountdownTimer) {
    clearInterval(nextMeetingCountdownTimer);
  }

  nextMeetingCountdownTimer = setInterval(async () => {
    if (typeof _supabase === 'undefined') return;

    try {
      const { data, error } = await _supabase
        .from('PlannerEvents')
        .select('id, title, event_time')
        .order('event_time', { ascending: true });

      if (error || !Array.isArray(data) || data.length === 0) {
        hideNextMeetingCard();
        return;
      }

      const now = Date.now();
      const nextEvent = data.find((e) => new Date(e.event_time).getTime() > now);

      if (!nextEvent) {
        hideNextMeetingCard();
        return;
      }

      updateMeetingCountdownDisplay(nextEvent);
    } catch (e) {
      console.warn('Eroare la actualizarea countdown-ului:', e);
    }
  }, 1000); // Actualizez la fiecare secundă
}
