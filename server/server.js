// server/server.js
// Server WebSocket pentru jocul Bulls & Cows 1v1
// Extins pentru Spanzuratoarea 2-jucatori si Memory Game 2-jucatori

const http = require('http');
const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;

// HTTP server pentru health-check (Render are nevoie de un endpoint HTTP activ)
const httpServer = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

const wss = new WebSocket.Server({ server: httpServer });

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
const memoryRooms = new Map(); // pentru Memory Game
const macaoRooms = new Map(); // pentru jocul Macao 2-jucatori
const razboiRooms = new Map(); // pentru jocul Razboi 2-jucatori
const trianglesRooms = new Map(); // pentru jocul Triunghiuri din puncte 2-jucatori

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
  if (memoryRooms.has(code)) return generateRoomCode();
  if (macaoRooms.has(code)) return generateRoomCode();
  if (razboiRooms.has(code)) return generateRoomCode();
  if (trianglesRooms.has(code)) return generateRoomCode();
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

// ----------------------- MEMORY HELPERS -----------------------

function findMemoryPlayer(ws) {
  for (const room of memoryRooms.values()) {
    if (room.players.a && room.players.a.ws === ws) {
      return { room, sideKey: 'a' };
    }
    if (room.players.b && room.players.b.ws === ws) {
      return { room, sideKey: 'b' };
    }
  }
  return null;
}

function buildMemoryState(room, sideKey) {
  const you = room.players[sideKey];
  const otherKey = sideKey === 'a' ? 'b' : 'a';
  const opponent = room.players[otherKey];

  const yourScore = room.scores ? room.scores[sideKey] || 0 : 0;
  const opponentScore = room.scores ? room.scores[otherKey] || 0 : 0;

  const currentTurnForClient =
    room.currentTurn && room.currentTurn === sideKey
      ? 'you'
      : room.currentTurn && room.currentTurn === otherKey
      ? 'opponent'
      : null;

  const board = (room.board || []).map((card) => ({
    pairId: card.pairId,
    revealed: !!card.revealed,
    matched: !!card.matchedBy,
    imageUrl: null, // clientul va alege pozele din galerie in functie de pairId
  }));

  return {
    roomCode: room.roomCode,
    status: room.status,
    mode: room.mode,
    youName: you ? you.name : null,
    opponentName: opponent ? opponent.name : null,
    currentTurn: currentTurnForClient,
    yourScore,
    opponentScore,
    totalPairs: room.totalPairs || 0,
    board,
  };
}

function broadcastMemoryState(room) {
  ['a', 'b'].forEach((key) => {
    const player = room.players[key];
    if (player && player.ws && player.ws.readyState === WebSocket.OPEN) {
      send(player.ws, {
        type: 'memory_state',
        state: buildMemoryState(room, key),
      });
    }
  });
}

// ----------------------- MACAO HELPERS -----------------------

function findMacaoPlayer(ws) {
  for (const room of macaoRooms.values()) {
    if (room.players.p1 && room.players.p1.ws === ws) {
      return { room, seat: 'p1' };
    }
    if (room.players.p2 && room.players.p2.ws === ws) {
      return { room, seat: 'p2' };
    }
  }
  return null;
}

function buildMacaoState(room, seat) {
  const you = room.players[seat];
  const otherSeat = seat === 'p1' ? 'p2' : 'p1';
  const opponent = room.players[otherSeat];

  const youHand = (room.hands[seat] || []).map((card) => ({
    id: card.id,
    rank: card.rank,
    suit: card.suit,
  }));

  const topDiscard = room.discardPile.length
    ? room.discardPile[room.discardPile.length - 1]
    : null;

  const turnsToSkip =
    room.skipTurns && typeof room.skipTurns[seat] === 'number' ? room.skipTurns[seat] : 0;
  const freePlay = room.freePlaySeat === seat;

  return {
    roomCode: room.roomCode,
    status: room.status,
    youName: you ? you.name : null,
    opponentName: opponent ? opponent.name : null,
    yourTurn: room.currentTurn === seat,
    pendingDraw: room.pendingDraw || 0,
    attackActive: room.attackActive || false,
    pendingSuitChoice: room.pendingSuitChoice === seat,
    demandedSuit: room.demandedSuit || null,
    turnsToSkip,
    freePlay,
    yourHand: youHand,
    opponentCardCount: (room.hands[otherSeat] || []).length,
    drawPileCount: room.drawPile.length,
    topDiscard: topDiscard
      ? { id: topDiscard.id, rank: topDiscard.rank, suit: topDiscard.suit }
      : null,
  };
}

function broadcastMacaoState(room) {
  ['p1', 'p2'].forEach((seat) => {
    const player = room.players[seat];
    if (player && player.ws && player.ws.readyState === WebSocket.OPEN) {
      send(player.ws, {
        type: 'macao_state',
        state: buildMacaoState(room, seat),
      });
    }
  });
}

function createMacaoDeck() {
  const suits = ['heart', 'diamond', 'club', 'spade'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck = [];
  let idCounter = 0;
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ id: `c${idCounter++}`, rank, suit });
    }
  }
  // doi jokers
  deck.push({ id: `c${idCounter++}`, rank: 'JOKER_BLACK', suit: 'joker' });
  deck.push({ id: `c${idCounter++}`, rank: 'JOKER_RED', suit: 'joker' });

  // shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

// ----------------------- RAZBOI HELPERS -----------------------

function findRazboiPlayer(ws) {
  for (const room of razboiRooms.values()) {
    if (room.players.p1 && room.players.p1.ws === ws) {
      return { room, seat: 'p1' };
    }
    if (room.players.p2 && room.players.p2.ws === ws) {
      return { room, seat: 'p2' };
    }
  }
  return null;
}

function createRazboiDeck() {
  const suits = ['heart', 'diamond', 'club', 'spade'];
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const deck = [];
  let idCounter = 0;
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ id: `r${idCounter++}`, rank, suit });
    }
  }

  // shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

function razboiRankValue(rank) {
  if (rank === 'J') return 11;
  if (rank === 'Q') return 12;
  if (rank === 'K') return 13;
  if (rank === 'A') return 14;
  const n = parseInt(rank, 10);
  return Number.isFinite(n) ? n : 0;
}

function dealRazboiInitial(room) {
  const deck = createRazboiDeck();
  room.decks = { p1: [], p2: [] };
  room.battlePile = [];
  room.lastCards = { p1: null, p2: null };
  room.lastMessage = 'Jocul a inceput. Apasati pe pachetele voastre pentru a scoate carti.';
  room.roundLock = false;
  room.phase = 'normal'; // 'normal' sau 'war'
  room.inWar = false;
  room.warValue = 0; // valoarea razboiului curent (2..14)
  room.drawCount = { p1: 0, p2: 0 }; // cate carti au scos in runda/razboiul curent

  deck.forEach((card, index) => {
    const seat = index % 2 === 0 ? 'p1' : 'p2';
    room.decks[seat].push(card);
  });

  room.status = 'active';
}

function buildRazboiState(room, seat) {
  const you = room.players[seat];
  const otherSeat = seat === 'p1' ? 'p2' : 'p1';
  const opponent = room.players[otherSeat];

  const lastYou = room.lastCards ? room.lastCards[seat] : null;
  const lastOpp = room.lastCards ? room.lastCards[otherSeat] : null;

   let requiredPresses = 0;
   if (room.inWar && room.drawCount) {
     const needed = room.warDrawRequired != null ? room.warDrawRequired : (room.warValue || 0);
     const done = Math.min(room.drawCount.p1 || 0, room.drawCount.p2 || 0);
     requiredPresses = Math.max(needed - done, 0);
   }

  return {
    roomCode: room.roomCode,
    status: room.status,
    youName: you ? you.name : null,
    opponentName: opponent ? opponent.name : null,
    yourDeckCount: room.decks && room.decks[seat] ? room.decks[seat].length : 0,
    opponentDeckCount: room.decks && room.decks[otherSeat] ? room.decks[otherSeat].length : 0,
    lastYouCard: lastYou ? { id: lastYou.id, rank: lastYou.rank, suit: lastYou.suit } : null,
    lastOpponentCard: lastOpp ? { id: lastOpp.id, rank: lastOpp.rank, suit: lastOpp.suit } : null,
    battleSize: room.battlePile ? room.battlePile.length : 0,
    message: room.lastMessage || null,
    inWar: !!room.inWar,
    roundWinner: room.lastRoundWinner ? (room.lastRoundWinner === seat ? 'you' : 'opponent') : null,
    requiredPresses,
  };
}

