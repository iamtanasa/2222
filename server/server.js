// server/server.js
// Server WebSocket pentru jocul Bulls & Cows 1v1
// Extins si pentru Spanzuratoarea 2-jucatori

const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

// roomCode -> room
// room = {
//   roomCode,
//   players: {
//     player1: { name, ws, secret: string|null, guesses: [] } | null,
//     player2: { name, ws, secret: string|null, guesses: [] } | null
//   },
//   currentTurn: 'player1' | 'player2' | null,
//   status: 'waiting' | 'waiting_secrets' | 'active' | 'finished' | 'opponent_left',
//   rematchRequests: { player1: boolean, player2: boolean }
// }

const rooms = new Map(); // pentru Bulls & Cows
const hangmanRooms = new Map(); // pentru Spanzuratoarea

function log(...args) {
  console.log('[SERVER]', ...args);
}

function generateRoomCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += letters[Math.floor(Math.random() * letters.length)];
  }
  if (rooms.has(code)) return generateRoomCode();
  if (hangmanRooms.has(code)) return generateRoomCode();
  return code;
}

function send(ws, payload) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(payload));
}

function validateNumber(value) {
  if (typeof value !== 'string' || value.length !== 4) return false;
  if (!/^\d{4}$/.test(value)) return false;
  const set = new Set(value.split(''));
  return set.size === 4;
}

function calcBullsAndCows(secret, guess) {
  let bulls = 0;
  let cows = 0;
  for (let i = 0; i < 4; i++) {
    if (guess[i] === secret[i]) bulls++;
    else if (secret.includes(guess[i])) cows++;
  }
  return { bulls, cows };
}

function findPlayer(ws) {
  for (const room of rooms.values()) {
    if (room.players.player1 && room.players.player1.ws === ws) {
      return { room, playerKey: 'player1' };
    }
    if (room.players.player2 && room.players.player2.ws === ws) {
      return { room, playerKey: 'player2' };
    }
  }
  return null;
}

// ----------------------- HANGMAN HELPERS -----------------------

function findHangmanPlayer(ws) {
  for (const room of hangmanRooms.values()) {
    if (room.players.setter && room.players.setter.ws === ws) {
      return { room, roleKey: 'setter' };
    }
    if (room.players.guesser && room.players.guesser.ws === ws) {
      return { room, roleKey: 'guesser' };
    }
  }
  return null;
}

function buildHangmanMaskedWord(secretWord, guessedLetters) {
  if (!secretWord) return '';
  const guessed = new Set((guessedLetters || []).map((c) => c.toUpperCase()));
  return secretWord
    .split('')
    .map((ch) => {
      if (ch === ' ') return ' ';
      const upper = ch.toUpperCase();
      return guessed.has(upper) ? upper : '_';
    })
    .join('');
}

function buildHangmanState(room, roleKey) {
  const you = room.players[roleKey];
  const otherKey = roleKey === 'setter' ? 'guesser' : 'setter';
  const opponent = room.players[otherKey];

  const masked = buildHangmanMaskedWord(room.secretWord, room.guessedLetters);

  return {
    roomCode: room.roomCode,
    status: room.status,
    youName: you ? you.name : null,
    opponentName: opponent ? opponent.name : null,
    role: roleKey,
    guessedLetters: room.guessedLetters,
    wrongGuesses: room.wrongGuesses,
    maxWrong: room.maxWrong,
    maskedWord: masked,
    secretWordSet: !!room.secretWord,
    secretWordVisible: roleKey === 'setter',
    secretWordMaskedForEval: room.secretWord || '',
    headVariant: typeof room.headVariant === 'number' ? room.headVariant : 0,
  };
}

function broadcastHangmanState(room) {
  ['setter', 'guesser'].forEach((key) => {
    const player = room.players[key];
    if (player && player.ws && player.ws.readyState === WebSocket.OPEN) {
      send(player.ws, {
        type: 'hangman_state',
        state: buildHangmanState(room, key),
      });
    }
  });
}

