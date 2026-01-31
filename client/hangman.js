'use strict';

// Client JS pentru Spanzuratoarea 2-jucatori

let hangmanSocket = null;
let hangmanRoomCode = null;
let hangmanPlayerName = null;
let hangmanRole = null; // 'setter' sau 'guesser'
let hangmanLastState = null;

// Helper: detalii utilizator logat (refolosim dacă există getLoggedInUser)
function hgGetLoggedInUser() {
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

function hgFormatPlayerName(name) {
  if (!name) return '';
  const lower = name.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function hangmanWsUrl() {
  const host = window.location.hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1';

  // În producție folosim același server WebSocket de pe Render
  if (!isLocal) {
    return 'wss://two222-h9x4.onrender.com';
  }

  // Local: ne conectăm la serverul pornit manual pe 8080
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const localHost = host || 'localhost';
  const port = 8080;
  return `${protocol}://${localHost}:${port}`;
}

function hangmanConnect() {
  return new Promise((resolve, reject) => {
    if (hangmanSocket && hangmanSocket.readyState === WebSocket.OPEN) {
      return resolve(hangmanSocket);
    }

    const url = hangmanWsUrl();
    hangmanSocket = new WebSocket(url);

    hangmanSocket.onopen = () => resolve(hangmanSocket);

    hangmanSocket.onerror = (err) => {
      console.error('WS error (hangman)', err);
      const statusEl =
        document.getElementById('hangman-status-text') ||
        document.getElementById('hangman-lobby-status');
      if (statusEl)
        statusEl.textContent = 'Nu m-am putut conecta la server. Ruleaza `node server/server.js`.';
      reject(err);
    };

    hangmanSocket.onclose = () => {
      const statusEl =
        document.getElementById('hangman-status-text') ||
        document.getElementById('hangman-lobby-status');
      if (statusEl) statusEl.textContent = 'Conexiune inchisa de server.';
    };

    hangmanSocket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleHangmanMessage(msg);
      } catch (e) {
        console.error('Mesaj JSON invalid (hangman)', e);
      }
    };
  });
}

function hangmanSend(msg) {
  if (!hangmanSocket || hangmanSocket.readyState !== WebSocket.OPEN) {
    const statusEl =
      document.getElementById('hangman-status-text') ||
      document.getElementById('hangman-lobby-status');
    if (statusEl) statusEl.textContent = 'Nu esti conectat la server.';
    return;
  }
  hangmanSocket.send(JSON.stringify(msg));
}

function handleHangmanMessage(msg) {
  const page = document.body.dataset.page;

  if (msg.type === 'hangman_room_created') {
    if (page === 'hangman-lobby') {
      const roomCode = msg.roomCode;
      window.location.href = `hangman-game.html?room=${roomCode}&player=${encodeURIComponent(
        hangmanPlayerName || 'Anonim'
      )}`;
    }
    return;
  }

  if (page === 'hangman-lobby') {
    if (msg.type === 'hangman_error') {
      const el = document.getElementById('hangman-lobby-status');
      if (el) el.textContent = msg.message;
      alert(msg.message);
    }
    return;
  }

  if (page === 'hangman-game') {
    switch (msg.type) {
      case 'hangman_state':
        applyHangmanState(msg.state);
        break;
      case 'hangman_error':
        alert(msg.message);
        const st = document.getElementById('hangman-status-text');
        if (st) st.textContent = msg.message;
        break;
      case 'hangman_game_over':
        handleHangmanGameOver(msg);
        break;
      default:
        console.warn('Mesaj hangman necunoscut:', msg.type);
    }
  }
}

// LOBBY

