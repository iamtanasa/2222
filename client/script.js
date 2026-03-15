// client/script.js
// Logica de UI + WebSocket pentru Bulls & Cows (lobby + joc)

// Folosim același helper ca în pagina principală, dacă există
function bcGetLoggedInUser() {
  if (typeof getLoggedInUser === 'function') {
    return getLoggedInUser();
  }
  const idStr = localStorage.getItem('berea_user_id');
  const name = localStorage.getItem('berea_username');
  if (!idStr || !name) return null;
  const id = parseInt(idStr, 10);
  if (!id || Number.isNaN(id)) return null;
  return { id, name };
}

function formatPlayerName(name) {
  if (!name) return '';
  const lower = name.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

let socket = null;
let currentRoomCode = null;
let currentPlayerName = null;
let pendingCreateName = null; // folosit în lobby când așteptăm room_created
let mySecretValue = null; // salvează local numărul secret trimis de tine
let lastGameState = null; // ultimul state primit, folosit la ecranul de final
let guessActive = false; // controlează dacă keypad-ul pentru ghicit este activ
let _bcReconnectTimer = null;
let _bcReconnectDelay = 1000;
let _bcPingInterval = null;

function wsUrl() {
  const host = window.location.hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1';

  // În producție folosim serverul de pe Render
  if (!isLocal) {
    return 'wss://two222-h9x4.onrender.com';
  }

  // Local: ne conectăm la serverul pornit manual pe 8080
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const localHost = host || 'localhost';
  const port = 8080; // trebuie să corespundă cu server/server.js
  return `${protocol}://${localHost}:${port}`;
}

function _bcStartPing() {
  _bcStopPing();
  _bcPingInterval = setInterval(() => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'ping' }));
    }
  }, 20000);
}
function _bcStopPing() {
  if (_bcPingInterval) { clearInterval(_bcPingInterval); _bcPingInterval = null; }
}
function _bcScheduleReconnect() {
  if (_bcReconnectTimer) return;
  _bcReconnectTimer = setTimeout(() => {
    _bcReconnectTimer = null;
    connectWebSocket().catch(() => {});
  }, _bcReconnectDelay);
  _bcReconnectDelay = Math.min(_bcReconnectDelay * 2, 15000);
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && (!socket || socket.readyState !== WebSocket.OPEN)) {
    _bcReconnectDelay = 1000;
    connectWebSocket().catch(() => {});
  }
});

function connectWebSocket() {
  return new Promise((resolve, reject) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      return resolve(socket);
    }

    const url = wsUrl();
    socket = new WebSocket(url);

    socket.onopen = () => {
      _bcReconnectDelay = 1000;
      _bcStartPing();
      // Re-join room daca eram intr-una
      if (currentRoomCode && currentPlayerName) {
        sendMessage({ type: 'join_room', roomCode: currentRoomCode, playerName: currentPlayerName });
      }
      resolve(socket);
    };

    socket.onerror = (err) => {
      console.error('WS error', err);
      const statusEl = document.getElementById('status-text') || document.getElementById('lobby-status');
      if (statusEl) statusEl.textContent = 'Se reconectează la server...';
      reject(err);
    };

    socket.onclose = () => {
      _bcStopPing();
      const statusEl = document.getElementById('status-text') || document.getElementById('lobby-status');
      if (statusEl) statusEl.textContent = 'Conexiune pierdută. Se reconectează...';
      _bcScheduleReconnect();
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'pong') return;
        handleServerMessage(message);
      } catch (e) {
        console.error('Mesaj JSON invalid de la server', e);
      }
    };
  });
}

function sendMessage(msg) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    const statusEl = document.getElementById('status-text') || document.getElementById('lobby-status');
    if (statusEl) statusEl.textContent = 'Nu ești conectat la server.';
    return;
  }
  socket.send(JSON.stringify(msg));
}

// --------------------------------------------------
// Handlers mesaje server
// --------------------------------------------------

function handleServerMessage(message) {
  const page = document.body.dataset.page;

  if (message.type === 'room_created') {
    if (page === 'lobby' && pendingCreateName) {
      const roomCode = message.roomCode;
      window.location.href = `game.html?room=${roomCode}&player=${encodeURIComponent(pendingCreateName)}`;
    }
    return;
  }

  if (page === 'game') {
    switch (message.type) {
      case 'state_update':
        applyGameState(message.state);
        break;
      case 'error':
        alert(message.message);
        const statusEl = document.getElementById('status-text');
        if (statusEl) statusEl.textContent = message.message;
        if (message.message && message.message.indexOf('Adversarul a ieșit din joc') !== -1) {
          setTimeout(() => {
            goBack();
          }, 1600);
        }
        break;
      case 'game_over':
        handleGameOver(message);
        break;
      default:
        console.warn('Mesaj necunoscut:', message.type);
    }
  } else if (page === 'lobby') {
    if (message.type === 'error') {
      alert(message.message);
      const lobbyStatus = document.getElementById('lobby-status');
      if (lobbyStatus) lobbyStatus.textContent = message.message;
    }
  }
}

