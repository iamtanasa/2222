// ==========================================
// PUZZLE GAME - LOGICA PRINCIPALĂ V2
// ==========================================

let gameState = {
    difficulty: 0,
    image: null,
    imageDataUrl: null,
    pieces: [],
    gameStartTime: null,
    timerInterval: null,
    isPlaying: false
};

const DIFFICULTY_NAMES = { 3: 'Ușor', 4: 'Mediu', 5: 'Greu' };

let draggedPiece = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

// ==========================================
// 1. GESTIONARE IMAGINE
// ==========================================

const imageInput = document.getElementById('puzzle-image-input');
if (imageInput) {
    imageInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            gameState.imageDataUrl = event.target.result;
            
            const img = new Image();
            img.onload = function() {
                gameState.image = img;
                document.getElementById('file-selected').textContent = 
                    '✅ Fotografie încărcată: ' + file.name;
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// --- Alegere imagine din galerie (Supabase) ---

async function openPuzzleGallery() {
    const modal = document.getElementById('puzzle-gallery-modal');
    const grid = document.getElementById('puzzle-gallery-grid');

    if (!modal || !grid) return;

    grid.innerHTML = '<p style="color:white; grid-column: 1/-1;">Se încarcă amintirile...</p>';

    if (typeof _supabase === 'undefined') {
        grid.innerHTML = '<p style="color:white; grid-column: 1/-1;">Galeria nu este disponibilă acum.</p>';
        modal.style.display = 'block';
        return;
    }

    try {
        const { data, error } = await _supabase
            .from('Poze')
            .select('id, url, created_at')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Eroare la încărcarea pozelor pentru puzzle:', error.message);
            grid.innerHTML = '<p style="color:white; grid-column: 1/-1;">Nu am putut încărca galeria.</p>';
        } else if (!data || data.length === 0) {
            grid.innerHTML = '<p style="color:white; grid-column: 1/-1;">Încă nu avem amintiri în galerie. ❤️</p>';
        } else {
            grid.innerHTML = '';
            data.forEach(item => {
                const div = document.createElement('div');
                div.className = 'gallery-item';
                div.innerHTML = `<img src="${item.url}" alt="amintire" />`;
                div.querySelector('img').onclick = () => selectPuzzleImage(item.url);
                grid.appendChild(div);
            });
        }
    } catch (err) {
        console.error('Eroare neașteptată la galeria de puzzle:', err);
        grid.innerHTML = '<p style="color:white; grid-column: 1/-1;">A apărut o eroare neașteptată.</p>';
    }

    modal.style.display = 'block';
}

function closePuzzleGallery() {
    const modal = document.getElementById('puzzle-gallery-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function selectPuzzleImage(url) {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = function() {
        gameState.image = img;
        gameState.imageDataUrl = url;

        const info = document.getElementById('file-selected');
        if (info) {
            info.textContent = '📸 Fotografie aleasă din galerie';
        }

        closePuzzleGallery();
    };

    img.onerror = function() {
        alert('Nu am reușit să încarc această fotografie. Încearcă alta.');
    };

    img.src = url;
}

// ==========================================
// 2. INIȚIERE JOC
// ==========================================

function startGame(difficulty) {
    if (!gameState.image) {
        alert('❌ Alege o fotografie mai întâi!');
        return;
    }

    gameState.difficulty = difficulty;
    gameState.isPlaying = true;
    gameState.gameStartTime = Date.now();

    createPuzzlePieces();
    document.getElementById('screen-menu').style.display = 'none';
    document.getElementById('screen-game').style.display = 'block';
    document.getElementById('screen-win').style.display = 'none';

    document.getElementById('stat-difficulty').textContent = DIFFICULTY_NAMES[difficulty];
    document.getElementById('stat-connected').textContent = '0';

    startTimer();
    drawBoard();
}

// ==========================================
// 3. CREEAZĂ PIESE DE PUZZLE
// ==========================================

function createPuzzlePieces() {
    const cols = gameState.difficulty;
    const rows = gameState.difficulty;
    gameState.pieces = [];

    const pieceWidth = gameState.image.width / cols;
    const pieceHeight = gameState.image.height / rows;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = pieceWidth;
    tempCanvas.height = pieceHeight;
    const ctx = tempCanvas.getContext('2d');

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            ctx.clearRect(0, 0, pieceWidth, pieceHeight);
            ctx.drawImage(
                gameState.image,
                col * pieceWidth, row * pieceHeight, pieceWidth, pieceHeight,
                0, 0, pieceWidth, pieceHeight
            );

            const piece = {
                id: row * cols + col,
                row: row,
                col: col,
                correctRow: row,
                correctCol: col,
                image: tempCanvas.toDataURL(),
                connected: false,
                // coordonate vor fi setate la prima desenare, când știm dimensiunea containerului
                x: 0,
                y: 0,
                initialized: false
            };

            gameState.pieces.push(piece);
        }
    }
}