function buildStateFor(room, playerKey) {
  const you = room.players[playerKey];
  const otherKey = playerKey === 'player1' ? 'player2' : 'player1';
  const opponent = room.players[otherKey];

  const myMoves = you ? you.guesses : [];
  const opponentMoves = opponent ? opponent.guesses : [];

  return {
    roomCode: room.roomCode,
    status: room.status,
    youName: you ? you.name : null,
    opponentName: opponent ? opponent.name : null,
    currentTurn: room.currentTurn,
    isYourTurn: room.currentTurn === playerKey && room.status === 'active',
    yourSecretSet: !!(you && you.secret),
    opponentSecretSet: !!(opponent && opponent.secret),
    myMoves,
    opponentMoves,
    yourRematch: room.rematchRequests ? !!room.rematchRequests[playerKey] : false,
    opponentRematch: room.rematchRequests ? !!room.rematchRequests[otherKey] : false,
  };
}

function broadcastState(room) {
  ['player1', 'player2'].forEach((key) => {
    const player = room.players[key];
    if (player && player.ws && player.ws.readyState === WebSocket.OPEN) {
      send(player.ws, { type: 'state_update', state: buildStateFor(room, key) });
    }
  });
}

// Mesaje
function handleCreateRoom(ws) {
  const roomCode = generateRoomCode();
  // DOAR generăm codul; room-ul efectiv e creat la primul join_room
  send(ws, { type: 'room_created', roomCode });
}

// ----------------------- HANGMAN MESAJE -----------------------

function handleHangmanCreateRoom(ws) {
  const roomCode = generateRoomCode();
  send(ws, { type: 'hangman_room_created', roomCode });
}

function handleHangmanJoinRoom(ws, roomCode, playerName) {
  if (!roomCode || typeof roomCode !== 'string') {
    send(ws, { type: 'hangman_error', message: 'Cod de camera invalid.' });
    return;
  }
  roomCode = roomCode.toUpperCase();
  playerName = (playerName || 'Anonim').slice(0, 20);

  let room = hangmanRooms.get(roomCode);
  if (!room) {
    room = {
      roomCode,
      players: { setter: null, guesser: null },
      secretWord: null,
      guessedLetters: [],
      wrongGuesses: 0,
      maxWrong: 6,
      status: 'waiting',
      headVariant: 0, // 0 sau 1 - ce cap folosim
    };
    hangmanRooms.set(roomCode, room);
  }

  const existing = findHangmanPlayer(ws);
  if (existing && existing.room.roomCode !== roomCode) {
    handleHangmanDisconnect(ws);
  }

  if (!room.players.setter) {
    room.players.setter = { name: playerName, ws };
  } else if (!room.players.guesser) {
    room.players.guesser = { name: playerName, ws };
  } else {
    send(ws, { type: 'hangman_error', message: 'Camera este deja plina.' });
    return;
  }

  if (room.players.setter && room.players.guesser) {
    room.status = room.secretWord ? 'active' : 'waiting_word';
  } else {
    room.status = 'waiting';
  }

  broadcastHangmanState(room);
}

function handleHangmanSetWord(ws, word) {
  const found = findHangmanPlayer(ws);
  if (!found) {
    send(ws, { type: 'hangman_error', message: 'Nu esti intr-o camera.' });
    return;
  }
  const { room, roleKey } = found;
  if (roleKey !== 'setter') {
    send(ws, { type: 'hangman_error', message: 'Doar gazda poate seta cuvantul.' });
    return;
  }

  if (typeof word !== 'string') {
    send(ws, { type: 'hangman_error', message: 'Cuvant invalid.' });
    return;
  }

  const cleaned = word
    .toUpperCase()
    .replace(/[^A-Z ]/g, '')
    .trim();

  if (cleaned.length < 3 || cleaned.length > 16) {
    send(ws, {
      type: 'hangman_error',
      message: 'Cuvantul trebuie sa aiba intre 3 si 16 litere (fara diacritice).',
    });
    return;
  }

  room.secretWord = cleaned;
  room.guessedLetters = [];
  room.wrongGuesses = 0;
  room.status = room.players.guesser ? 'active' : 'waiting';

  // alegem random ce cap folosim pentru acest meci (0 sau 1)
  room.headVariant = Math.random() < 0.5 ? 0 : 1;

  // la inceputul jocului, dezvaluim automat o litera random din cuvant
  if (room.status === 'active') {
    const distinctLetters = Array.from(
      new Set(
        room.secretWord
          .split('')
          .filter((ch) => /[A-Z]/.test(ch))
          .map((ch) => ch.toUpperCase())
      )
    );
    if (distinctLetters.length > 0) {
      const randomIndex = Math.floor(Math.random() * distinctLetters.length);
      const starterLetter = distinctLetters[randomIndex];
      room.guessedLetters.push(starterLetter);
    }
  }

  broadcastHangmanState(room);
}

