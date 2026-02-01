'use strict';

// Memory Game client – foloseste acelasi server WebSocket

let memorySocket = null;
let memoryRoomCode = null;
let memoryPlayerName = null;
let memoryMode = 'easy';
let memoryIsHost = false;
let memoryBoard = [];
let memoryPairs = 0;
let memoryYourScore = 0;
let memoryOpponentScore = 0;
let memoryCurrentTurn = null; // 'you' sau 'opponent'
let memoryFlippedIndexes = []; // indexii temporar intoarși
let memoryImageMap = null; // pairId -> url din galerie

function mgGetLoggedInUser() {
  if (typeof getLoggedInUser === 'function') return getLoggedInUser();
  const idStr = localStorage.getItem('berea_user_id');
  const name = localStorage.getItem('berea_username');
  if (!idStr || !name) return null;
  const id = parseInt(idStr, 10);
  if (!id || Number.isNaN(id)) return null;
  return { id, name };
}

function mgFormatName(name) {
  if (!name) return '';
  const lower = name.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function memoryWsUrl() {
  const host = window.location.hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1';

  if (!isLocal) {
    return 'wss://two222-h9x4.onrender.com';
  }

  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const localHost = host || 'localhost';
  const port = 8080;
  return `${protocol}://${localHost}:${port}`;
}

function memoryConnect() {
  return new Promise((resolve, reject) => {
    if (memorySocket && memorySocket.readyState === WebSocket.OPEN) {
      return resolve(memorySocket);
    }

    const url = memoryWsUrl();
    memorySocket = new WebSocket(url);

    memorySocket.onopen = () => resolve(memorySocket);

    memorySocket.onerror = (err) => {
      console.error('WS error (memory)', err);
      const st =
        document.getElementById('memory-status-text') || document.getElementById('memory-lobby-status');
      if (st) st.textContent = 'Nu m-am putut conecta la server. Incearca mai tarziu.';
      reject(err);
    };

    memorySocket.onclose = () => {
      const st =
        document.getElementById('memory-status-text') || document.getElementById('memory-lobby-status');
      if (st) st.textContent = 'Conexiune inchisa de server.';
    };

    memorySocket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleMemoryMessage(msg);
      } catch (e) {
        console.error('Mesaj JSON invalid (memory)', e);
      }
    };
  });
}

function memorySend(msg) {
  if (!memorySocket || memorySocket.readyState !== WebSocket.OPEN) {
    const st =
      document.getElementById('memory-status-text') || document.getElementById('memory-lobby-status');
    if (st) st.textContent = 'Nu esti conectat la server.';
    return;
  }
  memorySocket.send(JSON.stringify(msg));
}

function handleMemoryMessage(msg) {
  const page = document.body.dataset.page;

  if (msg.type === 'memory_room_created') {
    if (page === 'memory-lobby') {
      const roomCode = msg.roomCode;
      window.location.href = `memory-game.html?room=${roomCode}&player=${encodeURIComponent(
        memoryPlayerName || 'Anonim'
      )}&mode=${encodeURIComponent(memoryMode)}`;
    }
    return;
  }

  if (page === 'memory-lobby') {
    if (msg.type === 'memory_error') {
      const el = document.getElementById('memory-lobby-status');
      if (el) el.textContent = msg.message;
      alert(msg.message);
    }
    return;
  }

  if (page === 'memory-game') {
    switch (msg.type) {
      case 'memory_state':
        applyMemoryState(msg.state);
        break;
      case 'memory_error':
        alert(msg.message);
        const st = document.getElementById('memory-status-text');
        if (st) st.textContent = msg.message;
        break;
      case 'memory_game_over':
        handleMemoryGameOver(msg);
        break;
      default:
        break;
    }
  }
}

async function ensureMemoryImagesForBoard(state) {
  if (!state || !Array.isArray(state.board)) return;

  const pairIds = Array.from(
    new Set(
      state.board
        .map((c) => c.pairId)
        .filter((id) => typeof id === 'number' && Number.isFinite(id))
    )
  );

  if (!pairIds.length) return;

  if (!memoryImageMap) {
    memoryImageMap = {};
  }

  const missing = pairIds.filter((id) => !(id in memoryImageMap));
  if (!missing.length) return;

  // Avem nevoie de poze din galerie doar daca exista clientul Supabase global
  if (typeof _supabase === 'undefined') return;

  try {
    const { data, error } = await _supabase
      .from('Poze')
      .select('id, url')
      .order('id', { ascending: true })
      .limit(60);

    if (error || !data || !data.length) {
      console.error('Nu am putut incarca poze pentru Memory Game:', error || 'fara date');
      return;
    }

    const urls = data.map((p) => p.url);
    const sortedIds = missing.slice().sort((a, b) => a - b);

    sortedIds.forEach((pid, idx) => {
      const url = urls[idx % urls.length];
      memoryImageMap[pid] = url;
    });
  } catch (e) {
    console.error('Eroare la incarcarea pozelor pentru Memory Game:', e);
  }
}