// ==========================================
// 4. DESENARE TABLA
// ==========================================

function drawBoard() {
    const container = document.getElementById('puzzle-pieces');
    if (!container) return;

    // Desenăm mai întâi grid-ul, ca să știm dimensiunea exactă a celulelor
    drawTargetGrid();

    container.innerHTML = '';

    const cols = gameState.difficulty;
    const board = document.getElementById('puzzle-board');
    const boardRect = board.getBoundingClientRect();

    // Dimensiunea reală a unei celule (ține cont de padding, gap, border)
    const slots = board.querySelectorAll('.puzzle-slot');
    let cellWidth = boardRect.width / cols;
    let cellHeight = boardRect.width / cols;
    if (slots.length > 0) {
        const slotRect = slots[0].getBoundingClientRect();
        cellWidth = slotRect.width;
        cellHeight = slotRect.height;
    }

    // Acum containerul este vizibil, putem calcula zona disponibilă pentru împrăștiere
    const contRect = container.getBoundingClientRect();
    const maxX = Math.max(0, contRect.width - cellWidth);
    const maxY = Math.max(0, contRect.height - cellHeight);

    gameState.pieces.forEach((piece, index) => {
        // Dacă piesa nu a primit încă poziție random (inițial sau după reset)
        if (!piece.connected && !piece.initialized) {
            piece.x = Math.random() * maxX;
            piece.y = Math.random() * maxY;
            piece.initialized = true;
        }

        const pieceDiv = document.createElement('div');
        pieceDiv.className = 'puzzle-piece';
        pieceDiv.id = 'piece-' + piece.id;
        pieceDiv.dataset.pieceId = piece.id;
        pieceDiv.style.backgroundImage = `url('${piece.image}')`;
        pieceDiv.style.left = piece.x + 'px';
        pieceDiv.style.top = piece.y + 'px';
        pieceDiv.style.width = cellWidth + 'px';
        pieceDiv.style.height = cellHeight + 'px';
        pieceDiv.style.position = 'absolute';
        pieceDiv.style.zIndex = index + 10;

        pieceDiv.addEventListener('mousedown', onPieceMouseDown, false);
        pieceDiv.addEventListener('touchstart', onPieceTouchStart, false);

        container.appendChild(pieceDiv);
    });
}

function drawTargetGrid() {
    const board = document.getElementById('puzzle-board');
    if (!board) return;
    
    board.innerHTML = '';

    const cols = gameState.difficulty;
    const boardSize = 250;
    const pieceSize = boardSize / cols;

    for (let i = 0; i < cols * cols; i++) {
        const slot = document.createElement('div');
        slot.className = 'puzzle-slot';
        slot.style.width = pieceSize + 'px';
        slot.style.height = pieceSize + 'px';
        board.appendChild(slot);
    }

    board.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    board.style.width = boardSize + 'px';
    board.style.height = boardSize + 'px';
}

// ==========================================
// 5. DRAG & DROP - MOUSE
// ==========================================

function onPieceMouseDown(e) {
    if (!gameState.isPlaying || e.target.classList.contains('attached')) return;

    const piece = getPieceFromElement(e.target);
    if (!piece) return;

    e.preventDefault();

    draggedPiece = piece;
    const container = document.getElementById('puzzle-pieces');
    const contRect = container.getBoundingClientRect();

    const clientX = e.clientX;
    const clientY = e.clientY;

    // offset față de poziția piesei în container
    dragOffsetX = clientX - (contRect.left + piece.x);
    dragOffsetY = clientY - (contRect.top + piece.y);

    e.target.style.zIndex = 2000;
    e.target.classList.add('dragging');

    document.addEventListener('mousemove', onMouseMove, false);
    document.addEventListener('mouseup', onMouseUp, false);
}