// --------------------------------------------------
// LOBBY
// --------------------------------------------------

function initLobby() {
  const nameInput = document.getElementById('player-name');
  const createBtn = document.getElementById('create-room-btn-lobby');
  const joinBtn = document.getElementById('join-room-btn-lobby');
  const roomInput = document.getElementById('room-code-input');

   // Dacă suntem logați, completăm automat numele
  const user = bcGetLoggedInUser();
  if (user && nameInput) {
    nameInput.value = formatPlayerName(user.name);
  }

  createBtn.addEventListener('click', async () => {
    const name = (nameInput.value || '').trim();
    if (!name) {
      alert('Te rog să introduci un nume.');
      return;
    }

    pendingCreateName = name;
    try {
      await connectWebSocket();
      sendMessage({ type: 'create_room' });
      const lobbyStatus = document.getElementById('lobby-status');
      if (lobbyStatus) lobbyStatus.textContent = 'Se generează camera...';
    } catch (_) {}
  });

  joinBtn.addEventListener('click', () => {
    const name = (nameInput.value || '').trim();
    const code = (roomInput.value || '').trim().toUpperCase();

    if (!name) {
      alert('Te rog să introduci un nume.');
      return;
    }
    if (code.length !== 4) {
      alert('Codul camerei trebuie să aibă 4 litere.');
      return;
    }

    window.location.href = `game.html?room=${code}&player=${encodeURIComponent(name)}`;
  });
}

// --------------------------------------------------
// GAME
// --------------------------------------------------

function initGame() {
  const params = new URLSearchParams(window.location.search);
  currentRoomCode = (params.get('room') || '').toUpperCase();
  currentPlayerName = params.get('player') || 'Anonim';

  document.getElementById('room-code-display').textContent = currentRoomCode || '-';
  document.getElementById('you-name').textContent = currentPlayerName;

  connectWebSocket()
    .then(() => {
      sendMessage({
        type: 'join_room',
        roomCode: currentRoomCode,
        playerName: currentPlayerName,
      });
    })
    .catch(() => {});

  document.getElementById('set-secret-btn').addEventListener('click', onSetSecret);
  document.getElementById('guess-btn').addEventListener('click', onGuess);

  const rematchBtn = document.getElementById('rematch-btn');
  const homeBtn = document.getElementById('home-btn');
  if (rematchBtn) {
    rematchBtn.addEventListener('click', () => {
      // cerem rematch în aceeași cameră
      sendMessage({ type: 'rematch' });
      const rematchStatus = document.getElementById('rematch-status');
      if (rematchStatus) {
        rematchStatus.textContent = 'Ai cerut rematch. Așteptăm răspunsul adversarului...';
      }
    });
  }
  if (homeBtn) {
    homeBtn.addEventListener('click', () => {
      goBack();
    });
  }

  setupDigitInputs('secret');
  setupGuessKeypad();
}

