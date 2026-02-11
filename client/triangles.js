// client/triangles.js
// Logica de UI + WebSocket pentru jocul "Triunghiuri din puncte" 2-jucatori

let trianglesSocket = null;
let trianglesRoomCode = null;
let trianglesPlayerName = null;
let trianglesPendingCreateName = null;
let trianglesLastState = null;
let trianglesPendingClicks = [];

function trianglesWsUrl() {
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

function trianglesConnectWebSocket() {
  return new Promise((resolve, reject) => {
    if (trianglesSocket && trianglesSocket.readyState === WebSocket.OPEN) {
      return resolve(trianglesSocket);
    }

    const url = trianglesWsUrl();
    trianglesSocket = new WebSocket(url);

    trianglesSocket.onopen = () => resolve(trianglesSocket);

    trianglesSocket.onerror = (err) => {
      console.error('WS error (triangles)', err);
      const statusEl =
        document.getElementById('triangles-status-text') || document.getElementById('triangles-lobby-status');
      if (statusEl) statusEl.textContent = 'Nu m-am putut conecta la server. Ruleaza `node server/server.js`.';
      reject(err);
    };

    trianglesSocket.onclose = () => {
      const statusEl =
        document.getElementById('triangles-status-text') || document.getElementById('triangles-lobby-status');
      if (statusEl) statusEl.textContent = 'Conexiune inchisa de server.';
    };

    trianglesSocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleTrianglesServerMessage(message);
      } catch (e) {
        console.error('Mesaj JSON invalid de la server (triangles)', e);
      }
    };
  });
}

function trianglesSend(msg) {
  if (!trianglesSocket || trianglesSocket.readyState !== WebSocket.OPEN) {
    const statusEl =
      document.getElementById('triangles-status-text') || document.getElementById('triangles-lobby-status');
    if (statusEl) statusEl.textContent = 'Nu esti conectat la server.';
    return;
  }
  trianglesSocket.send(JSON.stringify(msg));
}

function handleTrianglesServerMessage(message) {
  const page = document.body.dataset.page;

  if (message.type === 'triangles_room_created') {
    if (page === 'triangles-lobby' && trianglesPendingCreateName) {
      const roomCode = message.roomCode;
      window.location.href = `triangles-game.html?room=${roomCode}&player=${encodeURIComponent(
        trianglesPendingCreateName
      )}`;
    }
    return;
  }

  if (page === 'triangles-game') {
    switch (message.type) {
      case 'triangles_state':
        applyTrianglesState(message.state);
        break;
      case 'triangles_error':
        alert(message.message);
        const statusEl = document.getElementById('triangles-status-text');
        if (statusEl) statusEl.textContent = message.message || '';
        break;
      case 'triangles_game_over':
        handleTrianglesGameOver(message);
        break;
      default:
        break;
    }
  } else if (page === 'triangles-lobby') {
    if (message.type === 'triangles_error') {
      alert(message.message);
      const lobbyStatus = document.getElementById('triangles-lobby-status');
      if (lobbyStatus) lobbyStatus.textContent = message.message || '';
    }
  }
}

// --------------------------------------------------
// LOBBY
// --------------------------------------------------

function initTrianglesLobby() {
  const nameInput = document.getElementById('triangles-player-name');
  const createBtn = document.getElementById('triangles-create-room');
  const joinBtn = document.getElementById('triangles-join-room');
  const roomInput = document.getElementById('triangles-room-code');

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

    trianglesPendingCreateName = name;
    try {
      await trianglesConnectWebSocket();
      trianglesSend({ type: 'triangles_create_room' });
      const lobbyStatus = document.getElementById('triangles-lobby-status');
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

    window.location.href = `triangles-game.html?room=${code}&player=${encodeURIComponent(name)}`;
  });
}

// --------------------------------------------------
// GAME
// --------------------------------------------------