function onMouseMove(e) {
    if (!draggedPiece) return;

    const elem = document.getElementById('piece-' + draggedPiece.id);
    if (!elem) return;

    const container = document.getElementById('puzzle-pieces');
    const contRect = container.getBoundingClientRect();

    const clientX = e.clientX;
    const clientY = e.clientY;

    // coordonate relative la container
    const x = clientX - contRect.left - dragOffsetX;
    const y = clientY - contRect.top - dragOffsetY;

    draggedPiece.x = x;
    draggedPiece.y = y;

    elem.style.left = x + 'px';
    elem.style.top = y + 'px';
}

function onMouseUp(e) {
    if (!draggedPiece) return;

    const elem = document.getElementById('piece-' + draggedPiece.id);
    if (elem) {
        elem.classList.remove('dragging');
        elem.style.zIndex = 10;
    }

    checkPieceMatch(draggedPiece);

    document.removeEventListener('mousemove', onMouseMove, false);
    document.removeEventListener('mouseup', onMouseUp, false);

    draggedPiece = null;
}

// ==========================================
// 6. DRAG & DROP - TOUCH (MOBILE)
// ==========================================

function onPieceTouchStart(e) {
    if (!gameState.isPlaying || e.target.classList.contains('attached')) return;

    const piece = getPieceFromElement(e.target);
    if (!piece) return;

    e.preventDefault();

    draggedPiece = piece;
    const container = document.getElementById('puzzle-pieces');
    const contRect = container.getBoundingClientRect();
    const touch = e.touches[0];

    dragOffsetX = touch.clientX - (contRect.left + piece.x);
    dragOffsetY = touch.clientY - (contRect.top + piece.y);

    e.target.style.zIndex = 2000;
    e.target.classList.add('dragging');

    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd, false);
}

function onTouchMove(e) {
    if (!draggedPiece) return;
    e.preventDefault();

    const elem = document.getElementById('piece-' + draggedPiece.id);
    if (!elem) return;

    const container = document.getElementById('puzzle-pieces');
    const contRect = container.getBoundingClientRect();

    const touch = e.touches[0];
    const x = touch.clientX - contRect.left - dragOffsetX;
    const y = touch.clientY - contRect.top - dragOffsetY;

    draggedPiece.x = x;
    draggedPiece.y = y;

    elem.style.left = x + 'px';
    elem.style.top = y + 'px';
}

function onTouchEnd(e) {
    if (!draggedPiece) return;

    const elem = document.getElementById('piece-' + draggedPiece.id);
    if (elem) {
        elem.classList.remove('dragging');
        elem.style.zIndex = 10;
    }

    checkPieceMatch(draggedPiece);

    document.removeEventListener('touchmove', onTouchMove, false);
    document.removeEventListener('touchend', onTouchEnd, false);

    draggedPiece = null;
}

// ==========================================
// 7. DETECȚIE POZIȚIE CORECTĂ
// ==========================================

function checkPieceMatch(piece) {
    if (piece.connected) return;

    const board = document.getElementById('puzzle-board');
    if (!board) return;

    const boardRect = board.getBoundingClientRect();
    const elem = document.getElementById('piece-' + piece.id);
    if (!elem) return;

    const pieceRect = elem.getBoundingClientRect();

    // Centrul piesei
    const pieceCenterX = pieceRect.left + pieceRect.width / 2;
    const pieceCenterY = pieceRect.top + pieceRect.height / 2;

    // Poziția relativă la board
    const relX = pieceCenterX - boardRect.left;
    const relY = pieceCenterY - boardRect.top;

    // Verifică dacă e în limitele board-ului
    if (relX < 0 || relY < 0 || relX > boardRect.width || relY > boardRect.height) {
        return;
    }

    const cols = gameState.difficulty;
    const slotWidth = boardRect.width / cols;
    const slotHeight = boardRect.height / cols;

    const slotCol = Math.floor(relX / slotWidth);
    const slotRow = Math.floor(relY / slotHeight);

    // Verifică dacă piesa se potrivește la poziția corectă
    if (slotRow === piece.correctRow && slotCol === piece.correctCol) {
        attachPiece(piece);
    }
}