function applyGameState(state) {
  if (!state) return;
  lastGameState = state;

  const statusEl = document.getElementById('status-text');
  const turnInfo = document.getElementById('turn-info');
  const opponentNameEl = document.getElementById('opponent-name');
  const secretSection = document.getElementById('secret-section');
  const gameSection = document.getElementById('game-section');
  const secretBtn = document.getElementById('set-secret-btn');
  const secretWaitText = document.getElementById('secret-wait-text');
  const overSection = document.getElementById('game-over-section');
  const rematchStatus = document.getElementById('rematch-status');

  if (opponentNameEl) opponentNameEl.textContent = state.opponentName || 'Așteptăm adversarul';

  // status general
  let statusText = '';
  let turnText = '';

  switch (state.status) {
    case 'waiting':
      statusText = 'Așteptăm să intre și adversarul în cameră.';
      turnText = 'Spune-i partenerului codul camerei.';
      break;
    case 'waiting_secrets':
      statusText = 'Așteptăm numerele secrete de la ambii jucători.';
      if (!state.yourSecretSet) {
        turnText = 'Trimite numărul tău secret.';
      } else if (!state.opponentSecretSet) {
        turnText = 'Așteptăm numărul secret al adversarului.';
      } else {
        turnText = 'Se pregătește primul tur...';
      }
      break;
    case 'active':
      statusText = 'Joc în desfășurare.';
      if (state.isYourTurn) {
        turnText = 'Este rândul tău. Ghiceste numărul adversarului.';
      } else {
        turnText = 'Este rândul adversarului. Așteaptă mutarea lui.';
      }
      break;
    case 'finished':
      statusText = 'Joc terminat.';
      break;
    case 'opponent_left':
      statusText = 'Adversarul a părăsit jocul.';
      break;
    default:
      statusText = 'Stare necunoscută.';
  }

  if (statusEl) statusEl.textContent = statusText;
  if (turnInfo) turnInfo.textContent = turnText;

  // mesaj special când ți-ai introdus numărul și aștepți adversarul
  if (secretWaitText) {
    if (state.yourSecretSet && (!state.opponentName || !state.opponentSecretSet)) {
      secretWaitText.textContent = 'Ai ales numărul. Așteptăm ca adversarul să intre și să își introducă numărul secret.';
    } else {
      secretWaitText.textContent = '';
    }
  }

  // controllere secret
  const canSetSecret = !state.yourSecretSet && state.status !== 'finished' && state.status !== 'active';
  setSecretEnabled(canSetSecret);
  if (secretBtn) secretBtn.disabled = !canSetSecret;

  // controllere guess
  const canGuess = state.status === 'active' && state.isYourTurn;
  setGuessEnabled(canGuess);

  renderMoves('my-moves', state.myMoves || []);

  // dacă începe un joc nou (nu ai încă număr setat), curățăm casetele și valoarea locală
  if (!state.yourSecretSet) {
    mySecretValue = null;
    clearDigits('secret');
  }
  if (state.status !== 'active') {
    clearDigits('guess');
  }

  // comutăm între ecranul de alegere a numărului și ecranul de joc
  if (secretSection && gameSection) {
    if (state.status === 'active' || state.status === 'finished' || state.status === 'opponent_left') {
      secretSection.style.display = 'none';
      gameSection.style.display = 'block';
    } else {
      gameSection.style.display = 'none';
      secretSection.style.display = 'block';
    }
  }

  // ecranul de final se arată doar când status-ul este finished
  if (overSection) {
    if (state.status === 'finished') {
      overSection.style.display = 'block';
    } else {
      overSection.style.display = 'none';
    }
  }

  // status vizual pentru rematch
  if (rematchStatus) {
    if (state.status === 'finished') {
      if (state.yourRematch && !state.opponentRematch) {
        rematchStatus.textContent = 'Ai cerut rematch. Așteptăm răspunsul adversarului...';
      } else if (state.yourRematch && state.opponentRematch) {
        rematchStatus.textContent = 'Rematch acceptat! Alege un nou număr secret.';
      } else if (!state.yourRematch && state.opponentRematch) {
        rematchStatus.textContent = 'Adversarul vrea rematch. Apasă Rematch dacă vrei să continui.';
      } else {
        rematchStatus.textContent = '';
      }
    } else {
      rematchStatus.textContent = '';
    }
  }

  updateLastResult(state);

  // actualizăm și afișarea locală a numărului secret
  updateSecretDisplay(state);
}

function setGuessEnabled(enabled) {
  const guessBtn = document.getElementById('guess-btn');
  const keys = document.querySelectorAll('.keypad-key');
  guessActive = enabled;

  keys.forEach((key) => {
    key.disabled = !enabled;
  });

  if (!guessBtn) return;
  const current = getGuessValueFromBoxes();
  // butonul devine activ doar dacă este rândul tău și ai 4 cifre
  guessBtn.disabled = !enabled || current.length !== 4;
}

function renderMoves(listId, moves) {
  const el = document.getElementById(listId);
  if (!el) return;
  el.innerHTML = '';
  moves.forEach((move) => {
    const li = document.createElement('li');
    if (typeof move.turn === 'number') {
      const turnSpan = document.createElement('span');
      turnSpan.className = 'move-turn';
      turnSpan.textContent = `#${move.turn}`;
      li.appendChild(turnSpan);
    }
    const guessSpan = document.createElement('span');
    guessSpan.className = 'moves-guess digit-boxes';

    (move.guess || '').split('').forEach((d) => {
      const box = document.createElement('span');
      box.className = 'digit-box digit-box-small';
      box.textContent = d;
      guessSpan.appendChild(box);
    });

    const resultSpan = document.createElement('span');
    resultSpan.className = 'moves-result';
    // folosim emoticoane și colorăm numerele ca la ultimul rezultat
    resultSpan.innerHTML = `
      <span class="bulls-count">🐂 ${move.bulls}</span>
      &nbsp;&nbsp;
      <span class="cows-count">🐄 ${move.cows}</span>
    `;

    li.appendChild(guessSpan);
    li.appendChild(resultSpan);
    el.appendChild(li);
  });
}