function broadcastRazboiState(room) {
  ['p1', 'p2'].forEach((seat) => {
    const player = room.players[seat];
    if (player && player.ws && player.ws.readyState === WebSocket.OPEN) {
      send(player.ws, {
        type: 'razboi_state',
        state: buildRazboiState(room, seat),
      });
    }
  });
}

// ----------------------- TRIANGLES HELPERS -----------------------

function findTrianglesPlayer(ws) {
  for (const room of trianglesRooms.values()) {
    if (room.players.p1 && room.players.p1.ws === ws) {
      return { room, seat: 'p1' };
    }
    if (room.players.p2 && room.players.p2.ws === ws) {
      return { room, seat: 'p2' };
    }
  }
  return null;
}

function createTrianglesPoints(count = 14) {
  const points = [];
  const minDist2 = 0.08 * 0.08;
  let attempts = 0;

  while (points.length < count && attempts < 2000) {
    attempts += 1;
    const x = 0.1 + 0.8 * Math.random();
    const y = 0.1 + 0.8 * Math.random();

    let ok = true;
    for (const p of points) {
      const dx = p.x - x;
      const dy = p.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < minDist2) {
        ok = false;
        break;
      }
    }

    if (ok) {
      points.push({ x, y });
    }
  }

  return points;
}

function canonicalEdge(a, b) {
  if (a === b) return null;
  return a < b ? { a, b } : { a: b, b: a };
}

function edgeKey(i, j) {
  return i < j ? `${i}-${j}` : `${j}-${i}`;
}

function buildEdgeSet(lines) {
  const set = new Set();
  (lines || []).forEach((l) => {
    const key = edgeKey(l.a, l.b);
    set.add(key);
  });
  return set;
}

function segmentsProperlyIntersect(p1, p2, p3, p4) {
  const eps = 1e-6;
  const x1 = p1.x;
  const y1 = p1.y;
  const x2 = p2.x;
  const y2 = p2.y;
  const x3 = p3.x;
  const y3 = p3.y;
  const x4 = p4.x;
  const y4 = p4.y;

  const denom = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
  if (Math.abs(denom) < eps) {
    // paralele sau aproape coliniare -> nu le consideram "trecere peste" aici
    return false;
  }

  const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / denom;
  const u = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / denom;

  // intersectie strict in interiorul ambelor segmente (nu la capete)
  if (t > eps && t < 1 - eps && u > eps && u < 1 - eps) {
    return true;
  }

  return false;
}

function computeAllTriangles(points, lines) {
  const result = [];
  if (!points || points.length < 3) return result;

  const n = points.length;
  const edgeSet = buildEdgeSet(lines);
  const eps = 1e-4;

  for (let i = 0; i < n - 2; i++) {
    for (let j = i + 1; j < n - 1; j++) {
      if (!edgeSet.has(edgeKey(i, j))) continue;
      for (let k = j + 1; k < n; k++) {
        if (!edgeSet.has(edgeKey(i, k))) continue;
        if (!edgeSet.has(edgeKey(j, k))) continue;

        const p1 = points[i];
        const p2 = points[j];
        const p3 = points[k];
        if (!p1 || !p2 || !p3) continue;

        const ax = p2.x - p1.x;
        const ay = p2.y - p1.y;
        const bx = p3.x - p1.x;
        const by = p3.y - p1.y;
        const area = Math.abs(ax * by - ay * bx);
        if (area < eps) continue; // aproape coliniar, nu-l consideram triunghi

        result.push({ a: i, b: j, c: k });
      }
    }
  }

  return result;
}

function buildTrianglesState(room, seat) {
  const you = room.players[seat];
  const otherSeat = seat === 'p1' ? 'p2' : 'p1';
  const opponent = room.players[otherSeat];

  const yourScore = room.scores ? room.scores[seat] || 0 : 0;
  const opponentScore = room.scores ? room.scores[otherSeat] || 0 : 0;

  const triangles = (room.triangles || []).map((t) => {
    const ownerSeat = t.owner === 'p1' || t.owner === 'p2' ? t.owner : null;
    const ownerPlayer = ownerSeat ? room.players[ownerSeat] : null;
    const ownerName = ownerPlayer && ownerPlayer.name ? ownerPlayer.name : null;
    return {
      a: t.a,
      b: t.b,
      c: t.c,
      owner: t.owner === seat ? 'you' : 'opponent',
      ownerSeat,
      ownerName,
    };
  });

  const remainingMoves = countRemainingTriangleEdges(room);

  return {
    roomCode: room.roomCode,
    status: room.status,
    youName: you ? you.name : null,
    opponentName: opponent ? opponent.name : null,
    yourTurn: room.currentTurn === seat,
    yourScore,
    opponentScore,
    points: room.points || [],
    lines: room.lines || [],
    triangles,
    remainingMoves,
  };
}

function broadcastTrianglesState(room) {
  ['p1', 'p2'].forEach((seat) => {
    const player = room.players[seat];
    if (player && player.ws && player.ws.readyState === WebSocket.OPEN) {
      send(player.ws, {
        type: 'triangles_state',
        state: buildTrianglesState(room, seat),
      });
    }
  });
}

function startTrianglesGame(room) {
  room.points = createTrianglesPoints(14);
  room.lines = [];
  room.triangles = [];
  room.scores = { p1: 0, p2: 0 };
  room.status = 'active';
  room.currentTurn = Math.random() < 0.5 ? 'p1' : 'p2';
  room.linesRemaining = 1; // fiecare jucator incepe tura cu 1 linie disponibila (2 puncte)
}

function countRemainingTriangleEdges(room) {
  const points = room.points || [];
  const n = points.length;
  if (n < 2) return 0;

  const existingSet = buildEdgeSet(room.lines || []);
  let count = 0;

  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      // 1) linia nu trebuie sa existe deja
      if (existingSet.has(edgeKey(i, j))) continue;

      const pA = points[i];
      const pB = points[j];
      if (!pA || !pB) continue;

      let valid = true;
      // 2) nu are voie sa treaca peste nicio linie existenta (dar poate sa se intalneasca in capete)
      for (const l of room.lines || []) {
        const pC = points[l.a];
        const pD = points[l.b];
        if (!pC || !pD) continue;

        const sharesEndpoint = i === l.a || i === l.b || j === l.a || j === l.b;
        if (sharesEndpoint) continue;

        if (segmentsProperlyIntersect(pA, pB, pC, pD)) {
          valid = false;
          break;
        }
      }

      if (valid) {
        count += 1;
      }
    }
  }

  return count;
}

function endTrianglesGame(room) {
  if (!room || room.status === 'finished') return;

  room.status = 'finished';

  const p1Score = room.scores && Number.isFinite(room.scores.p1) ? room.scores.p1 : 0;
  const p2Score = room.scores && Number.isFinite(room.scores.p2) ? room.scores.p2 : 0;

  ['p1', 'p2'].forEach((seatKey) => {
    const player = room.players[seatKey];
    if (!player || !player.ws) return;
    let winner;
    if (p1Score === p2Score) winner = 'draw';
    else if ((p1Score > p2Score && seatKey === 'p1') || (p2Score > p1Score && seatKey === 'p2')) {
      winner = 'you';
    } else {
      winner = 'opponent';
    }

    const otherKey = seatKey === 'p1' ? 'p2' : 'p1';
    const opponent = room.players[otherKey];

    send(player.ws, {
      type: 'triangles_game_over',
      winner,
      opponentName: opponent ? opponent.name : null,
      yourScore: seatKey === 'p1' ? p1Score : p2Score,
      opponentScore: seatKey === 'p1' ? p2Score : p1Score,
    });
  });
}