function initTrianglesGame() {
  const params = new URLSearchParams(window.location.search);
  trianglesRoomCode = (params.get('room') || '').toUpperCase();
  trianglesPlayerName = params.get('player') || 'Anonim';

  const roomDisplay = document.getElementById('triangles-room-code-display');
  const youNameEl = document.getElementById('triangles-you-name');
  if (roomDisplay) roomDisplay.textContent = trianglesRoomCode || '-';
  if (youNameEl) youNameEl.textContent = trianglesPlayerName;

  const backTop = document.getElementById('triangles-back-top');
  if (backTop) {
    backTop.addEventListener('click', () => {
      window.location.href = '../2222.html';
    });
  }

  const playAgainOverlay = document.getElementById('triangles-play-again-overlay');
  if (playAgainOverlay) {
    playAgainOverlay.addEventListener('click', () => {
      trianglesSend({ type: 'triangles_play_again' });
    });
  }

  const homeOverlay = document.getElementById('triangles-home-overlay');
  if (homeOverlay) {
    homeOverlay.addEventListener('click', () => {
      window.location.href = '../2222.html';
    });
  }

  const endGameButton = document.getElementById('triangles-end-game-button');
  if (endGameButton) {
    endGameButton.addEventListener('click', () => {
      if (!trianglesLastState || trianglesLastState.status !== 'active') return;
      const confirmEnd = window.confirm('Sigur vrei sa termini jocul acum?');
      if (!confirmEnd) return;
      trianglesSend({ type: 'triangles_force_end', roomCode: trianglesRoomCode });
    });
  }

  setupTrianglesCanvas();

  trianglesConnectWebSocket()
    .then(() => {
      trianglesSend({
        type: 'triangles_join_room',
        roomCode: trianglesRoomCode,
        playerName: trianglesPlayerName,
      });
    })
    .catch(() => {});
}

function setupTrianglesCanvas() {
  const canvas = document.getElementById('triangles-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  function resizeCanvas() {
    const wrapper = canvas.parentElement;
    if (!wrapper) return;
    const size = Math.min(wrapper.clientWidth || 320, 360);
    canvas.width = size;
    canvas.height = size;
    drawTrianglesBoard(trianglesLastState, ctx, canvas);
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  canvas.addEventListener('click', (e) => {
    if (!trianglesLastState) return;
    if (!(trianglesLastState.status === 'active' && trianglesLastState.yourTurn)) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) * canvas.width) / rect.width;
    const y = ((e.clientY - rect.top) * canvas.height) / rect.height;

    const idx = findNearestTrianglePoint(trianglesLastState, canvas, x, y, 16);
    if (idx === null) return;

    // daca punctul este deja selectat, il deselectam (toggle)
    if (trianglesPendingClicks.includes(idx)) {
      trianglesPendingClicks = trianglesPendingClicks.filter((i) => i !== idx);
      drawTrianglesBoard(trianglesLastState, ctx, canvas);
      return;
    }

    trianglesPendingClicks.push(idx);
    if (trianglesPendingClicks.length > 2) {
      trianglesPendingClicks = [idx];
    }

    // daca avem un cuplu de puncte selectat, trimitem imediat linia la server
    if (trianglesPendingClicks.length === 2) {
      const [a, b] = trianglesPendingClicks;
      trianglesSend({
        type: 'triangles_play',
        roomCode: trianglesRoomCode,
        lines: [{ a, b }],
      });
      trianglesPendingClicks = [];
    } else {
      // redesenam doar cu punctul selectat evidentiat
      drawTrianglesBoard(trianglesLastState, ctx, canvas);
    }
  });
}

