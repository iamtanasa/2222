// client/razboi.js
// Logica de UI + WebSocket pentru jocul de carti Razboi (varianta cu numar)

let razboiSocket = null;
let razboiRoomCode = null;
let razboiPlayerName = null;
let razboiPendingCreateName = null;
let razboiLastState = null;
let razboiCanPlay = true;
let razboiCooldownTimer = null;
let razboiHideCardsTimer = null;

function razboiWsUrl() {
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

function razboiConnectWebSocket() {
  return new Promise((resolve, reject) => {
    if (razboiSocket && razboiSocket.readyState === WebSocket.OPEN) {
      return resolve(razboiSocket);
    }

    const url = razboiWsUrl();
    razboiSocket = new WebSocket(url);

    razboiSocket.onopen = () => resolve(razboiSocket);

    razboiSocket.onerror = (err) => {
      console.error('WS error (razboi)', err);
      const statusEl =
        document.getElementById('razboi-status-text') || document.getElementById('razboi-lobby-status');
      if (statusEl) statusEl.textContent = 'Nu m-am putut conecta la server. Ruleaza `node server/server.js`.';
      reject(err);
    };

    razboiSocket.onclose = () => {
      const statusEl =
        document.getElementById('razboi-status-text') || document.getElementById('razboi-lobby-status');
      if (statusEl) statusEl.textContent = 'Conexiune inchisa de server.';
    };

    razboiSocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleRazboiServerMessage(message);
      } catch (e) {
        console.error('Mesaj JSON invalid de la server (razboi)', e);
      }
    };
  });
}

function razboiSend(msg) {
  if (!razboiSocket || razboiSocket.readyState !== WebSocket.OPEN) {
    const statusEl =
      document.getElementById('razboi-status-text') || document.getElementById('razboi-lobby-status');
    if (statusEl) statusEl.textContent = 'Nu esti conectat la server.';
    return;
  }
  razboiSocket.send(JSON.stringify(msg));
}

function handleRazboiServerMessage(message) {
  const page = document.body.dataset.page;

  if (message.type === 'razboi_room_created') {
    if (page === 'razboi-lobby' && razboiPendingCreateName) {
      const roomCode = message.roomCode;
      window.location.href = `razboi-game.html?room=${roomCode}&player=${encodeURIComponent(
        razboiPendingCreateName
      )}`;
    }
    return;
  }

  if (page === 'razboi-game') {
    switch (message.type) {
      case 'razboi_state':
        applyRazboiState(message.state);
        break;
      case 'razboi_error':
        alert(message.message);
        const statusEl = document.getElementById('razboi-status-text');
        if (statusEl) statusEl.textContent = message.message || '';
        break;
      case 'razboi_game_over':
        handleRazboiGameOver(message);
        break;
      default:
        break;
    }
  } else if (page === 'razboi-lobby') {
    if (message.type === 'razboi_error') {
      alert(message.message);
      const lobbyStatus = document.getElementById('razboi-lobby-status');
      if (lobbyStatus) lobbyStatus.textContent = message.message || '';
    }
  }
}

// --------------------------------------------------
// LOBBY
// --------------------------------------------------

function initRazboiLobby() {
  const nameInput = document.getElementById('razboi-player-name');
  const createBtn = document.getElementById('razboi-create-room');
  const joinBtn = document.getElementById('razboi-join-room');
  const roomInput = document.getElementById('razboi-room-code');

  const user = typeof getLoggedInUser === 'function' ? getLoggedInUser() : null;
  if (user && nameInput) {
    const rawName = user.name || '';
    nameInput.value = rawName.charAt(0).toUpperCase() + rawName.slice(1);
  }

  createBtn.addEventListener('click', async () => {
    const name = (nameInput.value || '').trim();
    if (!name) {
      alert('Te rog sa introduci un nume.');
      return;
    }

    razboiPendingCreateName = name;
    try {
      await razboiConnectWebSocket();
      razboiSend({ type: 'razboi_create_room' });
      const lobbyStatus = document.getElementById('razboi-lobby-status');
      if (lobbyStatus) lobbyStatus.textContent = 'Se genereaza camera...';
    } catch (_) {}
  });

  joinBtn.addEventListener('click', () => {
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

    window.location.href = `razboi-game.html?room=${code}&player=${encodeURIComponent(name)}`;
  });
}