function handleHangmanGuess(ws, letter) {
  const found = findHangmanPlayer(ws);
  if (!found) {
    send(ws, { type: 'hangman_error', message: 'Nu esti intr-o camera.' });
    return;
  }
  const { room, roleKey } = found;

  if (room.status !== 'active') {
    send(ws, { type: 'hangman_error', message: 'Jocul nu este activ.' });
    return;
  }

  if (roleKey !== 'guesser') {
    send(ws, { type: 'hangman_error', message: 'Doar jucatorul care ghiceste poate alege litere.' });
    return;
  }

  if (!room.secretWord) {
    send(ws, { type: 'hangman_error', message: 'Cuvantul nu este setat inca.' });
    return;
  }

  if (typeof letter !== 'string' || letter.length !== 1) {
    send(ws, { type: 'hangman_error', message: 'Litera invalida.' });
    return;
  }

  const upper = letter.toUpperCase();
  if (!/[A-Z]/.test(upper)) {
    send(ws, { type: 'hangman_error', message: 'Alege doar litere A-Z.' });
    return;
  }

  if (room.guessedLetters.includes(upper)) {
    return; // ignoram literele deja folosite
  }

  room.guessedLetters.push(upper);

  if (!room.secretWord.includes(upper)) {
    room.wrongGuesses += 1;
  }

  const masked = buildHangmanMaskedWord(room.secretWord, room.guessedLetters);
  const allRevealed = masked.indexOf('_') === -1;

  if (allRevealed) {
    room.status = 'finished';
    ['setter', 'guesser'].forEach((key) => {
      const player = room.players[key];
      if (!player || !player.ws) return;
      const winner = key === 'guesser' ? 'you' : 'opponent';
      send(player.ws, {
        type: 'hangman_game_over',
        winner,
        secretWord: room.secretWord,
      });
    });
    broadcastHangmanState(room);
    return;
  }

  if (room.wrongGuesses >= room.maxWrong) {
    room.status = 'finished';
    ['setter', 'guesser'].forEach((key) => {
      const player = room.players[key];
      if (!player || !player.ws) return;
      const winner = key === 'setter' ? 'you' : 'opponent';
      send(player.ws, {
        type: 'hangman_game_over',
        winner,
        secretWord: room.secretWord,
      });
    });
    broadcastHangmanState(room);
    return;
  }

  broadcastHangmanState(room);
}

function handleHangmanPlayAgain(ws) {
  const found = findHangmanPlayer(ws);
  if (!found) {
    send(ws, { type: 'hangman_error', message: 'Nu esti intr-o camera.' });
    return;
  }
  const { room } = found;

  // la fiecare rematch schimbam rolurile: cel care ghicea devine gazda si invers
  const oldSetter = room.players.setter;
  const oldGuesser = room.players.guesser;
  room.players.setter = oldGuesser;
  room.players.guesser = oldSetter;

  room.secretWord = null;
  room.guessedLetters = [];
  room.wrongGuesses = 0;
    // la fiecare joc nou vom alege din nou capul
    room.headVariant = 0;
  room.status = room.players.setter && room.players.guesser ? 'waiting_word' : 'waiting';

  broadcastHangmanState(room);
}

