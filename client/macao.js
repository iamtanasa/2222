// client/macao.js
// Logica de UI + WebSocket pentru jocul Macao 2-jucatori

let macaoSocket = null;
let macaoRoomCode = null;
let macaoPlayerName = null;
let macaoPendingCreateName = null;
let macaoLastState = null; // ultimul state primit, folosit pentru tap pe pachet
let _macaoReconnectTimer = null;
let _macaoReconnectDelay = 1000;
let _macaoPingInterval = null;

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

function _macaoStartPing() {
  _macaoStopPing();
  _macaoPingInterval = setInterval(() => {
    if (macaoSocket && macaoSocket.readyState === WebSocket.OPEN) {
      macaoSocket.send(JSON.stringify({ type: 'ping' }));
    }
  }, 20000);
}
function _macaoStopPing() {
  if (_macaoPingInterval) { clearInterval(_macaoPingInterval); _macaoPingInterval = null; }
}
function _macaoScheduleReconnect() {
  if (_macaoReconnectTimer) return;
  _macaoReconnectTimer = setTimeout(() => {
    _macaoReconnectTimer = null;
    macaoConnectWebSocket().catch(() => {});
  }, _macaoReconnectDelay);
  _macaoReconnectDelay = Math.min(_macaoReconnectDelay * 2, 15000);
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && (!macaoSocket || macaoSocket.readyState !== WebSocket.OPEN)) {
    _macaoReconnectDelay = 1000;
    macaoConnectWebSocket().catch(() => {});
  }
});

