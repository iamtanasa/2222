// client/macao.js
// Logica de UI + WebSocket pentru jocul Macao 2-jucatori

let macaoSocket = null;
let macaoRoomCode = null;
let macaoPlayerName = null;
let macaoPendingCreateName = null;
let macaoLastState = null; // ultimul state primit, folosit pentru tap pe pachet

function macaoWsUrl() {
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

function macaoConnectWebSocket() {
  return new Promise((resolve, reject) => {
    if (macaoSocket && macaoSocket.readyState === WebSocket.OPEN) {
      return resolve(macaoSocket);
    }

    const url = macaoWsUrl();
    macaoSocket = new WebSocket(url);

    macaoSocket.onopen = () => {
      resolve(macaoSocket);
    };

    macaoSocket.onerror = (err) => {
      console.error('WS error', err);
      const statusEl =
        document.getElementById('macao-status-text') || document.getElementById('macao-lobby-status');
      if (statusEl) statusEl.textContent = 'Nu m-am putut conecta la server. Ruleaza `node server/server.js`.';
      reject(err);
    };

    macaoSocket.onclose = () => {
      const statusEl =
        document.getElementById('macao-status-text') || document.getElementById('macao-lobby-status');
      if (statusEl) statusEl.textContent = 'Conexiune inchisa de server.';
    };

    macaoSocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleMacaoServerMessage(message);
      } catch (e) {
        console.error('Mesaj JSON invalid de la server (macao)', e);
      }
    };
  });
}

function macaoSend(msg) {
  if (!macaoSocket || macaoSocket.readyState !== WebSocket.OPEN) {
    const statusEl =
      document.getElementById('macao-status-text') || document.getElementById('macao-lobby-status');
    if (statusEl) statusEl.textContent = 'Nu esti conectat la server.';
    return;
  }
  macaoSocket.send(JSON.stringify(msg));
}

function handleMacaoServerMessage(message) {
  const page = document.body.dataset.page;

  if (message.type === 'macao_room_created') {
    if (page === 'macao-lobby' && macaoPendingCreateName) {
      const roomCode = message.roomCode;
      window.location.href = `macao-game.html?room=${roomCode}&player=${encodeURIComponent(
        macaoPendingCreateName
      )}`;
    }
    return;
  }

  if (page === 'macao-game') {
    switch (message.type) {
      case 'macao_state':
        applyMacaoState(message.state);
        break;
      case 'macao_error':
        alert(message.message);
        const statusEl = document.getElementById('macao-status-text');
        if (statusEl) statusEl.textContent = message.message || '';
        break;
      case 'macao_game_over':
        handleMacaoGameOver(message);
        break;
      default:
        break;
    }
  } else if (page === 'macao-lobby') {
    if (message.type === 'macao_error') {
      alert(message.message);
      const lobbyStatus = document.getElementById('macao-lobby-status');
      if (lobbyStatus) lobbyStatus.textContent = message.message || '';
    }
  }
}

// --------------------------------------------------
// LOBBY
// --------------------------------------------------

function initMacaoLobby() {
  const nameInput = document.getElementById('macao-player-name');
  const createBtn = document.getElementById('macao-create-room');
  const joinBtn = document.getElementById('macao-join-room');
  const roomInput = document.getElementById('macao-room-code');

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

    macaoPendingCreateName = name;
    try {
      await macaoConnectWebSocket();
      macaoSend({ type: 'macao_create_room' });
      const lobbyStatus = document.getElementById('macao-lobby-status');
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

    window.location.href = `macao-game.html?room=${code}&player=${encodeURIComponent(name)}`;
  });
}

// --------------------------------------------------
// GAME
// --------------------------------------------------