function findNearestTrianglePoint(state, canvas, x, y, radius) {
  if (!state || !state.points || !state.points.length) return null;
  const r2 = radius * radius;
  let bestIndex = null;
  let bestDist = Infinity;

  state.points.forEach((p, index) => {
    const px = p.x * canvas.width;
    const py = p.y * canvas.height;
    const dx = px - x;
    const dy = py - y;
    const d2 = dx * dx + dy * dy;
    if (d2 <= r2 && d2 < bestDist) {
      bestDist = d2;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function drawTrianglesBoard(state, ctxParam, canvasParam) {
  const canvas = canvasParam || document.getElementById('triangles-canvas');
  if (!canvas) return;
  const ctx = ctxParam || canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!state || !state.points) return;

  const w = canvas.width;
  const h = canvas.height;

  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fillRect(0, 0, w, h);

  // triunghiuri (fundal colorat)
  if (state.triangles && state.triangles.length) {
    state.triangles.forEach((t) => {
      const indices = [t.a, t.b, t.c];
      const pts = indices.map((i) => state.points[i]);
      if (pts.some((p) => !p)) return;
      let ownerName = (t.ownerName || '').toLowerCase().trim();
      let color;
      if (ownerName === 'georgiana') {
        // mov deschis
        color = 'rgba(204, 153, 255, 0.55)';
      } else if (ownerName === 'andrei') {
        // turcoaz
        color = 'rgba(64, 224, 208, 0.55)';
      } else {
        // fallback in functie de "you" / "opponent"
        color = t.owner === 'you' ? 'rgba(255, 193, 7, 0.35)' : 'rgba(52, 152, 219, 0.35)';
      }

      ctx.beginPath();
      ctx.moveTo(pts[0].x * w, pts[0].y * h);
      ctx.lineTo(pts[1].x * w, pts[1].y * h);
      ctx.lineTo(pts[2].x * w, pts[2].y * h);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    });
  }

  // linii
  if (state.lines && state.lines.length) {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    state.lines.forEach((l) => {
      const p1 = state.points[l.a];
      const p2 = state.points[l.b];
      if (!p1 || !p2) return;
      ctx.beginPath();
      ctx.moveTo(p1.x * w, p1.y * h);
      ctx.lineTo(p2.x * w, p2.y * h);
      ctx.stroke();
    });
  }

  // puncte
  state.points.forEach((p, index) => {
    const x = p.x * w;
    const y = p.y * h;

    const selected = trianglesPendingClicks.includes(index);

    ctx.beginPath();
    ctx.arc(x, y, selected ? 7 : 5, 0, Math.PI * 2);
    ctx.fillStyle = selected ? '#ffb703' : '#ffffff';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, selected ? 9 : 7, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  ctx.restore();
}

function applyTrianglesState(state) {
  if (!state) return;

  trianglesLastState = state;

  const statusEl = document.getElementById('triangles-status-text');
  const turnIndicator = document.getElementById('triangles-turn-indicator');
  const oppNameEl = document.getElementById('triangles-opponent-name');
  const youNameEl = document.getElementById('triangles-you-name');
  const yourScoreEl = document.getElementById('triangles-your-score');
  const oppScoreEl = document.getElementById('triangles-opponent-score');
  const remainingMovesEl = document.getElementById('triangles-remaining-moves');
  const overSection = document.getElementById('triangles-over-section');
  const overRoom = document.getElementById('triangles-over-room');
  const endGameButton = document.getElementById('triangles-end-game-button');

  if (oppNameEl) oppNameEl.textContent = state.opponentName || 'Asteptam adversarul';
  if (youNameEl && state.youName) youNameEl.textContent = state.youName;

  if (statusEl) {
    if (state.status === 'waiting') statusEl.textContent = 'Așteptăm să intre și adversarul în cameră.';
    else if (state.status === 'active') statusEl.textContent = '';
    else if (state.status === 'finished') statusEl.textContent = 'Joc terminat.';
  }

  if (turnIndicator) {
    if (state.status !== 'active') {
      turnIndicator.textContent = 'Așteptăm să intre și adversarul.';
    } else if (state.yourTurn) {
      turnIndicator.textContent =
        'Este randul tau.';
    } else {
      turnIndicator.textContent = 'Este randul adversarului.';
    }
  }

  if (yourScoreEl) yourScoreEl.textContent = String(state.yourScore || 0);
  if (oppScoreEl) oppScoreEl.textContent = String(state.opponentScore || 0);

  if (remainingMovesEl && typeof state.remainingMoves === 'number') {
    remainingMovesEl.textContent = String(state.remainingMoves);
  }

  if (overSection && state.status !== 'finished') {
    overSection.style.display = 'none';
  }

  if (endGameButton) {
    endGameButton.disabled = state.status !== 'active';
  }

  if (overRoom && trianglesRoomCode) {
    overRoom.textContent = `Camera: ${trianglesRoomCode}`;
  }

  const canvas = document.getElementById('triangles-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    drawTrianglesBoard(state, ctx, canvas);
  }
}

function handleTrianglesGameOver(msg) {
  if (!msg) return;

  if (typeof recordWin === 'function') {
    if (msg.winner === 'you') {
      recordWin('triangles');
    }
  }

  const statusEl = document.getElementById('triangles-status-text');
  const overSection = document.getElementById('triangles-over-section');
  const overText = document.getElementById('triangles-over-text');
  const overRoom = document.getElementById('triangles-over-room');

  if (statusEl) {
    if (msg.winner === 'you') statusEl.textContent = `${trianglesPlayerName} a castigat jocul!`;
    else if (msg.winner === 'opponent') statusEl.textContent = `${msg.opponentName || 'Adversarul'} a castigat jocul. ${trianglesPlayerName}, ai pierdut.`;
    else statusEl.textContent = 'Joc terminat. Este remiza.';
  }

  if (overSection && overText) {
    overSection.style.display = 'block';
    if (msg.winner === 'you') overText.textContent = `${trianglesPlayerName} a castigat jocul!`;
    else if (msg.winner === 'opponent')
      overText.textContent = `${msg.opponentName || 'Adversarul'} a castigat jocul. ${trianglesPlayerName}, ai pierdut.`;
    else overText.textContent = 'Remiza! Ati format acelasi numar de triunghiuri.';
    if (overRoom && trianglesRoomCode) {
      overRoom.textContent = `Camera: ${trianglesRoomCode}`;
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if (page === 'triangles-lobby') {
    initTrianglesLobby();
  } else if (page === 'triangles-game') {
    initTrianglesGame();
  }
});