function initHangmanLobby() {
  const nameInput = document.getElementById('hangman-player-name');
  const createBtn = document.getElementById('hangman-create-room');
  const joinBtn = document.getElementById('hangman-join-room');
  const roomInput = document.getElementById('hangman-room-code');

  // Completăm automat numele dacă utilizatorul este logat
  const user = hgGetLoggedInUser();
  if (user && nameInput) {
    nameInput.value = hgFormatPlayerName(user.name);
  }

  createBtn.addEventListener('click', async () => {
    const name = (nameInput.value || '').trim();
    if (!name) {
      alert('Te rog sa introduci un nume.');
      return;
    }
    hangmanPlayerName = name;
    try {
      await hangmanConnect();
      hangmanSend({ type: 'hangman_create_room' });
      const st = document.getElementById('hangman-lobby-status');
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
    window.location.href = `hangman-game.html?room=${code}&player=${encodeURIComponent(name)}`;
  });
}

// GAME

function initHangmanGame() {
  const params = new URLSearchParams(window.location.search);
  hangmanRoomCode = (params.get('room') || '').toUpperCase();
  hangmanPlayerName = params.get('player') || 'Anonim';

  document.getElementById('hangman-room-code-display').textContent = hangmanRoomCode || '-';
  document.getElementById('hangman-you-name').textContent = hangmanPlayerName;

  hangmanConnect()
    .then(() => {
      hangmanSend({
        type: 'hangman_join_room',
        roomCode: hangmanRoomCode,
        playerName: hangmanPlayerName,
      });
    })
    .catch(() => {});

  const setWordBtn = document.getElementById('hangman-set-word');
  const playAgainBtn = document.getElementById('hangman-play-again');
  const homeBtn = document.getElementById('hangman-home');

  if (setWordBtn) {
    setWordBtn.addEventListener('click', onHangmanSetWord);
  }
  if (playAgainBtn) {
    playAgainBtn.addEventListener('click', () => {
      if (!hangmanRoomCode) return;
      hangmanSend({ type: 'hangman_play_again' });
    });
  }
  if (homeBtn) {
    homeBtn.addEventListener('click', () => {
      window.location.href = '../2222.html';
    });
  }
}

function applyHangmanState(state) {
  if (!state) return;
  hangmanLastState = state;
  hangmanRole = state.role;

  const statusEl = document.getElementById('hangman-status-text');
  const roleInfo = document.getElementById('hangman-role-info');
  const opponentEl = document.getElementById('hangman-opponent-name');
  const wordSection = document.getElementById('hangman-word-section');
  const gameSection = document.getElementById('hangman-game-section');
  const overSection = document.getElementById('hangman-over-section');
  const turnInfo = document.getElementById('hangman-turn-info');
  const figure = document.getElementById('hangman-figure');
  const letterGrid = document.getElementById('hangman-letter-grid');
  const letterHelper = document.querySelector('#hangman-game-section .helper-text');
  const headImg = document.querySelector('.hangman-head-img');
  const rescueWalker = document.getElementById('hangman-rescue-walker');

  if (opponentEl) opponentEl.textContent = state.opponentName || 'Asteptam adversarul';

  let statusText = '';
  let turnText = '';

  switch (state.status) {
    case 'waiting':
      statusText = 'Asteptam sa intre si adversarul in camera.';
      turnText = 'Spune-i partenerului codul camerei.';
      break;
    case 'waiting_word':
      statusText = 'Alege cuvantul secret.';
      turnText =
        hangmanRole === 'setter'
          ? 'Scrie si confirma cuvantul tau secret.'
          : 'Asteptam ca adversarul sa aleaga cuvantul.';
      break;
    case 'active':
      statusText = 'Joc in desfasurare.';
      if (hangmanRole === 'guesser') {
        turnText = 'Este randul tau: apasa pe litere pentru a ghici.';
      } else {
        turnText = 'Adversarul ghiceste cuvantul tau. Urmareste spanzuratoarea.';
      }
      break;
    case 'finished':
      statusText = 'Joc terminat.';
      break;
    case 'opponent_left':
      statusText = 'Adversarul a parasit jocul.';
      break;
    default:
      statusText = 'Stare necunoscuta.';
  }

  if (statusEl) statusEl.textContent = statusText;
  if (turnInfo) turnInfo.textContent = turnText;

  if (roleInfo) {
    if (state.role === 'setter') {
      roleInfo.textContent =
        'Tu esti "gazda" acestei camere: alegi cuvantul, iar adversarul il ghiceste.';
    } else if (state.role === 'guesser') {
      roleInfo.textContent =
        'Tu esti jucatorul care ghiceste cuvantul. Incearca sa nu ajungi in spanzuratoare!';
    } else {
      roleInfo.textContent = '';
    }
  }

  // daca nu suntem intr-o stare de final, resetam animatia de "salvare"
  if (figure && state.status !== 'finished' && state.status !== 'opponent_left') {
    const rope = figure.querySelector('.gallow-rope');
    const manGroup = figure.querySelector('.man-group');
    if (rope) rope.classList.remove('rope-hidden');
    if (manGroup) manGroup.classList.remove('man-hidden');
    if (rescueWalker) {
      rescueWalker.classList.remove('rescue-walk-in', 'rescue-walk-away');
      // revenim la pozitia de start in stanga
      rescueWalker.style.display = '';
    }
  }

  // alegem ce imagine de cap sa afisam, in functie de headVariant trimis de server
  if (headImg) {
    const variant = typeof state.headVariant === 'number' ? state.headVariant : 0;
    const desiredSrc = variant === 1 ? 'hangman-head2.png' : 'hangman-head.png';
    if (headImg.getAttribute('src') !== desiredSrc) {
      headImg.setAttribute('src', desiredSrc);
    }
  }

  if (wordSection && gameSection && overSection) {
    if (state.status === 'waiting' || state.status === 'waiting_word') {
      wordSection.style.display = 'block';
      gameSection.style.display = 'none';
      overSection.style.display = 'none';
    } else if (state.status === 'active') {
      wordSection.style.display = hangmanRole === 'setter' && !state.secretWordSet ? 'block' : 'none';
      gameSection.style.display = 'block';
      overSection.style.display = 'none';
    } else if (state.status === 'finished') {
      wordSection.style.display = 'none';
      gameSection.style.display = 'block';
      overSection.style.display = 'block';
    } else if (state.status === 'opponent_left') {
      wordSection.style.display = 'none';
      gameSection.style.display = 'none';
      overSection.style.display = 'block';
    }
  }

  // tastatura A-Z trebuie sa apara doar la jucatorul care ghiceste
  if (letterGrid) {
    const shouldShowKeyboard = state.status === 'active' && hangmanRole === 'guesser';
    letterGrid.style.display = shouldShowKeyboard ? 'grid' : 'none';
  }
  if (letterHelper) {
    const shouldShowText = state.status === 'active' && hangmanRole === 'guesser';
    letterHelper.style.display = shouldShowText ? 'block' : 'none';
  }

  // actualizam afisarea cuvantului si a literelor
  renderHangmanWord(state.maskedWord || '', state.secretWordVisible || false);
  renderHangmanLetters(state);
  if (figure) {
    figure.setAttribute('data-wrong', String(state.wrongGuesses || 0));
  }
}

function renderHangmanWord(maskedWord, showAll) {
  const container = document.getElementById('hangman-word-display');
  if (!container) return;
  container.innerHTML = '';

  // ajustam dimensiunea casetelor in functie de lungimea cuvantului
  container.classList.remove('word-long', 'word-very-long');
  const charsArr = maskedWord.split('');
  const visibleCount = charsArr.filter((ch) => ch !== ' ' && ch !== '_').length;
  if (visibleCount > 12 && visibleCount <= 16) {
    container.classList.add('word-long');
  } else if (visibleCount > 16) {
    container.classList.add('word-very-long');
  }
  charsArr.forEach((ch) => {
    const box = document.createElement('div');
    box.className = 'letter-box';
    if (ch === ' ') {
      box.textContent = '';
      box.classList.add('empty');
    } else if (ch === '_') {
      box.textContent = '';
      box.classList.add('empty');
    } else {
      box.textContent = ch;
    }
    container.appendChild(box);
  });
}

function buildLetterGrid() {
  const grid = document.getElementById('hangman-letter-grid');
  if (!grid) return;

  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  grid.innerHTML = '';

  letters.forEach((ch) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'letter-key';
    btn.textContent = ch;
    btn.dataset.letter = ch;
    btn.addEventListener('click', () => onHangmanGuessLetter(ch));
    grid.appendChild(btn);
  });
}