function initMacaoGame() {
  const params = new URLSearchParams(window.location.search);
  macaoRoomCode = (params.get('room') || '').toUpperCase();
  macaoPlayerName = params.get('player') || 'Anonim';

  const roomDisplay = document.getElementById('macao-room-code-display');
  const youNameEl = document.getElementById('macao-you-name');
  if (roomDisplay) roomDisplay.textContent = macaoRoomCode || '-';
  if (youNameEl) youNameEl.textContent = macaoPlayerName;

  const backTop = document.getElementById('macao-back-top');
  if (backTop) {
    backTop.addEventListener('click', () => {
      window.location.href = '../2222.html';
    });
  }

  const drawBtn = document.getElementById('macao-draw-btn');
  if (drawBtn) {
    drawBtn.addEventListener('click', () => {
      macaoSend({ type: 'macao_draw' });
    });
  }

  const drawPile = document.getElementById('macao-draw-pile');
  if (drawPile) {
    drawPile.addEventListener('click', () => {
      if (!macaoLastState) return;
      if (!(macaoLastState.status === 'active' && macaoLastState.yourTurn)) return;
      macaoSend({ type: 'macao_draw' });
    });
  }

  const playAgainOverlay = document.getElementById('macao-play-again-overlay');
  if (playAgainOverlay) {
    playAgainOverlay.addEventListener('click', () => {
      macaoSend({ type: 'macao_play_again' });
    });
  }

  const homeOverlay = document.getElementById('macao-home-overlay');
  if (homeOverlay) {
    homeOverlay.addEventListener('click', () => {
      window.location.href = '../2222.html';
    });
  }

  macaoConnectWebSocket()
    .then(() => {
      macaoSend({
        type: 'macao_join_room',
        roomCode: macaoRoomCode,
        playerName: macaoPlayerName,
      });
    })
    .catch(() => {});
}

function macaoPngPathForCard(card) {
  if (!card) return '';
  const { suit, rank } = card;

  if (suit === 'joker') {
    return rank === 'JOKER_BLACK'
      ? '../server/node_modules/svg-cards/png/2x/joker_black.png'
      : '../server/node_modules/svg-cards/png/2x/joker_red.png';
  }

  const suitId = suit; // 'heart', 'diamond', 'club', 'spade'
  let rankId = '';
  if (rank === 'J') rankId = 'jack';
  else if (rank === 'Q') rankId = 'queen';
  else if (rank === 'K') rankId = 'king';
  else if (rank === 'A') rankId = '1';
  else rankId = String(rank);

  return `../server/node_modules/svg-cards/png/2x/${suitId}_${rankId}.png`;
}

function renderMacaoCardFace(card) {
  const src = macaoPngPathForCard(card);
  if (!src) return '';
  return `<img class="card-img" src="${src}" alt="card" />`;
}

function renderMacaoCardBack() {
  const src = '../server/node_modules/svg-cards/png/2x/back-red.png';
  const fallback = '../server/node_modules/svg-cards/png/2x/back.png';
  // încercăm un spate roșu dacă există, altfel folosim back.png
  return `<img class="card-img" src="${src}" onerror="this.src='${fallback}'" alt="back" />`;
}