function checkRazboiGameOver(room, winnerSeat) {
  const p1Count = room.decks.p1.length;
  const p2Count = room.decks.p2.length;

  if (p1Count > 0 && p2Count > 0) {
    return false;
  }

  room.status = 'finished';

  ['p1', 'p2'].forEach((seat) => {
    const player = room.players[seat];
    if (!player || !player.ws) return;
    const result = seat === winnerSeat ? 'you' : 'opponent';
    const otherSeat = seat === 'p1' ? 'p2' : 'p1';
    const opponent = room.players[otherSeat];
    send(player.ws, {
      type: 'razboi_game_over',
      winner: result,
      opponentName: opponent ? opponent.name : null,
    });
  });

  return true;
}
function applyRazboiStep(room, seat) {
  if (!room.decks || !room.decks.p1 || !room.decks.p2) return;

  const p1 = room.decks.p1;
  const p2 = room.decks.p2;
  const otherSeat = seat === 'p1' ? 'p2' : 'p1';

  if (!room.phase) {
    room.phase = 'normal';
  }
  if (!room.drawCount) {
    room.drawCount = { p1: 0, p2: 0 };
  }
  const deck = room.decks[seat];
  // daca acest jucator nu mai are carti, nu mai poate trage, dar jocul se va decide
  // doar cand se rezolva runda/razboiul si unul ramane permanent fara carti
  if (!deck.length) {
    return;
  }

  if (!room.lastCards) {
    room.lastCards = { p1: null, p2: null };
  }

  // ---------------- Faza normala: o singura carte de fiecare ----------------
  if (room.phase === 'normal') {
    // daca este inceputul unei runde noi (nimeni nu a scos carte), resetam ultimele carti
    if ((room.drawCount.p1 || 0) === 0 && (room.drawCount.p2 || 0) === 0) {
      room.lastCards = { p1: null, p2: null };
      room.battlePile = room.battlePile || [];
    }

    // in runda normala, fiecare jucator scoate o singura carte
    if ((room.drawCount[seat] || 0) >= 1) {
      return;
    }

    const card = deck.shift();
    const pile = room.battlePile || [];
    pile.push(card);
    room.battlePile = pile;
    room.lastCards[seat] = card;
    room.drawCount[seat] = (room.drawCount[seat] || 0) + 1;

    // daca celalalt jucator nu a scos inca, asteptam
    if ((room.drawCount[otherSeat] || 0) === 0) {
      const otherPlayer = room.players[otherSeat];
      room.lastMessage = otherPlayer
        ? `Asteptam ca ${otherPlayer.name} sa scoata cartea.`
        : 'Asteptam si cartea adversarului.';
      return;
    }

    // acum ambele carti sunt scoase pentru runda normala -> decidem runda sau intram in razboi
    const c1 = room.lastCards.p1;
    const c2 = room.lastCards.p2;
    if (!c1 || !c2) {
      return;
    }

    const v1 = razboiRankValue(c1.rank);
    const v2 = razboiRankValue(c2.rank);

    if (v1 === v2) {
      // egalitate -> intra in razboi; As = 1 carte, nu 14
      const effectiveWarValue = v1 === 14 ? 1 : v1;
      room.phase = 'war';
      room.inWar = true;
      room.warValue = effectiveWarValue;
      const p1Len = room.decks.p1 ? room.decks.p1.length : 0;
      const p2Len = room.decks.p2 ? room.decks.p2.length : 0;
      room.warDrawRequired = Math.min(effectiveWarValue, p1Len, p2Len);
      room.drawCount = { p1: 0, p2: 0 };
      room.lastRoundWinner = null;
      room.lastMessage = `Razboi! Valoare ${effectiveWarValue}. Scoateti ${room.warDrawRequired} carti.`;
      return;
    }

    // avem castigator de runda normala
    const winnerSeat = v1 > v2 ? 'p1' : 'p2';
    const winnerDeck = room.decks[winnerSeat];
    room.battlePile.forEach((c) => winnerDeck.push(c));
    room.battlePile = [];

    room.lastMessage = `Runda castigata de ${
      winnerSeat === 'p1' ? room.players.p1.name : room.players.p2.name
    }.`;
    room.lastRoundWinner = winnerSeat;

    room.inWar = false;
    room.warValue = 0;
    room.drawCount = { p1: 0, p2: 0 };

    checkRazboiGameOver(room, winnerSeat);
    return;
  }

  // ---------------- Faza de razboi: amandoi scot acelasi numar (warDrawRequired) ----------------
  if (room.phase === 'war') {
    const needed = room.warDrawRequired != null ? room.warDrawRequired : (room.warValue || 0);
    if (needed <= 0) {
      room.phase = 'normal';
      room.inWar = false;
      room.drawCount = { p1: 0, p2: 0 };
      return;
    }

    if ((room.drawCount[seat] || 0) >= needed) {
      return;
    }

    const card = deck.shift();
    const pile = room.battlePile || [];
    pile.push(card);
    room.battlePile = pile;
    room.lastCards[seat] = card;
    room.drawCount[seat] = (room.drawCount[seat] || 0) + 1;

    const doneP1 = room.drawCount.p1 || 0;
    const doneP2 = room.drawCount.p2 || 0;

    const p1Done = doneP1 >= needed || p1.length === 0;
    const p2Done = doneP2 >= needed || p2.length === 0;

    if (!p1Done || !p2Done) {
      const minDone = Math.min(doneP1, doneP2);
      const remaining = Math.max(needed - minDone, 0);
      room.lastMessage = `Razboi in curs... Mai scoateti ${remaining} carti (acelasi numar).`;
      return;
    }

    const c1 = room.lastCards.p1;
    const c2 = room.lastCards.p2;
    if (!c1 || !c2) {
      return;
    }

    const v1 = razboiRankValue(c1.rank);
    const v2 = razboiRankValue(c2.rank);

    if (v1 === v2) {
      const effectiveWarValue = v1 === 14 ? 1 : v1;
      room.warValue = effectiveWarValue;
      const p1Len = room.decks.p1 ? room.decks.p1.length : 0;
      const p2Len = room.decks.p2 ? room.decks.p2.length : 0;
      room.warDrawRequired = Math.min(effectiveWarValue, p1Len, p2Len);
      room.drawCount = { p1: 0, p2: 0 };
      room.lastMessage = `Razboi continuat! Valoare ${effectiveWarValue}. Scoateti ${room.warDrawRequired} carti (acelasi numar).`;
      return;
    }

    const winnerSeat = v1 > v2 ? 'p1' : 'p2';
    const winnerDeck = room.decks[winnerSeat];
    room.battlePile.forEach((c) => winnerDeck.push(c));
    room.battlePile = [];

    room.lastMessage = `Razboiul a fost castigat de ${
      winnerSeat === 'p1' ? room.players.p1.name : room.players.p2.name
    }.`;
    room.lastRoundWinner = winnerSeat;

    room.phase = 'normal';
    room.inWar = false;
    room.warValue = 0;
    room.drawCount = { p1: 0, p2: 0 };

    checkRazboiGameOver(room, winnerSeat);
  }
}

function dealMacaoInitial(room) {
  room.drawPile = createMacaoDeck();
  room.discardPile = [];
  room.hands = { p1: [], p2: [] };
  room.currentTurn = Math.random() < 0.5 ? 'p1' : 'p2';
  room.skipTurns = { p1: 0, p2: 0 };
  room.freePlaySeat = null;
  room.pendingDraw = 0;
  room.attackActive = false;
  room.pendingSuitChoice = null;
  room.demandedSuit = null;

  // fiecare jucator primeste 5 carti
  const initialCards = 5;
  for (let i = 0; i < initialCards; i++) {
    ['p1', 'p2'].forEach((seat) => {
      if (!room.drawPile.length) {
        refillMacaoDrawPileIfNeeded(room);
        if (!room.drawPile.length) return;
      }
      const card = room.drawPile.pop();
      if (card) room.hands[seat].push(card);
    });
  }

  // intoarcem prima carte pe talon (nu o carte speciala puternica daca se poate)
  while (room.drawPile.length) {
    const card = room.drawPile.pop();
    if (!card) break;
    room.discardPile.push(card);
    break;
  }

  room.status = 'active';
}