function renderHangmanLetters(state) {
  const grid = document.getElementById('hangman-letter-grid');
  if (!grid) return;
  if (!grid.children.length) {
    buildLetterGrid();
  }

  const guessed = new Set(state.guessedLetters || []);
  const word = (state.secretWordMaskedForEval || '').toUpperCase();

  Array.from(grid.children).forEach((btn) => {
    const letter = btn.dataset.letter;
    btn.classList.remove('used', 'correct', 'wrong');

    const isUsed = guessed.has(letter);
    if (isUsed) {
      btn.classList.add('used');
      if (word.includes(letter)) {
        btn.classList.add('correct');
      } else {
        btn.classList.add('wrong');
      }
    }

    const canClick = state.status === 'active' && hangmanRole === 'guesser';
    btn.disabled = !canClick || isUsed;
  });
}

function onHangmanSetWord() {
  const input = document.getElementById('hangman-secret-word');
  if (!input) return;
  let value = (input.value || '').trim().toUpperCase();
  value = value.replace(/[^A-Z ]/g, '');

  if (value.length < 3 || value.length > 16) {
    alert('Cuvantul trebuie sa aiba intre 3 si 16 litere.');
    return;
  }

  if (!/[A-Z]/.test(value)) {
    alert('Cuvantul trebuie sa contina doar litere (fara diacritice).');
    return;
  }

  hangmanSend({ type: 'hangman_set_word', word: value });
}