// LOBBY

function initMemoryLobby() {
  const nameInput = document.getElementById('memory-player-name');
  const createBtn = document.getElementById('memory-create-room');
  const joinBtn = document.getElementById('memory-join-room');
  const roomInput = document.getElementById('memory-room-code');
  const modeCards = document.querySelectorAll('.memory-mode-card');

  const user = mgGetLoggedInUser();
  if (user && nameInput) {
    nameInput.value = mgFormatName(user.name);
  }

  modeCards.forEach((card) => {
    const mode = card.dataset.mode || 'easy';
    if (mode === memoryMode) {
      card.classList.add('btn-selected');
    }
    card.addEventListener('click', () => {
      modeCards.forEach((c) => c.classList.remove('btn-selected'));
      card.classList.add('btn-selected');
      memoryMode = mode;
    });
  });

  createBtn.addEventListener('click', async () => {
    const name = (nameInput.value || '').trim();
    if (!name) {
      alert('Te rog sa introduci un nume.');
      return;
    }
    memoryPlayerName = name;
    memoryIsHost = true;
    try {
      await memoryConnect();
      memorySend({ type: 'memory_create_room', playerName: name, mode: memoryMode });
      const st = document.getElementById('memory-lobby-status');
      if (st) st.textContent = 'Se genereaza camera...';
    } catch (_) {}
  });

  joinBtn.addEventListener('click', async () => {
    const name = (nameInput.value || '').trim();
    const code = (roomInput.value || '').trim().toUpperCase();
    if (!name) {
      alert('Te rog sa introduci un nume.');
      return;
    }
    if (code.length !== 4) {
      alert('Codul camerei trebuie sa aiba 4 litere.');
      return;
    }
    window.location.href = `memory-game.html?room=${code}&player=${encodeURIComponent(name)}`;
  });
}

// GAME

function initMemoryGame() {
  const params = new URLSearchParams(window.location.search);
  memoryRoomCode = (params.get('room') || '').toUpperCase();
  memoryPlayerName = params.get('player') || 'Anonim';
  memoryMode = params.get('mode') || 'easy';

  document.getElementById('memory-room-code-display').textContent = memoryRoomCode || '-';
  document.getElementById('memory-you-name').textContent = memoryPlayerName;

  const modeLabel = document.getElementById('memory-mode-label');
  if (modeLabel) {
    if (memoryMode === 'easy') modeLabel.textContent = 'Mod: Easy – putine perechi, joc relaxat.';
    else if (memoryMode === 'medium') modeLabel.textContent = 'Mod: Medium – echilibru intre distractie si provocare.';
    else if (memoryMode === 'hard') modeLabel.textContent = 'Mod: Hard – multe perechi, doar pentru pro!';
  }

  memoryConnect()
    .then(() => {
      memorySend({
        type: 'memory_join_room',
        roomCode: memoryRoomCode,
        playerName: memoryPlayerName,
        mode: memoryMode,
      });
    })
    .catch(() => {});

  const playAgainBtn = document.getElementById('memory-play-again');
  const homeBtn = document.getElementById('memory-home');

  if (playAgainBtn) {
    playAgainBtn.addEventListener('click', () => {
      if (!memoryRoomCode) return;
      memorySend({ type: 'memory_play_again' });
    });
  }
  if (homeBtn) {
    homeBtn.addEventListener('click', () => {
      window.location.href = '../2222.html';
    });
  }
}