// --------------------------------------------------
// GAME
// --------------------------------------------------

function razboiPngPathForCard(card) {
  if (!card) return '';
  const { suit, rank } = card;

  const suitId = suit; // 'heart', 'diamond', 'club', 'spade'
  let rankId = '';
  if (rank === 'J') rankId = 'jack';
  else if (rank === 'Q') rankId = 'queen';
  else if (rank === 'K') rankId = 'king';
  else if (rank === 'A') rankId = '1';
  else rankId = String(rank);

  return `../server/node_modules/svg-cards/png/2x/${suitId}_${rankId}.png`;
}

function renderRazboiCardFace(card) {
  const src = razboiPngPathForCard(card);
  if (!src) return '';
  return `<img class="card-img" src="${src}" alt="card" />`;
}

function initRazboiGame() {
  const params = new URLSearchParams(window.location.search);
  razboiRoomCode = (params.get('room') || '').toUpperCase();
  razboiPlayerName = params.get('player') || 'Anonim';

  const roomDisplay = document.getElementById('razboi-room-code-display');
  const youNameEl = document.getElementById('razboi-you-name');
  if (roomDisplay) roomDisplay.textContent = razboiRoomCode || '-';
  if (youNameEl) youNameEl.textContent = razboiPlayerName;

  const backTop = document.getElementById('razboi-back-top');
  if (backTop) {
    backTop.addEventListener('click', () => {
      window.location.href = '../2222.html';
    });
  }

  const youDeck = document.getElementById('razboi-you-deck');
  if (youDeck) {
    youDeck.addEventListener('click', () => {
      if (!razboiLastState || razboiLastState.status !== 'active') return;
      if (!razboiCanPlay) return;
      razboiCanPlay = false;
      razboiSend({ type: 'razboi_play_round' });
    });
  }

  const playAgainOverlay = document.getElementById('razboi-play-again-overlay');
  if (playAgainOverlay) {
    playAgainOverlay.addEventListener('click', () => {
      razboiSend({ type: 'razboi_play_again' });
    });
  }

  const homeOverlay = document.getElementById('razboi-home-overlay');
  if (homeOverlay) {
    homeOverlay.addEventListener('click', () => {
      window.location.href = '../2222.html';
    });
  }

  razboiConnectWebSocket()
    .then(() => {
      razboiSend({
        type: 'razboi_join_room',
        roomCode: razboiRoomCode,
        playerName: razboiPlayerName,
      });
    })
    .catch(() => {});
}