function macaoConnectWebSocket() {
  return new Promise((resolve, reject) => {
    if (macaoSocket && macaoSocket.readyState === WebSocket.OPEN) {
      return resolve(macaoSocket);
    }

    const url = macaoWsUrl();
    macaoSocket = new WebSocket(url);

    macaoSocket.onopen = () => {
      _macaoReconnectDelay = 1000;
      _macaoStartPing();
      if (macaoRoomCode && macaoPlayerName) {
        macaoSend({ type: 'macao_join_room', roomCode: macaoRoomCode, playerName: macaoPlayerName });
      }
      resolve(macaoSocket);
    };

    macaoSocket.onerror = (err) => {
      console.error('WS error', err);
      const statusEl =
        document.getElementById('macao-status-text') || document.getElementById('macao-lobby-status');
      if (statusEl) statusEl.textContent = 'Se reconectează la server...';
      reject(err);
    };

    macaoSocket.onclose = () => {
      _macaoStopPing();
      const statusEl =
        document.getElementById('macao-status-text') || document.getElementById('macao-lobby-status');
      if (statusEl) statusEl.textContent = 'Conexiune pierdută. Se reconectează...';
      _macaoScheduleReconnect();
    };

    macaoSocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'pong') return;
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
      // Tap animation
      drawPile.classList.add('macao-draw-tap');
      setTimeout(() => drawPile.classList.remove('macao-draw-tap'), 250);
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

  document.querySelectorAll('.macao-suit-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const suit = btn.dataset.suit;
      if (suit) macaoSend({ type: 'macao_choose_suit', suit });
    });
  });

  const pairsBtn = document.getElementById('macao-pairs-btn');
  if (pairsBtn) {
    pairsBtn.addEventListener('click', () => {
      macaoPairMode = true;
      macaoSelectedForPairs = [];
      macaoUpdatePairSelectionUI();
      const wrap = document.getElementById('macao-pair-confirm-wrap');
      if (wrap) wrap.style.display = 'flex';
      if (pairsBtn) pairsBtn.style.display = 'none';
    });
  }

  const pairConfirm = document.getElementById('macao-pair-confirm');
  const pairCancel = document.getElementById('macao-pair-cancel');
  if (pairConfirm) {
    pairConfirm.addEventListener('click', () => {
      const state = macaoLastState;
      if (!state || macaoSelectedForPairs.length < 2) {
        alert('Selectează cel puțin 2 cărți de același fel.');
        return;
      }
      const hand = state.yourHand || [];
      const cards = macaoSelectedForPairs.map((id) => hand.find((c) => c.id === id)).filter(Boolean);
      if (cards.length !== macaoSelectedForPairs.length) return;
      // Verificam grupuri consecutive de acelasi rang
      let gi = 0;
      while (gi < cards.length) {
        const groupRank = cards[gi].rank;
        let ge = gi + 1;
        while (ge < cards.length && cards[ge].rank === groupRank) ge++;
        if (ge - gi < 2) {
          alert('Fiecare grup trebuie să aibă cel puțin 2 cărți de același fel.');
          return;
        }
        gi = ge;
      }
      const top = state.topDiscard;
      if (!macaoClientCanPlayOnTop(cards[0], top, state.attackActive, state.demandedSuit)) {
        alert('Prima carte din selecție trebuie să se potrivească cu talonul.');
        return;
      }
      macaoSend({ type: 'macao_play_pairs', cardIds: macaoSelectedForPairs });
      macaoPairMode = false;
      macaoSelectedForPairs = [];
      const wrap = document.getElementById('macao-pair-confirm-wrap');
      if (wrap) wrap.style.display = 'none';
    });
  }
  if (pairCancel) {
    pairCancel.addEventListener('click', () => {
      macaoPairMode = false;
      macaoSelectedForPairs = [];
      const wrap = document.getElementById('macao-pair-confirm-wrap');
      if (wrap) wrap.style.display = 'none';
      macaoUpdatePairSelectionUI();
      const pairBtnEl = document.getElementById('macao-pairs-btn');
      if (pairBtnEl && macaoLastState && macaoHasPairsAndPlayable(macaoLastState)) {
        pairBtnEl.style.display = 'inline-block';
      }
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

// Track previous state for animation diffing
let macaoPrevHandIds = [];
let macaoPrevOppCount = 0;
let macaoPrevTopDiscardId = null;

let macaoPairMode = false;
let macaoSelectedForPairs = [];

function macaoClientCanPlayOnTop(card, topCard, attackActive, demandedSuit) {
  if (!topCard) return true;
  const effectiveSuit = (topCard.rank === '7' && demandedSuit) ? demandedSuit : topCard.suit;
  if (card.rank === 'A' || card.rank === '7' || card.rank === 'JOKER_BLACK' || card.rank === 'JOKER_RED') return true;
  if (attackActive) {
    return ['2', '3', '4', 'JOKER_BLACK', 'JOKER_RED'].includes(card.rank);
  }
  if (card.suit === effectiveSuit || card.rank === topCard.rank) return true;
  return false;
}

function macaoHasPairsAndPlayable(state) {
  const hand = state.yourHand || [];
  if (hand.length < 2 || !state.yourTurn || state.status !== 'active' || state.pendingSuitChoice) return false;
  const byRank = {};
  hand.forEach((c) => {
    const r = c.rank;
    if (!byRank[r]) byRank[r] = [];
    byRank[r].push(c);
  });
  const hasPair = Object.values(byRank).some((arr) => arr.length >= 2);
  if (!hasPair) return false;
  const top = state.topDiscard;
  return hand.some((c) => macaoClientCanPlayOnTop(c, top, state.attackActive, state.demandedSuit));
}

function macaoOnCardClick(card) {
  const state = macaoLastState;
  if (!state || state.status !== 'active') return;

  if (macaoPairMode) {
    const idx = macaoSelectedForPairs.indexOf(card.id);
    if (idx === -1) macaoSelectedForPairs.push(card.id);
    else macaoSelectedForPairs.splice(idx, 1);
    macaoUpdatePairSelectionUI();
    return;
  }

  if (state.pendingSuitChoice) return;
  if (!state.yourTurn) return;
  macaoSend({ type: 'macao_play', cardId: card.id });
}

function macaoUpdatePairSelectionUI() {
  const playerHandEl = document.getElementById('macao-player-hand');
  if (!playerHandEl) return;
  const cards = playerHandEl.querySelectorAll('.macao-card-face[data-card-id]');
  const len = macaoSelectedForPairs.length;
  cards.forEach((el) => {
    const id = el.dataset.cardId;
    const idx = macaoSelectedForPairs.indexOf(id);
    el.classList.remove('macao-card-selected', 'macao-card-sel-yellow', 'macao-card-sel-red');
    if (idx !== -1) {
      el.classList.add('macao-card-selected');
      if (len === 1) {
        el.classList.add('macao-card-sel-yellow');
      } else if (idx === len - 1) {
        el.classList.add('macao-card-sel-red');
      } else {
        el.classList.add('macao-card-sel-yellow');
      }
    }
  });
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
      turnIndicator.classList.remove('macao-your-turn');
    } else if (state.yourTurn) {
      turnIndicator.textContent = 'Este randul tau.';
      turnIndicator.classList.add('macao-your-turn');
    } else {
      turnIndicator.textContent = 'Este randul adversarului.';
      turnIndicator.classList.remove('macao-your-turn');
    }
  }

  if (attackInfo) {
    let infoText = '';
    if (state.attackActive && state.pendingDraw > 0) {
      infoText = `Atac activ: trebuie trase ${state.pendingDraw} carti.`;
    }
    if (state.turnsToSkip && state.turnsToSkip > 0) {
      const t = state.turnsToSkip;
      const turnsLabel = t === 1 ? 'tura' : 'ture';
      const skipText = `Mai trebuie sa stai ${t} ${turnsLabel}.`;
      infoText = infoText ? `${infoText} ${skipText}` : skipText;
    }
    attackInfo.textContent = infoText;
  }

  // ascundem fereastra de game over cand jocul nu este terminat
  if (overSection && state.status !== 'finished') {
    overSection.style.display = 'none';
  }

  if (oppHandEl) {
    const count = state.opponentCardCount || 0;
    const prevCount = macaoPrevOppCount;
    oppHandEl.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const div = document.createElement('div');
      div.className = 'macao-card macao-card-back';
      // Animate only new cards (extras)
      if (i >= prevCount) {
        div.classList.add('macao-opp-appear');
        div.style.animationDelay = `${(i - prevCount) * 0.06}s`;
      }
      div.innerHTML = renderMacaoCardBack();
      oppHandEl.appendChild(div);
    }
    macaoPrevOppCount = count;
  }

  if (playerHandEl) {
    const hand = state.yourHand || [];
    const currentIds = hand.map(c => c.id);
    const handUnchanged =
      currentIds.length === macaoPrevHandIds.length &&
      currentIds.every((id, i) => id === macaoPrevHandIds[i]);

    if (!handUnchanged) {
      const newIds = currentIds.filter(id => !macaoPrevHandIds.includes(id));
      playerHandEl.innerHTML = '';
      hand.forEach((card, idx) => {
        const div = document.createElement('div');
        div.className = 'macao-card macao-card-face';
        if (newIds.includes(card.id)) {
          div.classList.add('macao-card-appear');
          const newIdx = newIds.indexOf(card.id);
          div.style.animationDelay = `${newIdx * 0.08}s`;
        }
        div.innerHTML = renderMacaoCardFace(card);
        div.dataset.cardId = card.id;
        div.addEventListener('click', () => macaoOnCardClick(card));
        playerHandEl.appendChild(div);
      });
      macaoPrevHandIds = currentIds;
    }
  }

  if (drawCountEl) {
    drawCountEl.textContent = String(state.drawPileCount || 0);
  }

  if (topDiscardEl) {
    const newDiscardId = state.topDiscard ? state.topDiscard.id : null;
    if (newDiscardId !== macaoPrevTopDiscardId) {
      topDiscardEl.innerHTML = '';
      if (state.topDiscard) {
        const wrapper = document.createElement('div');
        wrapper.className = 'macao-discard-reveal';
        wrapper.innerHTML = renderMacaoCardFace(state.topDiscard);
        topDiscardEl.appendChild(wrapper);
      }
      macaoPrevTopDiscardId = newDiscardId;
    }
  }

  // Afiseaza culoarea ceruta dupa un 7
  const demandedEl = document.getElementById('macao-demanded-suit');
  if (demandedEl) {
    if (state.demandedSuit && state.topDiscard && state.topDiscard.rank === '7') {
      const suitSymbols = { heart: '\u2665', diamond: '\u2666', club: '\u2663', spade: '\u2660' };
      const suitNames = { heart: 'Inim\u0103', diamond: 'Romb', club: 'Trefl\u0103', spade: 'Pic\u0103' };
      const isRed = state.demandedSuit === 'heart' || state.demandedSuit === 'diamond';
      demandedEl.innerHTML = `<span class="demanded-symbol ${isRed ? 'demanded-red' : 'demanded-black'}">${suitSymbols[state.demandedSuit]}</span>`;
      demandedEl.title = suitNames[state.demandedSuit] || '';
      demandedEl.style.display = 'flex';
    } else {
      demandedEl.style.display = 'none';
    }
  }

  if (drawBtn) {
    drawBtn.disabled = !(state.status === 'active' && state.yourTurn);
  }

  if (!state.yourTurn || state.status !== 'active' || state.pendingSuitChoice) {
    macaoPairMode = false;
    macaoSelectedForPairs = [];
  }

  const suitPickerEl = document.getElementById('macao-suit-picker');
  if (suitPickerEl) {
    suitPickerEl.style.display = state.pendingSuitChoice ? 'flex' : 'none';
  }

  const pairBtnEl = document.getElementById('macao-pairs-btn');
  const pairConfirmWrap = document.getElementById('macao-pair-confirm-wrap');
  if (pairBtnEl) {
    const showPairBtn = state.yourTurn && state.status === 'active' && !state.pendingSuitChoice && macaoHasPairsAndPlayable(state);
    pairBtnEl.style.display = showPairBtn && !macaoPairMode ? 'inline-block' : 'none';
  }
  if (pairConfirmWrap) {
    pairConfirmWrap.style.display = macaoPairMode ? 'flex' : 'none';
  }

  if (macaoPairMode) {
    macaoUpdatePairSelectionUI();
  } else {
    const cards = document.getElementById('macao-player-hand');
    if (cards) cards.querySelectorAll('.macao-card-selected').forEach((el) => el.classList.remove('macao-card-selected'));
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