// determinam culoarea logica a unei carti (rosu / negru) pentru reguli cu jokeri
function macaoCardColor(card) {
  if (!card) return null;
  if (card.rank === 'JOKER_RED') return 'red';
  if (card.rank === 'JOKER_BLACK') return 'black';
  if (card.suit === 'heart' || card.suit === 'diamond') return 'red';
  if (card.suit === 'club' || card.suit === 'spade') return 'black';
  return null;
}

// daca pachetul s-a golit, refacem din talon (ramane doar ultima carte pe talon)
function refillMacaoDrawPileIfNeeded(room) {
  if (!room || room.drawPile.length > 0) return;
  if (!room.discardPile || room.discardPile.length <= 1) return;

  const top = room.discardPile[room.discardPile.length - 1];
  const rest = room.discardPile.slice(0, -1);

  // amestecam restul cartilor si le facem noul pachet de tras
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }

  room.drawPile = rest;
  room.discardPile = [top];
}

function canPlayOnTop(card, topCard, attackActive, demandedSuit) {
  if (!topCard) return true;

  const effectiveSuit = (topCard.rank === '7' && demandedSuit) ? demandedSuit : topCard.suit;
  const topIsRedJoker = topCard.rank === 'JOKER_RED';
  const topIsBlackJoker = topCard.rank === 'JOKER_BLACK';

  // reguli speciale: peste jokerul rosu doar carti rosii, peste negru doar carti negre
  if (topIsRedJoker || topIsBlackJoker) {
    const allowedColor = topIsRedJoker ? 'red' : 'black';
    const cColor = macaoCardColor(card);

    // EXCEPTII:
    // - peste jokerul rosu poti pune 2/3/4 negre (umflaturi + 4 negru pentru stop)
    // - peste jokerul negru poti pune 2/3/4 rosii (umflaturi + 4 rosu pentru stop)
    if (
      ((topIsRedJoker && cColor === 'black') || (topIsBlackJoker && cColor === 'red')) &&
      (card.rank === '2' || card.rank === '3' || card.rank === '4')
    ) {
      return true;
    }

    // poti juca intotdeauna alt joker peste joker
    if (card.rank === 'JOKER_RED' || card.rank === 'JOKER_BLACK') {
      // dar daca suntem in atac, doar cartile de atac sunt permise
      if (attackActive) {
        return true;
      }
      return true;
    }

    // in rest trebuie sa respecte culoarea jokerului
    if (cColor !== allowedColor) return false;

    // daca suntem in atac, tot trebuie sa fie si carte de atac
    if (attackActive) {
      return (
        card.rank === '2' ||
        card.rank === '3' ||
        card.rank === '4' ||
        card.rank === 'JOKER_RED' ||
        card.rank === 'JOKER_BLACK'
      );
    }

    // in mod normal, orice carte cu culoarea potrivita e ok
    return true;
  }

  // in timpul atacului (cand exista carti de tras si sus nu este joker), poti juca doar carti de atac (2,3,4,joker)
  if (attackActive) {
    if (card.rank === '2' || card.rank === '3' || card.rank === '4') return true;
    if (card.rank === 'JOKER_BLACK' || card.rank === 'JOKER_RED') return true;
    return false;
  }

  // normal: potrivim dupa culoare sau rang (pentru 7 folosim demandedSuit), As-ul si 7 pot fi puse oricand, jokerii oricand
  if (card.rank === 'A') return true;
  if (card.rank === '7') return true;
  if (card.suit === effectiveSuit) return true;
  if (card.rank === topCard.rank) return true;
  if (card.rank === 'JOKER_BLACK' || card.rank === 'JOKER_RED') return true;
  return false;
}

function macaoAttackValue(card) {
  if (card.rank === '2') return 2;
  if (card.rank === '3') return 3;
  if (card.rank === 'JOKER_BLACK') return 5; // joker negru: +5 carti
  if (card.rank === 'JOKER_RED') return 10; // joker rosu: +10 carti
  return 0;
}

function macaoAdvanceTurn(room, fromSeat) {
  if (!room || !fromSeat) return;
  if (!room.skipTurns) {
    room.skipTurns = { p1: 0, p2: 0 };
  }
  const otherSeat = fromSeat === 'p1' ? 'p2' : 'p1';
  const skips = room.skipTurns[otherSeat] || 0;
  if (skips > 0) {
    room.skipTurns[otherSeat] = skips - 1;
    room.currentTurn = fromSeat;
  } else {
    room.currentTurn = otherSeat;
  }
}

function applyMacaoPlay(room, seat, cardId) {
  if (room.currentTurn !== seat || room.status !== 'active') {
    return { error: 'Nu este randul tau sau jocul nu este activ.' };
  }

  const hand = room.hands[seat] || [];
  const idx = hand.findIndex((c) => c.id === cardId);
  if (idx === -1) {
    return { error: 'Nu ai aceasta carte in mana.' };
  }

  const card = hand[idx];
  const top = room.discardPile.length ? room.discardPile[room.discardPile.length - 1] : null;

  const freePlayActive = room.freePlaySeat === seat;

  if (!freePlayActive && !canPlayOnTop(card, top, room.attackActive, room.demandedSuit)) {
    return { error: 'Nu poti juca aceasta carte acum.' };
  }

  room.demandedSuit = null;

  if (freePlayActive) {
    room.freePlaySeat = null;
  }

  // scoatem cartea din mana si o punem pe talon
  hand.splice(idx, 1);
  room.discardPile.push(card);

  // efectele cartilor speciale
  let stoppedAttackWithFour = false;
  const attackVal = macaoAttackValue(card);
  if (attackVal > 0) {
    room.pendingDraw = (room.pendingDraw || 0) + attackVal;
    room.attackActive = true;
  } else if (card.rank === 'A') {
    const otherSeat = seat === 'p1' ? 'p2' : 'p1';
    if (!room.skipTurns) {
      room.skipTurns = { p1: 0, p2: 0 };
    }
    room.skipTurns[otherSeat] = (room.skipTurns[otherSeat] || 0) + 1;
  }

  if (card.rank === '4' && room.attackActive && room.pendingDraw > 0) {
    room.pendingDraw = 0;
    room.attackActive = false;
    stoppedAttackWithFour = true;
    const otherSeat = seat === 'p1' ? 'p2' : 'p1';
    room.freePlaySeat = otherSeat;
  }

  if (hand.length === 0) {
    room.status = 'finished';
    ['p1', 'p2'].forEach((s) => {
      const p = room.players[s];
      if (!p || !p.ws) return;
      const winner = s === seat ? 'you' : 'opponent';
      send(p.ws, { type: 'macao_game_over', winner });
    });
    return { ok: true, finished: true };
  }

  if (card.rank === '7') {
    room.pendingSuitChoice = seat;
    return { ok: true, finished: false };
  }

  macaoAdvanceTurn(room, seat);
  return { ok: true, finished: false };
}

function applyMacaoDraw(room, seat) {
  if (room.currentTurn !== seat || room.status !== 'active') {
    return { error: 'Nu este randul tau sau jocul nu este activ.' };
  }

  const hand = room.hands[seat] || [];
  room.freePlaySeat = null;
  let cardsToDraw = 1;
  if (room.attackActive && room.pendingDraw > 0) {
    cardsToDraw = room.pendingDraw;
  }

  for (let i = 0; i < cardsToDraw; i++) {
    if (!room.drawPile.length) {
      refillMacaoDrawPileIfNeeded(room);
      if (!room.drawPile.length) break;
    }
    const card = room.drawPile.pop();
    if (card) hand.push(card);
  }

  // dupa ce ai tras penalizarea, atacul se opreste si tura trece la adversar
  room.pendingDraw = 0;
  room.attackActive = false;
  macaoAdvanceTurn(room, seat);

  return { ok: true };
}