function attachPiece(piece) {
    piece.connected = true;
    const elem = document.getElementById('piece-' + piece.id);
    
    if (elem) {
        elem.classList.add('attached');

        const board = document.getElementById('puzzle-board');
        const container = document.getElementById('puzzle-pieces');
        const contRect = container.getBoundingClientRect();
        const cols = gameState.difficulty;

        // Identificăm direct celula corectă și îi folosim dimensiunea reală
        const slots = board.querySelectorAll('.puzzle-slot');
        const index = piece.correctRow * cols + piece.correctCol;
        const targetSlot = slots[index];

        if (!targetSlot) return;

        const slotRect = targetSlot.getBoundingClientRect();

        // Poziția țintă relativ la containerul pieselor
        // Mică corecție: +1px la stânga și +1px în sus față de setarea anterioară
        const targetX = slotRect.left - contRect.left - 3; // 3px spre stânga
        const targetY = slotRect.top - contRect.top - 3;   // 3px în sus

        // Update piece coordinates
        piece.x = targetX;
        piece.y = targetY;

        // Animație la poziția corectă
        elem.style.transition = 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
        elem.style.left = targetX + 'px';
        elem.style.top = targetY + 'px';
        elem.style.boxShadow = '0 0 20px rgba(255, 183, 3, 0.8), 0 0 10px rgba(255, 77, 109, 0.6)';

        setTimeout(() => {
            elem.style.boxShadow = 'none';
            elem.style.transition = 'none';
        }, 600);
    }

    const connectedCount = gameState.pieces.filter(p => p.connected).length;
    document.getElementById('stat-connected').textContent = connectedCount;

    if (connectedCount === gameState.pieces.length) {
        winGame();
    }
}

// ==========================================
// 8. TIMER
// ==========================================

function startTimer() {
    let seconds = 0;
    gameState.timerInterval = setInterval(() => {
        seconds++;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        document.getElementById('stat-time').textContent = 
            String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
    }, 1000);
}

function stopTimer() {
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
    }
}

// ==========================================
// 9. VICTORIA
// ==========================================

function winGame() {
    gameState.isPlaying = false;
    stopTimer();

    const timeString = document.getElementById('stat-time').textContent;

    document.getElementById('final-image').innerHTML = 
        `<img src="${gameState.imageDataUrl}" style="max-width: 200px; border-radius: 15px; box-shadow: 0 0 30px rgba(255, 183, 3, 0.5);">`;
    
    document.getElementById('win-message').textContent = `⏱️ Timp: ${timeString}`;

    document.getElementById('screen-game').style.display = 'none';
    document.getElementById('screen-win').style.display = 'block';

    createConfetti();
}

function createConfetti() {
    for (let i = 0; i < 30; i++) {
        const confetti = document.createElement('div');
        confetti.style.position = 'fixed';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.top = '-10px';
        confetti.style.width = '10px';
        confetti.style.height = '10px';
        confetti.style.backgroundColor = ['#ff4d6d', '#ffb703', '#ff6b81'][Math.floor(Math.random() * 3)];
        confetti.style.borderRadius = '50%';
        confetti.style.pointerEvents = 'none';
        confetti.style.animation = `fall ${3 + Math.random() * 2}s ease-in forwards`;
        confetti.style.zIndex = 2000;
        document.body.appendChild(confetti);

        setTimeout(() => confetti.remove(), 5000);
    }
}

// ==========================================
// 10. RESET & NAVIGARE
// ==========================================

function resetGame() {
    stopTimer();
    gameState.pieces.forEach(piece => {
        piece.connected = false;
        piece.initialized = false; // vor primi poziții random din nou în drawBoard
    });

    drawBoard();
    document.getElementById('stat-connected').textContent = '0';
    startTimer();
}

function backToMenu() {
    document.getElementById('screen-menu').style.display = 'block';
    document.getElementById('screen-game').style.display = 'none';
    document.getElementById('screen-win').style.display = 'none';
    gameState.pieces = [];
}

function playAgain() {
    startGame(gameState.difficulty);
}

function goBack() {
    stopTimer();
    document.body.classList.add('page-fade-out');
    setTimeout(() => { window.location.href = "2222.html"; }, 600);
}

// ==========================================
// HELPER FUNCTION
// ==========================================

function getPieceFromElement(elem) {
    const id = parseInt(elem.dataset.pieceId || elem.id.replace('piece-', ''));
    return gameState.pieces.find(p => p.id === id);
}