function onHangmanGuessLetter(letter) {
  if (hangmanRole !== 'guesser') return;
  hangmanSend({ type: 'hangman_guess', letter });
}

function handleHangmanGameOver(msg) {
  const overText = document.getElementById('hangman-over-text');
  const reveal = document.getElementById('hangman-reveal-word');

  let text = '';
  let winnerDisplayName = '';

  const loggedUser = hgGetLoggedInUser();
  const youNameRaw = hangmanPlayerName || (loggedUser && loggedUser.name) || 'Tu';
  const oppNameRaw =
    (hangmanLastState && hangmanLastState.opponentName) ||
    (loggedUser && loggedUser.name === 'andrei' ? 'Georgiana' : 'Andrei');

  if (msg.winner === 'guesser') {
    // Daca castigatoare este persoana care ghiceste
    const isYouWinner = hangmanRole === 'guesser';
    winnerDisplayName = isYouWinner ? hgFormatPlayerName(youNameRaw) : hgFormatPlayerName(oppNameRaw);
    text = `A castigat ${winnerDisplayName}! Cuvantul a fost ghicit la timp.`;
    if (hangmanRole === 'guesser' && typeof recordWin === 'function') {
      recordWin('hangman');
    }
  } else if (msg.winner === 'setter') {
    // Daca castigatoare este persoana care a ales cuvantul
    const isYouWinner = hangmanRole === 'setter';
    winnerDisplayName = isYouWinner ? hgFormatPlayerName(youNameRaw) : hgFormatPlayerName(oppNameRaw);
    text = `A castigat ${winnerDisplayName}. Ati ajuns in spanzuratoare.`;
    if (hangmanRole === 'setter' && typeof recordWin === 'function') {
      recordWin('hangman');
    }
  } else {
    text = 'Joc terminat.';
  }

  if (overText) overText.textContent = text;

  if (reveal && msg.secretWord) {
    reveal.textContent = `Cuvantul era: ${msg.secretWord}`;
  }

  // declansam animatia speciala cu personajul "salvator"
  startHangmanRescueAnimation();
}

function startHangmanRescueAnimation() {
  const figure = document.getElementById('hangman-figure');
  if (!figure || !hangmanLastState) return;

  const rope = figure.querySelector('.gallow-rope');
  const manGroup = figure.querySelector('.man-group');
  const walker = document.getElementById('hangman-rescue-walker');
  if (!rope || !manGroup || !walker) return;

  const headImg = walker.querySelector('.rescue-head-img');
  if (headImg) {
    const variant = typeof hangmanLastState.headVariant === 'number' ? hangmanLastState.headVariant : 0;
    const otherVariant = variant === 1 ? 0 : 1;
    const desiredSrc = otherVariant === 1 ? 'hangman-head2.png' : 'hangman-head.png';
    if (headImg.getAttribute('src') !== desiredSrc) {
      headImg.setAttribute('src', desiredSrc);
    }
  }

  // resetam orice stare anterioara de animatie
  walker.classList.remove('rescue-walk-in', 'rescue-walk-away');
  void walker.offsetWidth; // fortam reflow pentru a putea reporni animatia

  walker.classList.add('rescue-walk-in');

  const onAnimEnd = (e) => {
    if (e.animationName !== 'hangman-rescue-in') return;
    walker.removeEventListener('animationend', onAnimEnd);

    // cand a ajuns la spanzuratoare, ascundem funia si omul agatat
    rope.classList.add('rope-hidden');
    manGroup.classList.add('man-hidden');

    // il facem pe salvator sa plece cu el spre stanga ecranului
    walker.classList.remove('rescue-walk-in');
    walker.classList.add('rescue-walk-away');
  };

  walker.addEventListener('animationend', onAnimEnd);
}

// init global

window.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;

  document.querySelectorAll('.back-button').forEach((el) => {
    el.addEventListener('click', () => {
      window.location.href = '../2222.html';
    });
  });

  if (page === 'hangman-lobby') {
    initHangmanLobby();
  } else if (page === 'hangman-game') {
    buildLetterGrid();
    initHangmanGame();
  }
});