async function applyMemoryState(state) {
  if (!state) return;

  await ensureMemoryImagesForBoard(state);

  const statusEl = document.getElementById('memory-status-text');
  const opponentEl = document.getElementById('memory-opponent-name');
  const gameSection = document.getElementById('memory-game-section');
  const overSection = document.getElementById('memory-over-section');
  const boardEl = document.getElementById('memory-board');
  const turnInfo = document.getElementById('memory-turn-info');
  const scoreYouEl = document.getElementById('memory-score-you');
  const scoreOppEl = document.getElementById('memory-score-opponent');

  if (opponentEl) opponentEl.textContent = state.opponentName || 'Asteptam adversarul';

  let statusText = '';
  switch (state.status) {
    case 'waiting':
      statusText = 'Asteptam sa intre si adversarul in camera.';
      break;
    case 'active':
      statusText = 'Joc in desfasurare.';
      break;
    case 'finished':
      statusText = 'Joc terminat.';
      break;
    default:
      statusText = '';
  }
  if (statusEl) statusEl.textContent = statusText;

  if (state.status === 'active') {
    if (gameSection) gameSection.style.display = 'block';
    if (overSection) overSection.style.display = 'none';
  } else if (state.status === 'finished') {
    if (overSection) overSection.style.display = 'block';
  }

  memoryCurrentTurn = state.currentTurn;
  if (turnInfo) {
    if (state.currentTurn === 'you') {
      turnInfo.textContent = 'Este randul tau: intoarce doua carti.';
    } else if (state.currentTurn === 'opponent') {
      turnInfo.textContent = 'Este randul adversarului. Asteapta miscarile lui.';
    } else {
      turnInfo.textContent = '';
    }
  }

  memoryYourScore = state.yourScore || 0;
  memoryOpponentScore = state.opponentScore || 0;
  if (scoreYouEl) scoreYouEl.textContent = String(memoryYourScore);
  if (scoreOppEl) scoreOppEl.textContent = String(memoryOpponentScore);

  memoryPairs = state.totalPairs || 0;

  // board: array de obiecte { pairId, revealed, matched, imageUrl }
  const boardWithImages = (state.board || []).map((card) => {
    const imageUrl =
      memoryImageMap && typeof card.pairId === 'number'
        ? memoryImageMap[card.pairId] || null
        : null;
    return {
      pairId: card.pairId,
      revealed: !!card.revealed,
      matched: !!card.matched,
      imageUrl,
    };
  });

  memoryBoard = boardWithImages;
  if (boardEl) {
    boardEl.innerHTML = '';
    memoryBoard.forEach((card, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'memory-card';
      btn.dataset.index = String(idx);

      const isMatched = !!card.matched;
      const isRevealed = !!card.revealed;

      if (isMatched) btn.classList.add('matched');
      if (isRevealed) btn.classList.add('revealed');

      const inner = document.createElement('div');
      inner.className = 'memory-card-inner';

      const front = document.createElement('div');
      front.className = 'memory-card-front';

      const back = document.createElement('div');
      back.className = 'memory-card-back';

      if (card.imageUrl) {
        const img = document.createElement('img');
        img.src = card.imageUrl;
        img.alt = 'Poza memorie';
        back.appendChild(img);
      } else {
        back.textContent = '❤️';
      }

      inner.appendChild(front);
      inner.appendChild(back);
      btn.appendChild(inner);

      const canClick =
        state.status === 'active' && state.currentTurn === 'you' && !isMatched && !isRevealed;
      btn.disabled = !canClick;
      if (canClick) {
        btn.addEventListener('click', onMemoryCardClick);
      }

      boardEl.appendChild(btn);
    });
  }
}

function onMemoryCardClick(evt) {
  const btn = evt.currentTarget;
  const idxStr = btn.dataset.index;
  const idx = parseInt(idxStr, 10);
  if (Number.isNaN(idx)) return;

  memorySend({ type: 'memory_flip', index: idx });
}

function handleMemoryGameOver(msg) {
  const overText = document.getElementById('memory-over-text');
  const detail = document.getElementById('memory-over-detail');

  const loggedUser = mgGetLoggedInUser();
  const youName = mgFormatName(memoryPlayerName || (loggedUser && loggedUser.name) || 'Tu');
  const oppName = mgFormatName(msg.opponentName || 'Adversarul');

  let text = '';
  let detailText = '';
  let youWon = false;

  if (msg.winner === 'you') {
    youWon = true;
    text = `A castigat ${youName}!`;
  } else if (msg.winner === 'opponent') {
    text = `A castigat ${oppName}.`;
  } else {
    text = 'Egalitate perfecta!';
  }

  detailText = `Perechile tale: ${msg.yourScore} • Perechile adversarului: ${msg.opponentScore}`;

  if (youWon && typeof recordWin === 'function') {
    // Crestere in clasament doar daca nu e egalitate si tu ai mai multe perechi
    recordWin('memory');
  }

  if (overText) overText.textContent = text;
  if (detail) detail.textContent = detailText;
}

// ENTRY

document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if (page === 'memory-lobby') {
    initMemoryLobby();
  } else if (page === 'memory-game') {
    initMemoryGame();
  }
});