function applyMacaoPlayPairs(room, seat, cardIds) {
  if (room.currentTurn !== seat || room.status !== 'active') {
    return { error: 'Nu este randul tau sau jocul nu este activ.' };
  }
  if (room.pendingSuitChoice) {
    return { error: 'Alege mai intai culoarea pentru 7.' };
  }

  const hand = room.hands[seat] || [];
  if (!Array.isArray(cardIds) || cardIds.length < 2) {
    return { error: 'Selecteaza cel putin 2 carti.' };
  }

  const uniq = new Set(cardIds);
  if (uniq.size !== cardIds.length) {
    return { error: 'Aceeasi carte nu poate fi selectata de doua ori.' };
  }

  const cards = [];
  for (const id of cardIds) {
    const idx = hand.findIndex((c) => c.id === id);
    if (idx === -1) return { error: 'Nu ai toate cartile selectate in mana.' };
    cards.push(hand[idx]);
  }

  // Grupam cartile consecutive dupa rang si verificam ca formeaza grupuri valide
  const groups = [];
  let gi = 0;
  while (gi < cards.length) {
    const groupRank = cards[gi].rank;
    let ge = gi + 1;
    while (ge < cards.length && cards[ge].rank === groupRank) ge++;
    const groupSize = ge - gi;
    if (groupSize < 2) {
      return { error: 'Fiecare grup de carti trebuie sa aiba cel putin 2 carti de acelasi fel.' };
    }
    groups.push({ rank: groupRank, start: gi, end: ge });
    gi = ge;
  }

  const top = room.discardPile.length ? room.discardPile[room.discardPile.length - 1] : null;
  if (!canPlayOnTop(cards[0], top, room.attackActive, room.demandedSuit)) {
    return { error: 'Prima carte din pereche nu se potriveste cu talonul.' };
  }

  room.demandedSuit = null;

  for (let i = cards.length - 1; i >= 0; i--) {
    const idx = hand.findIndex((x) => x.id === cards[i].id);
    if (idx !== -1) hand.splice(idx, 1);
  }
  for (const c of cards) {
    room.discardPile.push(c);
  }

  const lastCard = cards[cards.length - 1];
  let totalAttack = 0;
  let hasFour = false;
  let aceCount = 0;
  for (const c of cards) {
    totalAttack += macaoAttackValue(c);
    if (c.rank === '4') hasFour = true;
    if (c.rank === 'A') aceCount += 1;
  }
  let stoppedAttackWithFour = false;
  const hadAttackBefore = room.attackActive && room.pendingDraw > 0;
  if (hasFour && totalAttack > 0) {
    room.pendingDraw = 0;
    room.attackActive = false;
    if (hadAttackBefore) {
      stoppedAttackWithFour = true;
      const otherSeat = seat === 'p1' ? 'p2' : 'p1';
      room.freePlaySeat = otherSeat;
    }
  } else if (totalAttack > 0) {
    room.pendingDraw = (room.pendingDraw || 0) + totalAttack;
    room.attackActive = true;
  }

  if (hand.length === 0) {
    room.status = 'finished';
    ['p1', 'p2'].forEach((s) => {
      const p = room.players[s];
      if (!p || !p.ws) return;
      const winner = s === seat ? 'you' : 'opponent';
      send(p.ws, { type: 'macao_game_over', winner });
    });
    return { ok: true };
  }

  const otherSeat = seat === 'p1' ? 'p2' : 'p1';
  if (aceCount > 0) {
    if (!room.skipTurns) {
      room.skipTurns = { p1: 0, p2: 0 };
    }
    room.skipTurns[otherSeat] = (room.skipTurns[otherSeat] || 0) + aceCount;
  }

  if (lastCard.rank === '7') {
    room.pendingSuitChoice = seat;
    return { ok: true };
  }
  macaoAdvanceTurn(room, seat);
  return { ok: true };
}

function handleMacaoPlayPairs(ws, cardIds) {
  const found = findMacaoPlayer(ws);
  if (!found) {
    send(ws, { type: 'macao_error', message: 'Nu esti intr-o camera.' });
    return;
  }
  const { room, seat } = found;
  const result = applyMacaoPlayPairs(room, seat, cardIds);
  if (result.error) {
    send(ws, { type: 'macao_error', message: result.error });
    return;
  }
  broadcastMacaoState(room);
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

// ----------------------- MEMORY MESAJE -----------------------

function handleMemoryCreateRoom(ws) {
  const roomCode = generateRoomCode();
  send(ws, { type: 'memory_room_created', roomCode });
}

const MEMORY_PAIRS = {
  easy: 6,
  medium: 10,
  hard: 16,
};

function setupMemoryBoard(room) {
  const mode = room.mode && MEMORY_PAIRS[room.mode] ? room.mode : 'easy';
  const pairs = MEMORY_PAIRS[mode];
  room.totalPairs = pairs;

  const ids = [];
  for (let i = 0; i < pairs; i++) {
    ids.push(i);
    ids.push(i);
  }

  // amestecam cartile
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }

  room.board = ids.map((pairId) => ({ pairId, revealed: false, matchedBy: null }));
  room.scores = { a: 0, b: 0 };
  room.currentTurn = Math.random() < 0.5 ? 'a' : 'b';
  room.tempFlips = [];
  room.status = 'active';
}

function handleMemoryJoinRoom(ws, roomCode, playerName, mode) {
  if (!roomCode || typeof roomCode !== 'string') {
    send(ws, { type: 'memory_error', message: 'Cod de camera invalid.' });
    return;
  }
  roomCode = roomCode.toUpperCase();
  playerName = (playerName || 'Anonim').slice(0, 20);
  const normalizedMode = mode === 'medium' || mode === 'hard' ? mode : 'easy';

  let room = memoryRooms.get(roomCode);
  if (!room) {
    room = {
      roomCode,
      players: { a: null, b: null },
      mode: normalizedMode,
      status: 'waiting',
      board: [],
      scores: { a: 0, b: 0 },
      currentTurn: null,
      tempFlips: [],
      totalPairs: 0,
    };
    memoryRooms.set(roomCode, room);
  }

  const existing = findMemoryPlayer(ws);
  if (existing && existing.room.roomCode !== roomCode) {
    handleMemoryDisconnect(ws);
  }

  // Reconectare: daca exista deja un jucator cu acelasi nume, actualizam ws-ul
  let sideKey = null;
  if (room.players.a && room.players.a.name === playerName) {
    sideKey = 'a';
    room.players.a.ws = ws;
  } else if (room.players.b && room.players.b.name === playerName) {
    sideKey = 'b';
    room.players.b.ws = ws;
  } else if (!room.players.a) {
    sideKey = 'a';
    room.players.a = { name: playerName, ws };
    room.mode = normalizedMode;
  } else if (!room.players.b) {
    sideKey = 'b';
    room.players.b = { name: playerName, ws };
  } else {
    send(ws, { type: 'memory_error', message: 'Camera este deja plina.' });
    return;
  }

  if (room.players.a && room.players.b && room.status !== 'active') {
    setupMemoryBoard(room);
  }

  broadcastMemoryState(room);
}