function handleJoinRoom(ws, roomCode, playerName) {
  if (!roomCode || typeof roomCode !== 'string') {
    send(ws, { type: 'error', message: 'Cod de cameră invalid.' });
    return;
  }
  roomCode = roomCode.toUpperCase();
  playerName = (playerName || 'Anonim').slice(0, 20);

  let room = rooms.get(roomCode);
  if (!room) {
    room = {
      roomCode,
      players: { player1: null, player2: null },
      currentTurn: null,
      status: 'waiting',
      rematchRequests: { player1: false, player2: false },
    };
    rooms.set(roomCode, room);
  }

  // Verificăm dacă jucătorul e deja în acest room
  const existing = findPlayer(ws);
  if (existing && existing.room.roomCode !== roomCode) {
    // scoatem din alt room mai întâi
    handleDisconnect(ws);
  }

  if (!room.players.player1) {
    room.players.player1 = { name: playerName, ws, secret: null, guesses: [] };
  } else if (!room.players.player2) {
    room.players.player2 = { name: playerName, ws, secret: null, guesses: [] };
  } else {
    send(ws, { type: 'error', message: 'Camera este deja plină.' });
    return;
  }

  if (room.players.player1 && room.players.player2) {
    room.status = 'waiting_secrets';
  } else {
    room.status = 'waiting';
  }

  broadcastState(room);
}

function handleSetSecret(ws, value) {
  const found = findPlayer(ws);
  if (!found) {
    send(ws, { type: 'error', message: 'Nu ești într-o cameră.' });
    return;
  }
  const { room, playerKey } = found;

  if (!validateNumber(value)) {
    send(ws, {
      type: 'error',
      message: 'Numărul secret trebuie să aibă 4 cifre DISTINCTE.',
    });
    return;
  }

  room.players[playerKey].secret = value;

  const p1Ready = room.players.player1 && room.players.player1.secret;
  const p2Ready = room.players.player2 && room.players.player2.secret;

  if (p1Ready && p2Ready) {
    room.status = 'active';
    room.currentTurn = Math.random() < 0.5 ? 'player1' : 'player2';
  } else {
    room.status = 'waiting_secrets';
  }

  broadcastState(room);
}

function handleGuess(ws, value) {
  const found = findPlayer(ws);
  if (!found) {
    send(ws, { type: 'error', message: 'Nu ești într-o cameră.' });
    return;
  }
  const { room, playerKey } = found;

  if (room.status !== 'active') {
    send(ws, { type: 'error', message: 'Jocul nu este activ încă.' });
    return;
  }

  if (room.currentTurn !== playerKey) {
    send(ws, { type: 'error', message: 'Nu este rândul tău.' });
    return;
  }

  if (!validateNumber(value)) {
    send(ws, {
      type: 'error',
      message: 'Ghicul trebuie să aibă 4 cifre DISTINCTE.',
    });
    return;
  }

  const otherKey = playerKey === 'player1' ? 'player2' : 'player1';
  const opponent = room.players[otherKey];

  if (!opponent || !opponent.secret) {
    send(ws, { type: 'error', message: 'Adversarul nu și-a setat încă numărul secret.' });
    return;
  }

  const { bulls, cows } = calcBullsAndCows(opponent.secret, value);
  const playerGuesses = room.players[playerKey].guesses;
  const move = { guess: value, bulls, cows, by: playerKey, turn: playerGuesses.length + 1 };

  playerGuesses.push(move);

  if (bulls === 4) {
    room.status = 'finished';
    if (room.rematchRequests) {
      room.rematchRequests.player1 = false;
      room.rematchRequests.player2 = false;
    }
    broadcastState(room);

    ['player1', 'player2'].forEach((key) => {
      const player = room.players[key];
      if (!player || !player.ws) return;
      const winner = key === playerKey ? 'you' : 'opponent';
      const otherKeyForClient = key === 'player1' ? 'player2' : 'player1';
      const otherForClient = room.players[otherKeyForClient];
      const opponentSecret = otherForClient && otherForClient.secret ? otherForClient.secret : null;
      send(player.ws, { type: 'game_over', winner, opponentSecret });
    });
    return;
  }

  room.currentTurn = otherKey;
  broadcastState(room);
}