function applyRazboiState(state) {
  if (!state) return;

  razboiLastState = state;

  const statusEl = document.getElementById('razboi-status-text');
  const oppNameEl = document.getElementById('razboi-opponent-name');
  const youNameEl = document.getElementById('razboi-you-name');
  const oppLastEl = document.getElementById('razboi-opponent-last');
  const youLastEl = document.getElementById('razboi-you-last');
  const oppCountEl = document.getElementById('razboi-opponent-count');
  const youCountEl = document.getElementById('razboi-you-count');
  const messageEl = document.getElementById('razboi-message');
  const battleSizeEl = document.getElementById('razboi-battle-size');
  const overSection = document.getElementById('razboi-over-section');
  const overRoom = document.getElementById('razboi-over-room');

  if (oppNameEl) oppNameEl.textContent = state.opponentName || 'Asteptam adversarul';
  if (youNameEl && state.youName) youNameEl.textContent = state.youName;

  if (statusEl) {
    if (state.status === 'waiting') statusEl.textContent = 'Așteptăm să intre și adversarul în cameră.';
    else if (state.status === 'active') statusEl.textContent = '';
    else if (state.status === 'finished') statusEl.textContent = 'Joc terminat.';
  }

  if (oppLastEl) {
    oppLastEl.innerHTML = '';
    if (state.lastOpponentCard) {
      oppLastEl.innerHTML = renderRazboiCardFace(state.lastOpponentCard);
    }
  }

  if (youLastEl) {
    youLastEl.innerHTML = '';
    if (state.lastYouCard) {
      youLastEl.innerHTML = renderRazboiCardFace(state.lastYouCard);
    }
  }

  if (oppCountEl) oppCountEl.textContent = String(state.opponentDeckCount || 0);
  if (youCountEl) youCountEl.textContent = String(state.yourDeckCount || 0);
  if (messageEl) messageEl.textContent = state.message || '';
  if (battleSizeEl) battleSizeEl.textContent = String(state.battleSize || 0);

  // controlam cand mai putem apasa si cand se ascund ultimele carti
  if (razboiCooldownTimer) {
    clearTimeout(razboiCooldownTimer);
    razboiCooldownTimer = null;
  }
  if (razboiHideCardsTimer) {
    clearTimeout(razboiHideCardsTimer);
    razboiHideCardsTimer = null;
  }

  if (state.status === 'active') {
    if (state.inWar) {
      // in razboi: nu ascundem cartile automat si nu blocam apasarile
      razboiCanPlay = true;
    } else {
      const bothCardsVisible = !!(state.lastYouCard && state.lastOpponentCard);

      if (bothCardsVisible) {
        // runda normala: afisam ambele carti 2 secunde, apoi dispar
        razboiCanPlay = false;
        razboiCooldownTimer = setTimeout(() => {
          razboiCanPlay = true;
        }, 2000);

        razboiHideCardsTimer = setTimeout(() => {
          const oppLastEl2 = document.getElementById('razboi-opponent-last');
          const youLastEl2 = document.getElementById('razboi-you-last');
          if (oppLastEl2) oppLastEl2.innerHTML = '';
          if (youLastEl2) youLastEl2.innerHTML = '';
        }, 2000);
      } else {
        // doar o singura carte intoarsa in runda normala
        razboiCanPlay = true;
      }
    }
  } else {
    razboiCanPlay = false;
  }

  if (overSection && state.status !== 'finished') {
    overSection.style.display = 'none';
  }

  if (overRoom && razboiRoomCode) {
    overRoom.textContent = `Camera: ${razboiRoomCode}`;
  }
}

function handleRazboiGameOver(msg) {
  if (!msg) return;

  if (typeof recordWin === 'function') {
    if (msg.winner === 'you') {
      recordWin('razboi');
    }
  }

  const statusEl = document.getElementById('razboi-status-text');
  const overSection = document.getElementById('razboi-over-section');
  const overText = document.getElementById('razboi-over-text');
  const overRoom = document.getElementById('razboi-over-room');

  const oppName = msg.opponentName || (razboiLastState && razboiLastState.opponentName) || 'Adversarul';

  if (statusEl) {
    if (msg.winner === 'you') statusEl.textContent = `${razboiPlayerName} a castigat jocul!`;
    else if (msg.winner === 'opponent') statusEl.textContent = `${oppName} a castigat jocul. ${razboiPlayerName}, ai pierdut.`;
    else statusEl.textContent = 'Joc terminat.';
  }

  razboiCanPlay = false;

  if (overSection && overText) {
    overSection.style.display = 'block';
    if (msg.winner === 'you') overText.textContent = `${razboiPlayerName} a castigat jocul!`;
    else if (msg.winner === 'opponent') overText.textContent = `${oppName} a castigat jocul. ${razboiPlayerName}, ai pierdut.`;
    else overText.textContent = 'Joc terminat.';
    if (overRoom && razboiRoomCode) {
      overRoom.textContent = `Camera: ${razboiRoomCode}`;
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if (page === 'razboi-lobby') {
    initRazboiLobby();
  } else if (page === 'razboi-game') {
    initRazboiGame();
  }
});