function handleMemoryFlip(ws, index) {
  const found = findMemoryPlayer(ws);
  if (!found) {
    send(ws, { type: 'memory_error', message: 'Nu esti intr-o camera.' });
    return;
  }

  const { room, sideKey } = found;

  if (room.status !== 'active') {
    send(ws, { type: 'memory_error', message: 'Jocul nu este activ.' });
    return;
  }

  if (room.currentTurn !== sideKey) {
    send(ws, { type: 'memory_error', message: 'Nu este randul tau.' });
    return;
  }

  if (!Array.isArray(room.board) || index < 0 || index >= room.board.length) {
    return;
  }

  const card = room.board[index];
  if (!card || card.matchedBy || card.revealed) {
    return;
  }

  if (!Array.isArray(room.tempFlips)) {
    room.tempFlips = [];
  }

  if (room.tempFlips.length >= 2) {
    return;
  }

  card.revealed = true;
  room.tempFlips.push(index);

  broadcastMemoryState(room);

  if (room.tempFlips.length === 2) {
    const [i1, i2] = room.tempFlips;
    const c1 = room.board[i1];
    const c2 = room.board[i2];

    if (c1 && c2 && c1.pairId === c2.pairId) {
      c1.matchedBy = sideKey;
      c2.matchedBy = sideKey;
      room.scores[sideKey] = (room.scores[sideKey] || 0) + 1;
      room.tempFlips = [];

      const totalFound = (room.scores.a || 0) + (room.scores.b || 0);
      if (totalFound >= room.totalPairs) {
        room.status = 'finished';

        ['a', 'b'].forEach((key) => {
          const player = room.players[key];
          if (!player || !player.ws) return;
          const otherKey = key === 'a' ? 'b' : 'a';
          const yourScore = room.scores[key] || 0;
          const opponentScore = room.scores[otherKey] || 0;
          let winner;
          if (yourScore > opponentScore) winner = 'you';
          else if (yourScore < opponentScore) winner = 'opponent';
          else winner = 'tie';

          const opponent = room.players[otherKey];

          send(player.ws, {
            type: 'memory_game_over',
            winner,
            yourScore,
            opponentScore,
            opponentName: opponent ? opponent.name : null,
          });
        });

        broadcastMemoryState(room);
      } else {
        // acelasi jucator continua cand gaseste o pereche
        broadcastMemoryState(room);
      }
    } else {
      // nu este pereche – dupa o mica intarziere, intoarcem cartile la loc si schimbam tura
      const prevTurn = sideKey;
      const otherKey = sideKey === 'a' ? 'b' : 'a';

      setTimeout(() => {
        const [ii1, ii2] = room.tempFlips || [];
        if (
          Array.isArray(room.board) &&
          typeof ii1 === 'number' &&
          typeof ii2 === 'number' &&
          room.board[ii1] &&
          room.board[ii2]
        ) {
          room.board[ii1].revealed = false;
          room.board[ii2].revealed = false;
        }
        room.tempFlips = [];
        if (room.currentTurn === prevTurn) {
          room.currentTurn = otherKey;
        }
        broadcastMemoryState(room);
      }, 1500);
    }
  }
}

function handleMemoryPlayAgain(ws) {
  const found = findMemoryPlayer(ws);
  if (!found) {
    send(ws, { type: 'memory_error', message: 'Nu esti intr-o camera.' });
    return;
  }

  const { room } = found;

  if (!room.players.a || !room.players.b) {
    send(ws, { type: 'memory_error', message: 'Avem nevoie de doi jucatori pentru rematch.' });
    return;
  }

  setupMemoryBoard(room);
  broadcastMemoryState(room);
}

// ----------------------- MACAO MESAJE -----------------------

function handleMacaoCreateRoom(ws) {
  const roomCode = generateRoomCode();
  send(ws, { type: 'macao_room_created', roomCode });
}

function handleMacaoJoinRoom(ws, roomCode, playerName) {
  if (!roomCode || typeof roomCode !== 'string') {
    send(ws, { type: 'macao_error', message: 'Cod de camera invalid.' });
    return;
  }
  roomCode = roomCode.toUpperCase();
  playerName = (playerName || 'Anonim').slice(0, 20);

  let room = macaoRooms.get(roomCode);
  if (!room) {
    room = {
      roomCode,
      players: { p1: null, p2: null },
      hands: { p1: [], p2: [] },
      drawPile: [],
      discardPile: [],
      currentTurn: null,
      status: 'waiting',
      pendingDraw: 0,
      attackActive: false,
    };
    macaoRooms.set(roomCode, room);
  }

  const existing = findMacaoPlayer(ws);
  if (existing && existing.room.roomCode !== roomCode) {
    handleMacaoDisconnect(ws);
  }

  // Reconectare: daca exista deja un jucator cu acelasi nume, actualizam ws-ul
  let seat = null;
  if (room.players.p1 && room.players.p1.name === playerName) {
    seat = 'p1';
    room.players.p1.ws = ws;
  } else if (room.players.p2 && room.players.p2.name === playerName) {
    seat = 'p2';
    room.players.p2.ws = ws;
  } else if (!room.players.p1) {
    seat = 'p1';
    room.players.p1 = { name: playerName, ws };
  } else if (!room.players.p2) {
    seat = 'p2';
    room.players.p2 = { name: playerName, ws };
  } else {
    send(ws, { type: 'macao_error', message: 'Camera este deja plina.' });
    return;
  }

  if (room.players.p1 && room.players.p2 && room.status !== 'active' && room.status !== 'finished') {
    dealMacaoInitial(room);
  }

  broadcastMacaoState(room);
}

function handleMacaoPlay(ws, cardId) {
  const found = findMacaoPlayer(ws);
  if (!found) {
    send(ws, { type: 'macao_error', message: 'Nu esti intr-o camera.' });
    return;
  }

  const { room, seat } = found;
  if (room.pendingSuitChoice === seat) {
    send(ws, { type: 'macao_error', message: 'Alege mai intai culoarea pentru 7.' });
    return;
  }

  const result = applyMacaoPlay(room, seat, cardId);
  if (result.error) {
    send(ws, { type: 'macao_error', message: result.error });
    return;
  }

  broadcastMacaoState(room);
}

function handleMacaoChooseSuit(ws, suit) {
  const found = findMacaoPlayer(ws);
  if (!found) {
    send(ws, { type: 'macao_error', message: 'Nu esti intr-o camera.' });
    return;
  }
  const { room, seat } = found;
  if (room.pendingSuitChoice !== seat) {
    send(ws, { type: 'macao_error', message: 'Nu astepti alegerea culorii.' });
    return;
  }
  const validSuits = ['heart', 'diamond', 'club', 'spade'];
  if (!validSuits.includes(suit)) {
    send(ws, { type: 'macao_error', message: 'Culoare invalida.' });
    return;
  }
  room.demandedSuit = suit;
  room.pendingSuitChoice = null;
  macaoAdvanceTurn(room, seat);
  broadcastMacaoState(room);
}

function handleMacaoDraw(ws) {
  const found = findMacaoPlayer(ws);
  if (!found) {
    send(ws, { type: 'macao_error', message: 'Nu esti intr-o camera.' });
    return;
  }

  const { room, seat } = found;
  const result = applyMacaoDraw(room, seat);
  if (result.error) {
    send(ws, { type: 'macao_error', message: result.error });
    return;
  }

  broadcastMacaoState(room);
}

function handleMacaoPlayAgain(ws) {
  const found = findMacaoPlayer(ws);
  if (!found) {
    send(ws, { type: 'macao_error', message: 'Nu esti intr-o camera.' });
    return;
  }

  const { room } = found;

  if (!room.players.p1 || !room.players.p2) {
    send(ws, { type: 'macao_error', message: 'Avem nevoie de doi jucatori pentru rematch.' });
    return;
  }

  dealMacaoInitial(room);
  broadcastMacaoState(room);
}

// ----------------------- RAZBOI MESAJE -----------------------

function handleRazboiCreateRoom(ws) {
  const roomCode = generateRoomCode();
  send(ws, { type: 'razboi_room_created', roomCode });
}

function handleRazboiJoinRoom(ws, roomCode, playerName) {
  if (!roomCode || typeof roomCode !== 'string') {
    send(ws, { type: 'razboi_error', message: 'Cod de camera invalid.' });
    return;
  }
  roomCode = roomCode.toUpperCase();
  playerName = (playerName || 'Anonim').slice(0, 20);

  let room = razboiRooms.get(roomCode);
  if (!room) {
    room = {
      roomCode,
      players: { p1: null, p2: null },
      decks: { p1: [], p2: [] },
      battlePile: [],
      lastCards: { p1: null, p2: null },
      lastMessage: null,
      status: 'waiting',
    };
    razboiRooms.set(roomCode, room);
  }

  const existing = findRazboiPlayer(ws);
  if (existing && existing.room.roomCode !== roomCode) {
    handleRazboiDisconnect(ws);
  }

  // Reconectare: daca exista deja un jucator cu acelasi nume, actualizam ws-ul
  let seat = null;
  if (room.players.p1 && room.players.p1.name === playerName) {
    seat = 'p1';
    room.players.p1.ws = ws;
  } else if (room.players.p2 && room.players.p2.name === playerName) {
    seat = 'p2';
    room.players.p2.ws = ws;
  } else if (!room.players.p1) {
    seat = 'p1';
    room.players.p1 = { name: playerName, ws };
  } else if (!room.players.p2) {
    seat = 'p2';
    room.players.p2 = { name: playerName, ws };
  } else {
    send(ws, { type: 'razboi_error', message: 'Camera este deja plina.' });
    return;
  }

  if (room.players.p1 && room.players.p2 && room.status !== 'active' && room.status !== 'finished') {
    dealRazboiInitial(room);
  }

  broadcastRazboiState(room);
}