function handleDisconnect(ws) {
  const found = findPlayer(ws);
  if (found) {
    const { room, playerKey } = found;
    room.players[playerKey] = null;

    const otherKey = playerKey === 'player1' ? 'player2' : 'player1';
    const opponent = room.players[otherKey];

    if (!opponent) {
      rooms.delete(room.roomCode);
    } else {
      room.status = 'opponent_left';
      room.currentTurn = null;
      if (room.rematchRequests) {
        room.rematchRequests.player1 = false;
        room.rematchRequests.player2 = false;
      }

      send(opponent.ws, {
        type: 'error',
        message: 'Adversarul a ieșit din joc. Poți crea o cameră nouă.',
      });
      broadcastState(room);
    }
  }

  handleHangmanDisconnect(ws);
}

function handleHangmanDisconnect(ws) {
  const found = findHangmanPlayer(ws);
  if (!found) return;

  const { room, roleKey } = found;
  room.players[roleKey] = null;

  const otherKey = roleKey === 'setter' ? 'guesser' : 'setter';
  const opponent = room.players[otherKey];

  if (!opponent) {
    hangmanRooms.delete(room.roomCode);
    return;
  }

  room.status = 'opponent_left';

  send(opponent.ws, {
    type: 'hangman_error',
    message: 'Adversarul a iesit din joc. Poti crea o camera noua.',
  });
  broadcastHangmanState(room);
}

function handleRematch(ws) {
  const found = findPlayer(ws);
  if (!found) {
    send(ws, { type: 'error', message: 'Nu ești într-o cameră.' });
    return;
  }

  const { room, playerKey } = found;

  if (room.status !== 'finished') {
    send(ws, { type: 'error', message: 'Rematch-ul este disponibil doar după terminarea jocului.' });
    return;
  }

  if (!room.rematchRequests) {
    room.rematchRequests = { player1: false, player2: false };
  }

  room.rematchRequests[playerKey] = true;

  const otherKey = playerKey === 'player1' ? 'player2' : 'player1';

  if (room.rematchRequests[otherKey]) {
    ['player1', 'player2'].forEach((key) => {
      if (room.players[key]) {
        room.players[key].secret = null;
        room.players[key].guesses = [];
      }
    });

    room.currentTurn = null;
    room.status = room.players.player1 && room.players.player2 ? 'waiting_secrets' : 'waiting';
    room.rematchRequests.player1 = false;
    room.rematchRequests.player2 = false;

    broadcastState(room);
  } else {
    broadcastState(room);
  }
}

function handleMessage(ws, raw) {
  let msg;
  try {
    msg = JSON.parse(raw.toString());
  } catch (e) {
    send(ws, { type: 'error', message: 'Mesaj JSON invalid.' });
    return;
  }

  const { type } = msg;

  switch (type) {
    case 'create_room':
      handleCreateRoom(ws);
      break;
    case 'join_room':
      handleJoinRoom(ws, msg.roomCode, msg.playerName);
      break;
    case 'set_secret':
      handleSetSecret(ws, msg.value);
      break;
    case 'guess':
      handleGuess(ws, msg.value);
      break;
    case 'rematch':
      handleRematch(ws);
      break;
    case 'hangman_create_room':
      handleHangmanCreateRoom(ws);
      break;
    case 'hangman_join_room':
      handleHangmanJoinRoom(ws, msg.roomCode, msg.playerName);
      break;
    case 'hangman_set_word':
      handleHangmanSetWord(ws, msg.word);
      break;
    case 'hangman_guess':
      handleHangmanGuess(ws, msg.letter);
      break;
    case 'hangman_play_again':
      handleHangmanPlayAgain(ws);
      break;
    default:
      send(ws, { type: 'error', message: 'Tip de mesaj necunoscut.' });
  }
}

wss.on('connection', (ws) => {
  log('Client conectat');

  ws.on('message', (data) => handleMessage(ws, data));

  ws.on('close', () => {
    log('Client deconectat');
    handleDisconnect(ws);
  });

  ws.on('error', (err) => {
    log('Eroare WebSocket', err.message);
  });
});

log(`WebSocket server pornit pe portul ${PORT}`);