function onSetSecret() {
  const value = collectDigits('secret');
  if (!value) return;
  mySecretValue = value;
  sendMessage({ type: 'set_secret', value });
}

function onGuess() {
  const value = collectDigits('guess');
  if (!value) return;
  sendMessage({ type: 'guess', value });
  clearDigits('guess');
}

function handleGameOver(message) {
  const statusEl = document.getElementById('status-text');
  const secretSection = document.getElementById('secret-section');
  const gameSection = document.getElementById('game-section');
  const overSection = document.getElementById('game-over-section');
  const overText = document.getElementById('game-over-text');
  const winnerNameEl = document.getElementById('winner-name');
  const oppReveal = document.getElementById('opponent-secret-reveal');
  const oppBoxes = document.getElementById('opponent-secret-boxes');

  let text = '';
  let winnerName = '';
  if (message.winner === 'you') {
    winnerName = currentPlayerName || 'Tu';
    text = `A câștigat ${winnerName}! Ai câștigat acest duel!`;

    // Înregistrăm victoria pentru Bulls & Cows, dacă există login real
    if (typeof recordWin === 'function') {
      recordWin('bulls');
    }
  } else {
    winnerName = (lastGameState && lastGameState.opponentName) || 'Adversarul';
    text = `A câștigat ${winnerName}. Adversarul a ghicit primul numărul tău secret.`;
  }

  if (statusEl) statusEl.textContent = 'Joc terminat.';

  if (secretSection) secretSection.style.display = 'none';
  if (gameSection) gameSection.style.display = 'none';
  if (overSection) overSection.style.display = 'block';
  if (overText) overText.textContent = text;
  if (winnerNameEl) winnerNameEl.textContent = winnerName;

  if (message.opponentSecret && oppReveal && oppBoxes) {
    oppReveal.style.display = 'block';
    oppBoxes.innerHTML = '';
    message.opponentSecret.split('').forEach((d) => {
      const span = document.createElement('span');
      span.className = 'digit-box';
      span.textContent = d;
      oppBoxes.appendChild(span);
    });
  }

  triggerConfetti();
  setGuessEnabled(false);
  setSecretEnabled(false);
}

function goBack() {
  window.location.href = '../2222.html';
}

// --------------------------------------------------
// init global
// --------------------------------------------------

window.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  // ne asigurăm că butonul de întoarcere funcționează pe orice pagină
  document.querySelectorAll('.back-button').forEach((el) => {
    el.addEventListener('click', goBack);
  });

  if (page === 'lobby') {
    initLobby();
  } else if (page === 'game') {
    initGame();
  }
});

// actualizează afișarea locală a numărului secret în 4 casete
function updateSecretDisplay(state) {
  const display = document.getElementById('secret-display');
  const boxes = document.getElementById('secret-boxes');
  if (!display || !boxes) return;

  if (!state.yourSecretSet || !mySecretValue || mySecretValue.length !== 4) {
    display.style.display = 'none';
    boxes.innerHTML = '';
    return;
  }

  display.style.display = 'block';
  boxes.innerHTML = '';
  mySecretValue.split('').forEach((d) => {
    const span = document.createElement('span');
    span.className = 'digit-box';
    span.textContent = d;
    boxes.appendChild(span);
  });
}

// setează enable/disable pe inputurile pentru numărul secret
function setSecretEnabled(enabled) {
  const inputs = document.querySelectorAll('.digit-input[data-group="secret"]');
  inputs.forEach((inp) => {
    inp.disabled = !enabled;
  });
  if (enabled && inputs[0]) inputs[0].focus();
}

// inițializează comportamentul UX pentru inputurile tip 4 casete
// inițializează keypad-ul pentru ghicit (0-9 și ștergere)
function setupGuessKeypad() {
  const keys = document.querySelectorAll('.keypad-key');
  if (!keys.length) return;

  keys.forEach((key) => {
    key.addEventListener('click', () => {
      const k = key.dataset.key;
      if (k === 'del') {
        deleteLastGuessDigit();
      } else {
        addGuessDigit(k);
      }
    });
  });
}