function applyMacaoState(state) {
  if (!state) return;

  macaoLastState = state;

  const statusEl = document.getElementById('macao-status-text');
  const turnIndicator = document.getElementById('macao-turn-indicator');
  const attackInfo = document.getElementById('macao-attack-info');
  const oppNameEl = document.getElementById('macao-opponent-name');
  const oppHandEl = document.getElementById('macao-opponent-hand');
  const playerHandEl = document.getElementById('macao-player-hand');
  const drawCountEl = document.getElementById('macao-draw-count');
  const topDiscardEl = document.getElementById('macao-top-discard');
  const drawBtn = document.getElementById('macao-draw-btn');
  const overSection = document.getElementById('macao-over-section');
  const overText = document.getElementById('macao-over-text');
  const overRoom = document.getElementById('macao-over-room');

  if (oppNameEl) oppNameEl.textContent = state.opponentName || 'Asteptam adversarul';

  if (state.status === 'waiting') {
    if (statusEl) statusEl.textContent = 'Așteptăm să intre și adversarul în cameră.';
  } else if (state.status === 'active') {
    if (statusEl) statusEl.textContent = '';
  } else if (state.status === 'finished') {
    if (statusEl) statusEl.textContent = 'Joc terminat.';
  }

  if (turnIndicator) {
    if (state.status !== 'active') {
      turnIndicator.textContent = '';
    } else if (state.yourTurn) {
      turnIndicator.textContent = 'Este randul tau.';
    } else {
      turnIndicator.textContent = 'Este randul adversarului.';
    }
  }

  if (attackInfo) {
    if (state.attackActive && state.pendingDraw > 0) {
      attackInfo.textContent = `Atac activ: trebuie trase ${state.pendingDraw} carti.`;
    } else {
      attackInfo.textContent = '';
    }
  }

  // ascundem fereastra de game over cand jocul nu este terminat
  if (overSection && state.status !== 'finished') {
    overSection.style.display = 'none';
  }

  if (oppHandEl) {
    oppHandEl.innerHTML = '';
    const count = state.opponentCardCount || 0;
    for (let i = 0; i < count; i++) {
      const div = document.createElement('div');
      div.className = 'macao-card macao-card-back';
      div.innerHTML = renderMacaoCardBack();
      oppHandEl.appendChild(div);
    }
  }

  if (playerHandEl) {
    playerHandEl.innerHTML = '';
    (state.yourHand || []).forEach((card) => {
      const div = document.createElement('div');
      div.className = 'macao-card macao-card-face';
      div.innerHTML = renderMacaoCardFace(card);
      div.dataset.cardId = card.id;
      div.addEventListener('click', () => {
        if (!state.yourTurn || state.status !== 'active') return;
        macaoSend({ type: 'macao_play', cardId: card.id });
      });
      playerHandEl.appendChild(div);
    });
  }

  if (drawCountEl) {
    drawCountEl.textContent = String(state.drawPileCount || 0);
  }

  if (topDiscardEl) {
    topDiscardEl.innerHTML = '';
    if (state.topDiscard) {
      topDiscardEl.innerHTML = renderMacaoCardFace(state.topDiscard);
    }
  }

  if (drawBtn) {
    drawBtn.disabled = !(state.status === 'active' && state.yourTurn);
  }

  // cand primim un state "finished", afisam si fereastra de game over cu info de baza
  if (overSection && overText && state.status === 'finished') {
    overSection.style.display = 'block';
    // textul final este setat in handleMacaoGameOver; aici nu il mai suprascriem
    if (overRoom && macaoRoomCode) {
      overRoom.textContent = `Camera: ${macaoRoomCode}`;
    }
  }
}

function handleMacaoGameOver(msg) {
  if (!msg) return;

  if (typeof recordWin === 'function') {
    if (msg.winner === 'you') {
      recordWin('macao');
    }
  }

  const statusEl = document.getElementById('macao-status-text');
  if (statusEl) {
    if (msg.winner === 'you') statusEl.textContent = `${macaoPlayerName} a castigat jocul!`;
    else if (msg.winner === 'opponent') {
      const oppName = macaoLastState && macaoLastState.opponentName ? macaoLastState.opponentName : 'Adversarul';
      statusEl.textContent = `${oppName} a castigat jocul. ${macaoPlayerName}, ai pierdut.`;
    } else {
      statusEl.textContent = 'Joc terminat.';
    }
  }

  const drawBtn = document.getElementById('macao-draw-btn');
  if (drawBtn) drawBtn.disabled = true;

  const overSection2 = document.getElementById('macao-over-section');
  const overText2 = document.getElementById('macao-over-text');
  const overRoom2 = document.getElementById('macao-over-room');
  if (overSection2 && overText2) {
    overSection2.style.display = 'block';
    const oppName = macaoLastState && macaoLastState.opponentName ? macaoLastState.opponentName : 'Adversarul';
    if (msg.winner === 'you') {
      overText2.textContent = `${macaoPlayerName} a castigat jocul!`;
    } else if (msg.winner === 'opponent') {
      overText2.textContent = `${oppName} a castigat jocul. ${macaoPlayerName}, ai pierdut.`;
    } else {
      overText2.textContent = 'Joc terminat.';
    }
    if (overRoom2 && macaoRoomCode) {
      overRoom2.textContent = `Camera: ${macaoRoomCode}`;
    }
  }
}

function goBackToUniverse() {
  window.location.href = '../2222.html';
}

window.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if (page === 'macao-lobby') {
    initMacaoLobby();
  } else if (page === 'macao-game') {
    initMacaoGame();
  }
});