function handleRazboiPlayRound(ws) {
  const found = findRazboiPlayer(ws);
  if (!found) {
    send(ws, { type: 'razboi_error', message: 'Nu esti intr-o camera.' });
    return;
  }

  const { room } = found;
  if (room.status !== 'active') {
    send(ws, { type: 'razboi_error', message: 'Jocul nu este activ.' });
    return;
  }
  if (room.roundLock) {
    return;
  }

  room.roundLock = true;
  const { seat } = found;
  applyRazboiStep(room, seat);
  broadcastRazboiState(room);

  room.roundLock = false;
}

function handleRazboiPlayAgain(ws) {
  const found = findRazboiPlayer(ws);
  if (!found) {
    send(ws, { type: 'razboi_error', message: 'Nu esti intr-o camera.' });
    return;
  }

  const { room } = found;

  if (!room.players.p1 || !room.players.p2) {
    send(ws, { type: 'razboi_error', message: 'Avem nevoie de doi jucatori pentru rematch.' });
    return;
  }

  dealRazboiInitial(room);
  broadcastRazboiState(room);
}

// ----------------------- TRIANGLES MESAJE -----------------------

function handleTrianglesCreateRoom(ws) {
  const roomCode = generateRoomCode();
  send(ws, { type: 'triangles_room_created', roomCode });
}

function handleTrianglesJoinRoom(ws, roomCode, playerName) {
  if (!roomCode || typeof roomCode !== 'string') {
    send(ws, { type: 'triangles_error', message: 'Cod de camera invalid.' });
    return;
  }
  roomCode = roomCode.toUpperCase();
  playerName = (playerName || 'Anonim').slice(0, 20);

  let room = trianglesRooms.get(roomCode);
  if (!room) {
    room = {
      roomCode,
      players: { p1: null, p2: null },
      points: [],
      lines: [],
      triangles: [],
      scores: { p1: 0, p2: 0 },
      currentTurn: null,
      status: 'waiting',
    };
    trianglesRooms.set(roomCode, room);
  }

  const existing = findTrianglesPlayer(ws);
  if (existing && existing.room.roomCode !== roomCode) {
    handleTrianglesDisconnect(ws);
  }

  // Reconectare: daca exista deja un jucator cu acelasi nume, actualizam ws-ul
  let seat = null;
  if (room.players.p1 && room.players.p1.name === playerName) {
    seat = 'p1';
    room.players.p1.ws = ws;
  } else if (room.players.p2 && room.players.p2.name === playerName) {
    seat = 'p2';
    room.players.p2.ws = ws;
  } else if (!room.players.p1) {
    seat = 'p1';
    room.players.p1 = { name: playerName, ws };
  } else if (!room.players.p2) {
    seat = 'p2';
    room.players.p2 = { name: playerName, ws };
  } else {
    send(ws, { type: 'triangles_error', message: 'Camera este deja plina.' });
    return;
  }

  if (room.players.p1 && room.players.p2 && room.status !== 'active' && room.status !== 'finished') {
    startTrianglesGame(room);
  }

  broadcastTrianglesState(room);
}

function handleTrianglesPlay(ws, linesParam) {
  const found = findTrianglesPlayer(ws);
  if (!found) {
    send(ws, { type: 'triangles_error', message: 'Nu esti intr-o camera.' });
    return;
  }

  const { room, seat } = found;

  if (room.status !== 'active') {
    send(ws, { type: 'triangles_error', message: 'Jocul nu este activ.' });
    return;
  }

  if (room.currentTurn !== seat) {
    send(ws, { type: 'triangles_error', message: 'Nu este randul tau.' });
    return;
  }

  if (typeof room.linesRemaining !== 'number') {
    room.linesRemaining = 1;
  }

  if (room.linesRemaining <= 0) {
    send(ws, {
      type: 'triangles_error',
      message: 'Nu mai ai linii in aceasta tura. Asteapta randul adversarului.',
    });
    return;
  }
  // acceptam un singur segment de linie per mesaj; tura se schimba cand nu mai ai linii (baza 1, +1 pentru fiecare triunghi)
  let lineObj = null;
  if (Array.isArray(linesParam)) {
    if (linesParam.length !== 1) {
      send(ws, { type: 'triangles_error', message: 'Trebuie sa trasezi cate o linie pe rand.' });
      return;
    }
    lineObj = linesParam[0];
  } else {
    lineObj = linesParam;
  }

  const n = room.points ? room.points.length : 0;
  const a = Number(lineObj && lineObj.a);
  const b = Number(lineObj && lineObj.b);
  if (!Number.isInteger(a) || !Number.isInteger(b)) {
    send(ws, { type: 'triangles_error', message: 'Puncte invalide pentru linie.' });
    return;
  }
  if (a < 0 || a >= n || b < 0 || b >= n) {
    send(ws, { type: 'triangles_error', message: 'Punct in afara tablei.' });
    return;
  }
  if (a === b) {
    send(ws, { type: 'triangles_error', message: 'Nu poti trasa o linie dintr-un punct in el insusi.' });
    return;
  }

  const edge = canonicalEdge(a, b);
  if (!edge) {
    send(ws, { type: 'triangles_error', message: 'Linie invalida.' });
    return;
  }

  const existingEdgeKey = edgeKey(edge.a, edge.b);
  const existingSet = buildEdgeSet(room.lines || []);
  if (existingSet.has(existingEdgeKey)) {
    send(ws, { type: 'triangles_error', message: 'Exista deja o linie intre aceste puncte.' });
    return;
  }

  // regula: o linie noua nu poate sa treaca peste o alta linie existenta (doar sa se intalneasca in capete)
  const points = room.points || [];
  const pA = points[edge.a];
  const pB = points[edge.b];
  if (!pA || !pB) {
    send(ws, { type: 'triangles_error', message: 'Puncte invalide pentru linie.' });
    return;
  }

  for (const l of room.lines || []) {
    const pC = points[l.a];
    const pD = points[l.b];
    if (!pC || !pD) continue;

    // permitem intersectia la capete (daca impart un punct comun)
    const sharesEndpoint =
      edge.a === l.a || edge.a === l.b || edge.b === l.a || edge.b === l.b;
    if (sharesEndpoint) continue;

    if (segmentsProperlyIntersect(pA, pB, pC, pD)) {
      send(ws, {
        type: 'triangles_error',
        message: 'Linia ta ar trece peste o alta linie existenta. Alege un alt segment.',
      });
      return;
    }
  }

  const newLines = [edge];

  // pregatim setul de triunghiuri existente (chei sortate a-b-c)
  const existingTriangleKeys = new Set();
  (room.triangles || []).forEach((t) => {
    const arr = [t.a, t.b, t.c].sort((x, y) => x - y);
    existingTriangleKeys.add(arr.join('-'));
  });

  const allLines = (room.lines || []).concat(newLines);
  const allTriangles = computeAllTriangles(room.points || [], allLines);
  const newTriangles = [];

  allTriangles.forEach((tri) => {
    const arr = [tri.a, tri.b, tri.c].sort((x, y) => x - y);
    const key = arr.join('-');
    if (!existingTriangleKeys.has(key)) {
      existingTriangleKeys.add(key);
      newTriangles.push(tri);
    }
  });

  // mutarea este valida -> actualizam room
  room.lines = (room.lines || []).concat(newLines);
  if (!room.triangles) room.triangles = [];
  if (!room.scores) room.scores = { p1: 0, p2: 0 };

  newTriangles.forEach((tri) => {
    room.triangles.push({ a: tri.a, b: tri.b, c: tri.c, owner: seat });
    room.scores[seat] = (room.scores[seat] || 0) + 1;
  });

  // actualizam liniile ramase in tura curenta:
  // fiecare linie consuma 1, fiecare triunghi nou ofera +1 linie (2 puncte noi)
  const trianglesGained = newTriangles.length;
  room.linesRemaining = (room.linesRemaining || 0) - 1 + trianglesGained;

  // daca nu mai avem linii disponibile in aceasta tura si jocul continua, trecem tura la adversar
  if (room.linesRemaining <= 0 && room.status === 'active') {
    const otherSeat = seat === 'p1' ? 'p2' : 'p1';
    room.currentTurn = otherSeat;
    room.linesRemaining = 1;
  }

  // verificam daca mai exista mutari valide (cel putin 1 linie ramasa; jocul se opreste cand nu mai exista nicio linie noua)
  const remainingEdges = countRemainingTriangleEdges(room);
  if (remainingEdges < 1) {
    endTrianglesGame(room);
  }

  broadcastTrianglesState(room);
}