function getGuessBoxes() {
  return Array.from(document.querySelectorAll('.guess-box'));
}

function getGuessValueFromBoxes() {
  return getGuessBoxes()
    .map((b) => (b.textContent || '').trim())
    .join('');
}

function addGuessDigit(digit) {
  if (!guessActive) return;
  const boxes = getGuessBoxes();
  if (!boxes.length) return;

  const current = getGuessValueFromBoxes();
  if (current.includes(digit)) return; // toate cifrele trebuie să fie distincte

  for (let i = 0; i < boxes.length; i++) {
    if (!boxes[i].textContent) {
      boxes[i].textContent = digit;
      break;
    }
  }
  updateGuessButtonForBoxes();
}

function deleteLastGuessDigit() {
  const boxes = getGuessBoxes();
  for (let i = boxes.length - 1; i >= 0; i--) {
    if (boxes[i].textContent) {
      boxes[i].textContent = '';
      break;
    }
  }
  updateGuessButtonForBoxes();
}

function updateGuessButtonForBoxes() {
  const guessBtn = document.getElementById('guess-btn');
  if (!guessBtn) return;
  const value = getGuessValueFromBoxes();
  guessBtn.disabled = !guessActive || value.length !== 4;
}

function setupDigitInputs(group) {
  const inputs = Array.from(document.querySelectorAll(`.digit-input[data-group="${group}"]`));
  inputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
      let val = input.value.replace(/\D/g, '');
      if (val.length > 1) val = val.slice(-1);
      input.value = val;
      if (val && index < inputs.length - 1) {
        inputs[index + 1].focus();
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && index > 0) {
        inputs[index - 1].focus();
      }
    });
  });
}

// concatenează cele 4 cifre dintr-un grup; validează distinct și numeric
function collectDigits(group) {
  if (group === 'guess') {
    const value = getGuessValueFromBoxes();
    if (value.length !== 4 || !/^\d{4}$/.test(value)) {
      alert('Te rog introdu 4 cifre DISTINCTE folosind butoanele de jos.');
      return null;
    }
    const set = new Set(value.split(''));
    if (set.size !== 4) {
      alert('Toate cifrele trebuie să fie diferite.');
      return null;
    }
    return value;
  }

  const inputs = Array.from(document.querySelectorAll(`.digit-input[data-group="${group}"]`));
  const value = inputs.map((i) => i.value).join('');
  if (value.length !== 4 || !/^\d{4}$/.test(value)) {
    alert('Te rog introdu 4 cifre DISTINCTE.');
    return null;
  }
  const set = new Set(value.split(''));
  if (set.size !== 4) {
    alert('Toate cifrele trebuie să fie diferite.');
    return null;
  }
  return value;
}

function clearDigits(group) {
  if (group === 'guess') {
    const boxes = getGuessBoxes();
    boxes.forEach((b) => {
      b.textContent = '';
    });
    updateGuessButtonForBoxes();
    return;
  }

  const inputs = Array.from(document.querySelectorAll(`.digit-input[data-group="${group}"]`));
  inputs.forEach((i) => {
    i.value = '';
  });
  if (inputs[0]) inputs[0].focus();
}

// actualizează feedback-ul ultimei mutări proprii
function updateLastResult(state) {
  const box = document.getElementById('last-result');
  if (!box) return;
  const moves = state.myMoves || [];
  if (!moves.length) {
    box.textContent = 'Aici va apărea feedback-ul ultimei tale încercări.';
    return;
  }
  const last = moves[moves.length - 1];
  box.innerHTML = `<strong>${last.guess}</strong> → 
    <span class="bulls-count">🐂 ${last.bulls} Bulls</span> &nbsp; 
    <span class="cows-count">🐄 ${last.cows} Cows</span>`;
}

// pornește un mic efect de confetti în fereastra de felicitare
function triggerConfetti() {
  const container = document.getElementById('confetti-container');
  if (!container) return;
  container.innerHTML = '';

  const colors = ['#ff4d6d', '#ffd166', '#06d6a0', '#118ab2', '#ffffff'];
  const pieces = 80;

  for (let i = 0; i < pieces; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    const left = Math.random() * 100;
    const duration = 2 + Math.random() * 2;
    const delay = Math.random() * 1;
    const color = colors[Math.floor(Math.random() * colors.length)];

    piece.style.left = `${left}%`;
    piece.style.backgroundColor = color;
    piece.style.animationDuration = `${duration}s`;
    piece.style.animationDelay = `${delay}s`;

    container.appendChild(piece);
  }
}
