// POP THE BALLOON – joc standalone
document.addEventListener('DOMContentLoaded', function () {
    startBalloonGame();
});

async function startBalloonGame() {
    const area = document.getElementById('balloons-area');
    const controls = document.getElementById('balloons-controls');
    const restartBtn = document.getElementById('balloons-restart');
    const scoreEl = document.getElementById('pop-score');
    const livesEl = document.getElementById('pop-lives');
    if (!area) return;

    area.innerHTML = '';
    if (controls) controls.style.display = 'none';
    if (scoreEl) scoreEl.textContent = '0';
    if (livesEl) livesEl.textContent = '❤️❤️❤️';

    if (restartBtn && !restartBtn.dataset.bound) {
        restartBtn.addEventListener('click', () => {
            startBalloonGame();
        });
        restartBtn.dataset.bound = '1';
    }

    if (typeof _supabase === 'undefined') {
        area.innerHTML = '<p style="color:white; font-size:0.9rem; text-align:center;">Nu pot încărca pozele acum. 😔</p>';
        return;
    }

    try {
        const { data, error } = await _supabase
            .from('Poze')
            .select('url')
            .limit(50);

        if (error) {
            console.error('Eroare la încărcarea pozelor pentru baloane:', error.message || error);
            area.innerHTML = '<p style="color:white; font-size:0.9rem; text-align:center;">Nu am putut încărca amintirile. 😔</p>';
            return;
        }

        if (!data || data.length === 0) {
            area.innerHTML = '<p style="color:white; font-size:0.9rem; text-align:center;">Nu avem încă poze pentru baloane. ❤️</p>';
            return;
        }

        // Eliminăm eventualele duplicate
        const uniqueData = [];
        const seen = new Set();
        data.forEach((row) => {
            if (!row || !row.url) return;
            const baseUrl = row.url.split('?')[0];
            if (!baseUrl) return;
            const fileName = baseUrl.split('/').pop();
            if (!fileName || seen.has(fileName)) return;
            seen.add(fileName);
            uniqueData.push(row);
        });

        if (!uniqueData.length) {
            area.innerHTML = '<p style="color:white; font-size:0.9rem; text-align:center;">Nu avem încă poze pentru baloane. ❤️</p>';
            return;
        }

        const minBatchSize = 1;
        const maxBatchSize = 7;
        const shuffled = [...uniqueData].sort(() => Math.random() - 0.5);
        const colors = ['#ff4d6d', '#ffb703', '#ff9ff3', '#6c5ce7', '#00b894', '#fd79a8', '#e17055'];

        let cursor = 0;
        let batchSize = minBatchSize;
        let waveNumber = 0;
        let totalPopped = 0;
        let totalMissed = 0;
        let activeBalloons = 0;
        let gameEnded = false;
        const maxMissed = 3;

        const updateUI = () => {
            if (scoreEl) scoreEl.textContent = totalPopped;
            if (livesEl) {
                const remaining = Math.max(0, maxMissed - totalMissed);
                livesEl.textContent = '❤️'.repeat(remaining) + '🖤'.repeat(maxMissed - remaining);
            }
        };

        const endGame = (message) => {
            gameEnded = true;
            area.querySelectorAll('.balloon').forEach(b => b.remove());
            activeBalloons = 0;
            if (controls) {
                controls.style.display = 'block';
                const messageEl = controls.querySelector('.support-message');
                if (messageEl && message) messageEl.textContent = message;
            }
        };

        const tryFinish = () => {
            if (gameEnded) return;
            if (totalMissed >= maxMissed) {
                endGame('Au scăpat 3 baloane nesparte. Jocul s-a terminat! Scor: ' + totalPopped + ' 🎈');
                return;
            }
            if (cursor >= shuffled.length && activeBalloons === 0) {
                // jocul terminat cu succes → 1 punct
                if (typeof recordWin === 'function') recordWin('balloon');
                endGame('Ai spart toate baloanele! Scor final: ' + totalPopped + ' 🎉❤️');
                return;
            }
        };

        const spawnBatch = () => {
            if (gameEnded) return;
            if (controls) controls.style.display = 'none';

            const effectiveBatchSize = Math.min(batchSize, maxBatchSize, shuffled.length - cursor);
            const start = cursor;
            const end = Math.min(cursor + effectiveBatchSize, shuffled.length);
            const batch = shuffled.slice(start, end);
            cursor = end;

            let remainingInBatch = batch.length;
            let nextBatchScheduled = false;

            if (remainingInBatch === 0) {
                tryFinish();
                return;
            }

            const scheduleNextBatch = (delayMs) => {
                if (nextBatchScheduled || gameEnded) return;
                if (cursor < shuffled.length) {
                    nextBatchScheduled = true;
                    batchSize = Math.min(maxBatchSize, batchSize + 1);
                    waveNumber += 1;
                    setTimeout(() => { spawnBatch(); }, delayMs);
                }
            };

            const areaWidth = area.clientWidth || 320;

            batch.forEach((row, index) => {
                const balloon = document.createElement('div');
                balloon.className = 'balloon';
                activeBalloons += 1;

                const balloonWidth = batch.length >= 5 ? 50 : (areaWidth < 380 ? 58 : 72);
                const balloonHeight = batch.length >= 5 ? 70 : (areaWidth < 380 ? 82 : 100);
                balloon.style.width = balloonWidth + 'px';
                balloon.style.height = balloonHeight + 'px';

                // poziționăm baloanele distanțate pe ecran
                let basePositions;
                if (batch.length === 1) basePositions = [50];
                else if (batch.length === 2) basePositions = [30, 70];
                else if (batch.length === 3) basePositions = [18, 50, 82];
                else if (batch.length === 4) basePositions = [12, 37, 63, 88];
                else if (batch.length === 5) basePositions = [10, 28, 50, 72, 90];
                else if (batch.length === 6) basePositions = [8, 24, 40, 58, 74, 92];
                else basePositions = [7, 21, 36, 50, 64, 79, 93];

                let leftPercent = basePositions[index] || 50;
                const jitter = (Math.random() - 0.5) * 4;
                leftPercent = Math.max(8, Math.min(92, leftPercent + jitter));

                const leftPx = (areaWidth * leftPercent / 100) - (balloonWidth / 2);
                const clampedLeft = Math.max(0, Math.min(areaWidth - balloonWidth, leftPx));
                balloon.style.left = Math.round(clampedLeft) + 'px';

                // culoare de bază diferită
                const color = colors[index % colors.length];
                balloon.style.background = `radial-gradient(circle at 30% 20%, rgba(255,255,255,0.85), ${color})`;

                // viteza crește progresiv cu fiecare val
                const baseDuration = 13 - batchSize * 2.2;
                const waveSpeedup = waveNumber * 1.2;
                const duration = Math.max(2.8, baseDuration - waveSpeedup + (Math.random() * 1.2 - 0.6));
                balloon.style.animationDuration = duration + 's';

                // stagger între baloane
                const stagger = batch.length >= 5 ? 0.5 : 0.8;
                const delay = index * stagger + Math.random() * 0.3;
                balloon.style.animationDelay = delay + 's';

                // programăm următorul val la jumătatea animației ultimului balon
                if (index === batch.length - 1) {
                    const halfwayMs = ((duration + delay) / 2) * 1000;
                    setTimeout(() => {
                        scheduleNextBatch(0);
                    }, halfwayMs);
                }

                const drift = -40 + Math.random() * 80;
                balloon.style.setProperty('--drift', drift + 'px');

                balloon.dataset.photoUrl = row.url;

                // preîncărcăm poza
                const preloadImg = new Image();
                preloadImg.src = row.url;

                // animația s-a terminat → balonul a scăpat
                balloon.addEventListener('animationend', () => {
                    if (gameEnded) { balloon.remove(); return; }
                    const wasMissed = balloon.dataset.popped !== '1';
                    if (wasMissed) {
                        remainingInBatch -= 1;
                        totalMissed += 1;
                        updateUI();
                    }
                    balloon.remove();
                    activeBalloons = Math.max(0, activeBalloons - 1);

                    tryFinish();
                    if (gameEnded) return;

                    if (remainingInBatch <= 0) {
                        scheduleNextBatch(1200);
                    }
                });

                // click/tap → sparge balonul
                balloon.addEventListener('click', () => {
                    if (balloon.classList.contains('popped')) return;

                    const url = balloon.dataset.photoUrl;
                    if (url) {
                        balloon.style.background = 'none';
                        balloon.style.backgroundImage = `url('${url}')`;
                        balloon.style.backgroundSize = 'cover';
                        balloon.style.backgroundPosition = 'center';
                    }
                    balloon.classList.add('popped');

                    balloon.dataset.popped = '1';
                    remainingInBatch -= 1;
                    totalPopped += 1;
                    updateUI();

                    if (remainingInBatch <= 0) {
                        scheduleNextBatch(2000);
                    }
                });

                area.appendChild(balloon);
            });
        };

        // pornim jocul
        updateUI();
        spawnBatch();
    } catch (err) {
        console.error('Eroare neașteptată la baloane:', err);
        area.innerHTML = '<p style="color:white; font-size:0.9rem; text-align:center;">Nu am putut încărca amintirile. 😔</p>';
    }
}