function handleTrianglesPlayAgain(ws) {
  const found = findTrianglesPlayer(ws);
  if (!found) {
    send(ws, { type: 'triangles_error', message: 'Nu esti intr-o camera.' });
    return;
  }

  const { room } = found;

  if (!room.players.p1 || !room.players.p2) {
    send(ws, { type: 'triangles_error', message: 'Avem nevoie de doi jucatori pentru rematch.' });
    return;
  }

  startTrianglesGame(room);
  broadcastTrianglesState(room);
}

function handleTrianglesForceEnd(ws) {
  const found = findTrianglesPlayer(ws);
  if (!found) {
    send(ws, { type: 'triangles_error', message: 'Nu esti intr-o camera.' });
    return;
  }

  const { room } = found;

  if (room.status !== 'active') {
    send(ws, { type: 'triangles_error', message: 'Jocul nu este activ.' });
    return;
  }

  endTrianglesGame(room);
  broadcastTrianglesState(room);
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

  // Reconectare: daca exista deja un jucator cu acelasi nume, actualizam ws-ul
  if (room.players.setter && room.players.setter.name === playerName) {
    room.players.setter.ws = ws;
  } else if (room.players.guesser && room.players.guesser.name === playerName) {
    room.players.guesser.ws = ws;
  } else if (!room.players.setter) {
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

  // Reconectare: daca exista deja un jucator cu acelasi nume, actualizam ws-ul
  if (room.players.player1 && room.players.player1.name === playerName) {
    room.players.player1.ws = ws;
  } else if (room.players.player2 && room.players.player2.name === playerName) {
    room.players.player2.ws = ws;
  } else if (!room.players.player1) {
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
  handleMemoryDisconnect(ws);
  handleMacaoDisconnect(ws);
  handleRazboiDisconnect(ws);
  handleTrianglesDisconnect(ws);
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

function handleMemoryDisconnect(ws) {
  const found = findMemoryPlayer(ws);
  if (!found) return;

  const { room, sideKey } = found;
  room.players[sideKey] = null;

  const otherKey = sideKey === 'a' ? 'b' : 'a';
  const opponent = room.players[otherKey];

  if (!opponent) {
    memoryRooms.delete(room.roomCode);
    return;
  }

  room.status = 'finished';

  send(opponent.ws, {
    type: 'memory_error',
    message: 'Adversarul a iesit din joc. Poti crea o camera noua.',
  });
  broadcastMemoryState(room);
}

function handleMacaoDisconnect(ws) {
  const found = findMacaoPlayer(ws);
  if (!found) return;

  const { room, seat } = found;
  room.players[seat] = null;

  const otherSeat = seat === 'p1' ? 'p2' : 'p1';
  const opponent = room.players[otherSeat];

  if (!opponent) {
    macaoRooms.delete(room.roomCode);
    return;
  }

  room.status = 'finished';

  send(opponent.ws, {
    type: 'macao_error',
    message: 'Adversarul a iesit din joc. Poti crea o camera noua.',
  });
  broadcastMacaoState(room);
}

function handleRazboiDisconnect(ws) {
  const found = findRazboiPlayer(ws);
  if (!found) return;

  const { room, seat } = found;
  room.players[seat] = null;

  const otherSeat = seat === 'p1' ? 'p2' : 'p1';
  const opponent = room.players[otherSeat];

  if (!opponent) {
    razboiRooms.delete(room.roomCode);
    return;
  }

  room.status = 'finished';

  send(opponent.ws, {
    type: 'razboi_error',
    message: 'Adversarul a iesit din joc. Poti crea o camera noua.',
  });
  broadcastRazboiState(room);
}

function handleTrianglesDisconnect(ws) {
  const found = findTrianglesPlayer(ws);
  if (!found) return;

  const { room, seat } = found;
  room.players[seat] = null;

  const otherSeat = seat === 'p1' ? 'p2' : 'p1';
  const opponent = room.players[otherSeat];

  if (!opponent) {
    trianglesRooms.delete(room.roomCode);
    return;
  }

  room.status = 'finished';

  send(opponent.ws, {
    type: 'triangles_error',
    message: 'Adversarul a iesit din joc. Poti crea o camera noua.',
  });
  broadcastTrianglesState(room);
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
    case 'memory_create_room':
      handleMemoryCreateRoom(ws);
      break;
    case 'memory_join_room':
      handleMemoryJoinRoom(ws, msg.roomCode, msg.playerName, msg.mode);
      break;
    case 'memory_flip':
      handleMemoryFlip(ws, msg.index);
      break;
    case 'memory_play_again':
      handleMemoryPlayAgain(ws);
      break;
    case 'macao_create_room':
      handleMacaoCreateRoom(ws);
      break;
    case 'macao_join_room':
      handleMacaoJoinRoom(ws, msg.roomCode, msg.playerName);
      break;
    case 'macao_play':
      handleMacaoPlay(ws, msg.cardId);
      break;
    case 'macao_choose_suit':
      handleMacaoChooseSuit(ws, msg.suit);
      break;
    case 'macao_play_pairs':
      handleMacaoPlayPairs(ws, msg.cardIds);
      break;
    case 'macao_draw':
      handleMacaoDraw(ws);
      break;
    case 'macao_play_again':
      handleMacaoPlayAgain(ws);
      break;
    case 'triangles_create_room':
      handleTrianglesCreateRoom(ws);
      break;
    case 'triangles_join_room':
      handleTrianglesJoinRoom(ws, msg.roomCode, msg.playerName);
      break;
    case 'triangles_play':
      handleTrianglesPlay(ws, msg.lines);
      break;
    case 'triangles_force_end':
      handleTrianglesForceEnd(ws);
      break;
    case 'triangles_play_again':
      handleTrianglesPlayAgain(ws);
      break;
    case 'razboi_create_room':
      handleRazboiCreateRoom(ws);
      break;
    case 'razboi_join_room':
      handleRazboiJoinRoom(ws, msg.roomCode, msg.playerName);
      break;
    case 'razboi_play_round':
      handleRazboiPlayRound(ws);
      break;
    case 'razboi_play_again':
      handleRazboiPlayAgain(ws);
      break;
    default:
      send(ws, { type: 'error', message: 'Tip de mesaj necunoscut.' });
  }
}

const HEARTBEAT_INTERVAL_MS = 25000;

wss.on('connection', (ws) => {
  log('Client conectat');
  ws.isAlive = true;

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (data) => {
    // Clientul trimite ping JSON pentru keep-alive; raspundem cu pong JSON
    try {
      const parsed = JSON.parse(data);
      if (parsed.type === 'ping') {
        ws.isAlive = true;
        send(ws, { type: 'pong' });
        return;
      }
    } catch (_) {
      // nu e JSON valid, continuam normal
    }
    handleMessage(ws, data);
  });

  ws.on('close', () => {
    log('Client deconectat');
    handleDisconnect(ws);
  });

  ws.on('error', (err) => {
    log('Eroare WebSocket', err.message);
  });
});

// Heartbeat: verificam daca clientii mai raspund la ping
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, HEARTBEAT_INTERVAL_MS);

httpServer.listen(PORT, () => {
  log(`WebSocket + HTTP server pornit pe portul ${PORT}`);
});
