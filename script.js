// ==========================================
// 0. CONFIGURARE SUPABASE
// ==========================================
// Datele tale din dashboard-ul Supabase
const SUPABASE_URL = 'https://nzkihyaifxkfccwgiilp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_5oxupUfCOgvdMAe0guBQWQ_XKfwq6dL';

// Inițializare client Supabase (folosim _supabase pentru a evita conflicte)
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Variabilă globală pentru a stoca pozele descărcate pentru navigarea în galerie
let allPhotosData = [];
let currentPhotoIndex = 0;

// Forțează reîncărcarea paginii atunci când este readusă din istoricul browserului
// (de exemplu, când faci swipe înapoi sau folosești butonul „Back” pe telefon).
window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        window.location.reload();
    }
});

// ==========================================
// 0.1 SERVICE WORKER – ACTUALIZARE AUTOMATĂ
// ==========================================
// Fiecare pagină încarcă script.js, deci fiecare pagină verifică dacă
// pe Netlify a apărut o versiune nouă. Când apare, service worker-ul nou
// preia controlul imediat și pagina se reîncarcă o singură dată.
// Nu mai e nevoie să ștergi datele site-ului.

(function () {
    if (!('serviceWorker' in navigator)) return;

    // Dacă exista deja un service worker la încărcarea paginii, ce vezi acum
    // poate veni din cache. Când versiunea nouă preia controlul, reîncărcăm.
    const aveaControler = !!navigator.serviceWorker.controller;
    let seReincarca = false;

    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!aveaControler || seReincarca) return;
        seReincarca = true;
        window.location.reload();
    });

    // Amprenta paginii de pe server. Se schimbă la fiecare publicare.
    // Verificăm pagina în sine, nu service worker-ul: dacă schimbi doar CSS-ul
    // sau HTML-ul, fișierul service worker-ului rămâne identic și browserul
    // nu ar observa nimic.
    let amprentaCurenta = null;

    function citesteAmprenta() {
        return fetch(window.location.pathname, { method: 'HEAD', cache: 'no-store' })
            .then((r) => r.headers.get('etag') || r.headers.get('last-modified'))
            .catch(() => null);
    }

    function verificaVersiuneNoua() {
        if (seReincarca || !amprentaCurenta) return;
        citesteAmprenta().then((amprenta) => {
            if (!amprenta || amprenta === amprentaCurenta || seReincarca) return;
            seReincarca = true;
            window.location.reload();
        });
    }

    window.addEventListener('load', () => {
        citesteAmprenta().then((amprenta) => { amprentaCurenta = amprenta; });

        navigator.serviceWorker
            // updateViaCache: 'none' => scriptul service worker-ului nu e luat
            // niciodată din cache-ul HTTP, deci versiunea nouă e văzută imediat.
            .register('/service-worker.js', { scope: '/', updateViaCache: 'none' })
            .then((reg) => {
                reg.update();
                navigator.serviceWorker.ready.then((r) => {
                    if (r.active) r.active.postMessage('start-keep-alive');
                });
            })
            .catch((err) => console.warn('Service worker:', err));
    });

    // Când revii în aplicație după ce a stat în fundal, verificăm dacă între timp
    // ai publicat ceva. Dacă da, pagina se reîncarcă singură.
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        navigator.serviceWorker.getRegistration().then((reg) => { if (reg) reg.update(); }).catch(() => {});
        verificaVersiuneNoua();
    });
})();

// ==========================================
// 1. LOGICA PENTRU LOGIN & LOGOUT
// ==========================================

async function valideazaLogin() {
    const user = document.getElementById('username').value.trim();
    const pass = document.getElementById('password').value;
    const error = document.getElementById('error-message');
    const container = document.querySelector('.login-container');

    if (!user || !pass) {
        if (error) {
            error.textContent = "Completează numele și codul secret.";
            error.style.display = 'block';
        }
        container.classList.add('shake-effect');
        setTimeout(() => { container.classList.remove('shake-effect'); }, 400);
        return;
    }

    try {
        // Verificăm în Supabase dacă există un utilizator cu acest nume și cod
        const { data, error: dbError } = await _supabase
            .from('LoginUsers')
            .select('id, name')
            .eq('name', user.toLowerCase())
            .eq('passcode', pass)
            .maybeSingle();

        if (dbError) {
            console.error('Eroare la verificarea login-ului:', dbError.message);
            if (error) {
                error.textContent = "Nu mă pot conecta la server acum. Încearcă mai târziu.";
                error.style.display = 'block';
            }
            return;
        }

        if (!data) {
            if (error) {
                error.textContent = "Ceva nu e bine... mai încearcă.";
                error.style.display = 'block';
            }
            container.classList.add('shake-effect');
            setTimeout(() => { container.classList.remove('shake-effect'); }, 400);
            return;
        }

        // Login valid -> marcăm sesiunea local (id + nume) și intrăm în univers
        localStorage.setItem('berea_auth_ok', '1');
        if (data.id) {
            localStorage.setItem('berea_user_id', String(data.id));
        }
        if (data.name) {
            localStorage.setItem('berea_username', data.name);
        }

        if (error) error.style.display = 'none';
        container.classList.add('container-exit');
        
        setTimeout(() => {
            document.body.classList.add('page-fade-out');
        }, 200);

        setTimeout(() => {
            window.location.href = "2222.html";
        }, 1000);
    } catch (err) {
        console.error('Eroare neașteptată la login:', err);
        if (error) {
            error.textContent = "A apărut o eroare neașteptată. Mai încearcă o dată.";
            error.style.display = 'block';
        }
    }
}

function logout() {
    localStorage.removeItem('berea_auth_ok');
    localStorage.removeItem('berea_user_id');
    localStorage.removeItem('berea_username');
    document.body.classList.add('page-fade-out');
    setTimeout(() => { window.location.href = "index.html"; }, 800);
}

function navigateTo(page) {
    document.body.classList.add('page-fade-out');
    setTimeout(() => { window.location.href = page; }, 600);
}

// Helper: detalii utilizator logat (dacă există)
function getLoggedInUser() {
    const idStr = localStorage.getItem('berea_user_id');
    const name = localStorage.getItem('berea_username');
    if (!idStr || !name) return null;
    const id = parseInt(idStr, 10);
    if (!id || Number.isNaN(id)) return null;
    return { id, name };
}

// ==========================================
// 1.1 ANIVERSAREA – „Un an împreună"
// ==========================================

// Momentul exact de la care numărăm: 11 iulie 2025, 00:44, ora locală.
// Atenție: new Date("2025-07-11") ar însemna miezul nopții UTC, adică 03:00 la noi.
// Forma cu argumente separate e singura care spune ce vrem.
const DATA_RELATIEI = new Date(2025, 6, 11, 0, 44, 0);

// Câți ani împliniți avem la momentul dat
function aniImpreuna(acum) {
    acum = acum || new Date();
    let ani = acum.getFullYear() - DATA_RELATIEI.getFullYear();
    const aniversareaAnului = new Date(
        acum.getFullYear(), DATA_RELATIEI.getMonth(), DATA_RELATIEI.getDate(),
        DATA_RELATIEI.getHours(), DATA_RELATIEI.getMinutes(), 0
    );
    if (acum < aniversareaAnului) ani--;
    return Math.max(0, ani);
}

// „Un an împreună”, „Doi ani împreună”, ..., „20 de ani împreună”
function numeAniversare(acum) {
    const ani = Math.max(1, aniImpreuna(acum));

    const cuvinte = ['', 'Un', 'Doi', 'Trei', 'Patru', 'Cinci', 'Șase', 'Șapte', 'Opt', 'Nouă', 'Zece',
                     'Unsprezece', 'Doisprezece', 'Treisprezece', 'Paisprezece', 'Cincisprezece',
                     'Șaisprezece', 'Șaptesprezece', 'Optsprezece', 'Nouăsprezece'];

    if (ani < cuvinte.length) {
        return cuvinte[ani] + (ani === 1 ? ' an' : ' ani') + ' împreună';
    }
    // De la 20 în sus, româna cere „de”: 20 de ani, 21 de ani...
    return ani + ' de ani împreună';
}

// Georgiana vede drumul abia de la prima aniversare, la prânz. După aceea, permanent.
const DEZVALUIRE_DRUM = new Date(
    DATA_RELATIEI.getFullYear() + 1,
    DATA_RELATIEI.getMonth(),
    DATA_RELATIEI.getDate(),
    12, 0, 0
);

function poateVedeaDrumul() {
    const user = getLoggedInUser();
    if (user && user.name === 'andrei') return true;
    return new Date() >= DEZVALUIRE_DRUM;
}

// ==========================================
// 1.2 MESAJ ANIVERSAR SPECIAL – „Un an împreună" (11 iulie 2026)
// ==========================================
// Reguli (toate calculate după ORA ROMÂNIEI – Europe/Bucharest):
//  • Georgiana: mesajul apare pe ecranul principal DOAR pe 11 iulie 2026,
//    începând cu ora 00:44, la FIECARE logare din acea zi.
//  • Andrei: apare la fiecare logare pe 10 iulie (test) și 11 iulie, la orice oră.
//  • După 11 iulie, mesajul nu mai apare automat, ci se mută în arhiva de
//    mesaje (📜), de unde poate fi accesat oricând.

// Citește data/ora curentă în fusul orar al României, indiferent de setarea telefonului.
function getRomaniaParts(date) {
    date = date || new Date();
    try {
        const fmt = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Europe/Bucharest',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        });
        const o = {};
        fmt.formatToParts(date).forEach((p) => { if (p.type !== 'literal') o[p.type] = p.value; });
        let h = parseInt(o.hour, 10);
        if (h === 24) h = 0; // unele motoare dau „24" la miezul nopții
        return {
            year: parseInt(o.year, 10), month: parseInt(o.month, 10), day: parseInt(o.day, 10),
            hour: h, minute: parseInt(o.minute, 10), second: parseInt(o.second, 10)
        };
    } catch (e) {
        // Dacă Intl/timezone nu e disponibil, cădem pe ora locală (telefonul e pe ora României).
        return {
            year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(),
            hour: date.getHours(), minute: date.getMinutes(), second: date.getSeconds()
        };
    }
}

const ANIV_YMD_TEST = 20260710; // 10 iulie 2026 – test (doar Andrei)
const ANIV_YMD_ZI   = 20260711; // 11 iulie 2026 – ziua cea mare
const ANIV_MIN_START = 44;      // 00:44, ora României

function _anivChei() {
    const p = getRomaniaParts();
    return { ymd: p.year * 10000 + p.month * 100 + p.day, minute: p.hour * 60 + p.minute };
}

// Trebuie afișat popup-ul acum, pentru utilizatorul logat?
function trebuieMesajAniversarPopup() {
    const user = getLoggedInUser();
    if (!user) return false;
    const { ymd, minute } = _anivChei();

    if (user.name === 'andrei') {
        // Andrei îl vede la fiecare logare pe 10 (test) și pe 11 iulie, la orice oră.
        return ymd === ANIV_YMD_TEST || ymd === ANIV_YMD_ZI;
    }
    if (user.name === 'georgiana') {
        // Georgiana îl vede doar pe 11 iulie, de la 00:44, la fiecare logare din acea zi.
        return ymd === ANIV_YMD_ZI && minute >= ANIV_MIN_START;
    }
    return false;
}

// După 11 iulie mesajul e accesibil permanent din arhiva de mesaje.
function mesajAniversarDisponibilInArhiva() {
    return _anivChei().ymd > ANIV_YMD_ZI;
}

// Construiește „zidul de te iubesc" cu mesajul ascuns: EȘTI CEA MAI FRUMOASĂ.
function _anivZidIubire() {
    const runs = [19, 34, 28, 20, 16];
    const markeri = ['EȘTI', 'CEA', 'MAI', 'FRUMOASĂ'];
    const bucati = [];
    let primul = true;
    for (let r = 0; r < runs.length; r++) {
        for (let i = 0; i < runs[r]; i++) {
            bucati.push('<span class="aniversar-love-word">' + (primul ? 'Te iubesc' : 'te iubesc') + '</span>');
            primul = false;
        }
        if (r < markeri.length) {
            bucati.push('<span class="aniversar-highlight">' + markeri[r] + '</span>');
        }
    }
    return bucati.join(', ') + '.';
}

// Conținutul complet al mesajului (din „mesaj special.docx").
function construitMesajAniversarInner() {
    return `
        <div class="aniversar-emoji">🍺🍓</div>
        <span class="aniversar-badge">Un an împreună · 11 iulie</span>
        <h1 class="aniversar-title">La mulți ani nouă</h1>
        <p class="aniversar-sub">💖 pentru Georgiana, de la Andrei 💖</p>
        <div class="aniversar-divider"></div>

        <p class="aniversar-p aniversar-lead">Uite, iubirea mea, că am ajuns la data mult așteptată de noi: 11 iulie. Astăzi, la această oră minunată (00:44, dacă o împărțim la 2, rezultatul este 00:22, ora perfectă), am făcut un an de când suntem împreună.</p>

        <p class="aniversar-p">Un an de când nu știai dacă suntem împreună sau nu, un an de când am mâncat cele mai bune paste posibile, un an de când cimitirul era locul care ne aducea mai aproape, un an de când am creat cele mai frumoase amintiri împreună, un an de când îți văd ochii albaștri mereu și mă pierd de fiecare dată în ei, un an de când diminețile și serile mele au un alt sens, un an de când fiecare îmbrățișare mă face să mă simt alt om, un an de când îți țin mâna și nu vreau să-i mai dau drumul, un an de când fiecare sărut mă face să mă îndrăgostesc din nou, un an de când mă faci să mă simt iubit, un an de când fiecare clipă petrecută cu tine este neprețuită, un an de când mă simt cel mai norocos om din lume. Un an de când mă faci să mă simt iubit în fiecare zi.</p>

        <p class="aniversar-p">Lista asta ar putea să continue, dar o să ne apuce celălalt 11 iulie și nici nu mă deranjează asta, pentru că aș putea să vorbesc despre noi ore întregi și tot aș simți că nu le-am spus pe toate. Fiecare moment petrecut alături de tine a devenit o amintire pe care o prețuiesc enorm.</p>

        <p class="aniversar-p">Îți mulțumesc că ai fost alături de mine mereu. Îți mulțumesc pentru fiecare amintire creată împreună, îți mulțumesc pentru fiecare plimbare, îți mulțumesc pentru fiecare ținut de mână, îți mulțumesc pentru fiecare îmbrățișare, îți mulțumesc pentru fiecare sărut și îți mulțumesc pentru fiecare „te iubesc". 😊 Îți mulțumesc și pentru fiecare întrebare-capcană. 😊</p>

        <p class="aniversar-nick">La mulți ani nouă, iubirea mea, dragostea mea, frumoasa mea, puișorul meu, gălușca mea, iubirica mea, mâncătoarea, anihilatoarea și distrugătoarea mea de sushi.</p>

        <p class="aniversar-p">Să continuăm amândoi acest drum până la adânci bătrâneți și copiii noștri să fie fericiți și la fel ca noi: mâncători de ovăz și anihilatori de sushi. Acest an este abia începutul acestei vieți lungi pe care o vom avea împreună (lungă fiindcă o să mâncăm foarte mult ovăz și, bineînțeles, pentru că ne iubim foarte mult).</p>

        <div class="aniversar-divider"></div>
        <div class="aniversar-love-wall">${_anivZidIubire()}</div>

        <button type="button" class="aniversar-close">Închide💛</button>
    `;
}

let _anivParticleTimer = null;

function _anivPornesteParticule() {
    const strat = document.getElementById('aniversar-particles');
    if (!strat) return;
    const simboluri = ['❤️', '💖', '💗', '✨', '🍓', '💛', '🌸', '⭐'];
    function creeaza(n) {
        for (let i = 0; i < n; i++) {
            const el = document.createElement('span');
            el.className = 'aniversar-particle';
            el.textContent = simboluri[Math.floor(Math.random() * simboluri.length)];
            el.style.left = (Math.random() * 100) + 'vw';
            el.style.fontSize = (16 + Math.random() * 20) + 'px';
            const dur = 5 + Math.random() * 5;
            el.style.animationDuration = dur + 's';
            strat.appendChild(el);
            setTimeout(() => { if (el.parentNode) el.remove(); }, dur * 1000 + 300);
        }
    }
    creeaza(14); // salvă inițială de inimioare
    _anivParticleTimer = setInterval(() => creeaza(2), 650);
}

function afiseazaMesajAniversar() {
    if (document.getElementById('aniversar-overlay')) return; // deja deschis

    const overlay = document.createElement('div');
    overlay.id = 'aniversar-overlay';
    overlay.className = 'aniversar-overlay';
    overlay.innerHTML =
        '<div class="aniversar-particles" id="aniversar-particles"></div>' +
        construitPlicHTML();

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    _anivPornesteParticule();
    _anivConfigPlic(overlay);
}

// Marea scrisoare care apare întâi. Se deschide după 3 apăsări.
function construitPlicHTML() {
    return `
        <div class="letter-stage" id="letter-stage">
            <div class="letter-envelope" id="letter-envelope" role="button" tabindex="0" aria-label="Deschide scrisoarea">
                <div class="env-glow"></div>
                <div class="env-letter">
                    <span class="env-letter-heart">💌</span>
                    <span class="env-letter-date">11 iulie</span>
                </div>
                <div class="env-front"></div>
                <div class="env-flap"></div>
                <div class="env-seal">🍺🍓</div>
            </div>
            <div class="letter-dots"><span></span><span></span><span></span></div>
        </div>
    `;
}

function _anivConfigPlic(overlay) {
    const env = overlay.querySelector('#letter-envelope');
    const dots = overlay.querySelectorAll('.letter-dots span');
    if (!env) return;

    let taps = 0;
    let deschis = false;

    function laApasare() {
        if (deschis) return;
        taps++;

        // feedback vizual: tremur + inimioare care sar din plic
        env.classList.remove('env-wiggle');
        void env.offsetWidth; // reporneste animatia
        env.classList.add('env-wiggle');
        _anivBurstInimi(7);

        if (dots[taps - 1]) dots[taps - 1].classList.add('on');

        if (taps >= 3) {
            deschis = true;
            deschidePlic(overlay);
        }
    }

    env.addEventListener('click', laApasare);
    env.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); laApasare(); }
    });
}

function deschidePlic(overlay) {
    const stage = overlay.querySelector('#letter-stage');
    const env = overlay.querySelector('#letter-envelope');

    // Deschiderea propriu-zisă (sigiliul se rupe, clapa se ridică, scrisoarea iese)
    env.classList.add('env-open');
    _anivBurstInimi(30);
    setTimeout(() => _anivBurstInimi(24), 450);

    // Scrisoarea a ieșit -> topim plicul și construim mesajul (element nou = animație sigură)
    setTimeout(() => { if (stage) stage.classList.add('letter-stage-out'); }, 1350);
    setTimeout(() => {
        if (stage) stage.style.display = 'none';
        const card = document.createElement('div');
        card.className = 'aniversar-card';
        card.innerHTML = '<div class="aniversar-inner">' + construitMesajAniversarInner() + '</div>';
        overlay.appendChild(card);
        const btn = card.querySelector('.aniversar-close');
        if (btn) btn.addEventListener('click', inchideMesajAniversar);
        _anivBurstInimi(18);
    }, 1800);
}

// Explozie de inimioare/confetti din centrul ecranului (spectaculos).
function _anivBurstInimi(n) {
    const overlay = document.getElementById('aniversar-overlay');
    if (!overlay) return;
    const simboluri = ['❤️', '💖', '💗', '✨', '🎉', '💛', '🌸', '⭐', '🍓', '💞'];
    for (let i = 0; i < n; i++) {
        const el = document.createElement('span');
        el.className = 'aniv-burst';
        el.textContent = simboluri[Math.floor(Math.random() * simboluri.length)];
        const unghi = Math.random() * Math.PI * 2;
        const dist = 70 + Math.random() * 200;
        el.style.setProperty('--dx', (Math.cos(unghi) * dist) + 'px');
        el.style.setProperty('--dy', (Math.sin(unghi) * dist) + 'px');
        el.style.fontSize = (16 + Math.random() * 20) + 'px';
        el.style.animationDuration = (0.8 + Math.random() * 0.7) + 's';
        overlay.appendChild(el);
        setTimeout(() => { if (el.parentNode) el.remove(); }, 1600);
    }
}

function inchideMesajAniversar() {
    const overlay = document.getElementById('aniversar-overlay');
    if (!overlay) return;
    if (_anivParticleTimer) { clearInterval(_anivParticleTimer); _anivParticleTimer = null; }
    document.body.style.overflow = '';
    overlay.classList.add('aniversar-closing');
    setTimeout(() => { if (overlay.parentNode) overlay.remove(); }, 500);
}

// Helper: înregistrează o victorie în LoginUsers (bulls / hangman / memory / macao / razboi / triangles / balloon / puzzle)
async function recordWin(game) {
    const user = getLoggedInUser();
    if (!user) return; // dacă nu e login real, nu facem nimic

    let column = null;
    if (game === 'bulls') column = 'wins_bulls_cows';
    else if (game === 'hangman') column = 'wins_hangman';
    else if (game === 'memory') column = 'wins_memory';
    else if (game === 'macao') column = 'wins_macao';
    else if (game === 'razboi') column = 'wins_razboi';
    else if (game === 'triangles') column = 'wins_triangles';
    else if (game === 'balloon') column = 'wins_balloon';
    else if (game === 'puzzle') column = 'wins_puzzle';
    if (!column) return;

    try {
        const { data, error } = await _supabase
            .from('LoginUsers')
            .select(column)
            .eq('id', user.id)
            .maybeSingle();

        if (error) {
            console.error('Eroare la citirea victoriilor:', error.message || error);
            return;
        }

        if (!data) return;

        const current = Number.isFinite(data[column]) ? data[column] : 0;
        const nextValue = current + 1;

        const { error: updateError } = await _supabase
            .from('LoginUsers')
            .update({ [column]: nextValue })
            .eq('id', user.id);

        if (updateError) {
            console.error('Eroare la actualizarea victoriilor:', updateError.message || updateError);
        }
    } catch (e) {
        console.error('Nu am putut actualiza victoriile:', e);
    }
}

// Helper: adăugaă un număr variabil de puncte la o coloană (ex: puzzle cu dificultati diferite)
async function recordPoints(game, points) {
    const user = getLoggedInUser();
    if (!user || !points || points <= 0) return;

    let column = null;
    if (game === 'balloon') column = 'wins_balloon';
    else if (game === 'puzzle') column = 'wins_puzzle';
    else if (game === 'bulls') column = 'wins_bulls_cows';
    else if (game === 'hangman') column = 'wins_hangman';
    else if (game === 'memory') column = 'wins_memory';
    else if (game === 'macao') column = 'wins_macao';
    else if (game === 'razboi') column = 'wins_razboi';
    else if (game === 'triangles') column = 'wins_triangles';
    if (!column) return;

    try {
        const { data, error } = await _supabase
            .from('LoginUsers')
            .select(column)
            .eq('id', user.id)
            .maybeSingle();

        if (error || !data) return;

        const current = Number.isFinite(data[column]) ? data[column] : 0;

        const { error: updateError } = await _supabase
            .from('LoginUsers')
            .update({ [column]: current + points })
            .eq('id', user.id);

        if (updateError) {
            console.error('Eroare la actualizarea punctelor:', updateError.message || updateError);
        }
    } catch (e) {
        console.error('Nu am putut actualiza punctele:', e);
    }
}

// Protejăm pagina principală (2222.html) astfel încât să fie accesibilă doar după login reușit
document.addEventListener('DOMContentLoaded', () => {
    const body = document.body;
    if (!body) return;

    // Dacă ne întoarcem pe pagină din istoric (back/swipe), ne asigurăm că nu rămâne blocat fade-out-ul.
    body.classList.remove('page-fade-out');

    const page = body.dataset.page;

    // Protecție pentru univers (2222.html) – nu intri fără login
    if (page === 'universe') {
        const isLoggedIn = localStorage.getItem('berea_auth_ok') === '1';
        if (!isLoggedIn) {
            window.location.href = 'index.html';
            return;
        }
        // Countdown-ul pentru următoarea întâlnire se inițiază din next-meeting.js

        // Mesajul aniversar special (11 iulie) – apare peste ecranul principal
        // după login, conform regulilor din secțiunea 1.2. Un mic delay ca
        // animația de intrare a paginii să se așeze întâi.
        if (trebuieMesajAniversarPopup()) {
            setTimeout(afiseazaMesajAniversar, 600);
        }
    }

    // "Soft back" pentru paginile secundare (puzzle, timeline, jocuri, etc.)
    // Ideea: adăugăm un entry dummy în history; când utilizatorul apasă înapoi
    // (sau face swipe pe iPhone), prindem evenimentul și îl trimitem înapoi la univers.
    const isLoginPage = !page && document.querySelector('.login-container');
    const isUniversePage = page === 'universe';

    if (!isLoginPage && !isUniversePage && window.history && typeof window.history.pushState === 'function') {
        const path = window.location.pathname || '';
        const backTarget = path.includes('/client/') ? '../2222.html' : '2222.html';

        try {
            const state = { softBack: true, target: backTarget };
            // înlocuim state-ul curent și mai adăugăm unul dummy, astfel încât primul "back"
            // (sau swipe înapoi pe telefon) să declanșeze popstate pe această pagină,
            // iar noi să redirecționăm direct către pagina principală.
            window.history.replaceState(state, '');
            window.history.pushState({ ...state, dummy: true }, '');

            const handlePop = () => {
                window.removeEventListener('popstate', handlePop);
                window.location.href = backTarget;
            };

            window.addEventListener('popstate', handlePop);
        } catch (err) {
            console.warn('Nu am putut configura soft-back:', err);
        }
    }
});

// Funcția veche a fost înlocuită cu versiunea nouă din next-meeting.js
// care include countdown live cu zile, ore, minute, secunde

// ==========================================
// 2. ANIMAȚIA CU ELEMENTE CARE CAD
// ==========================================

function createFallingElement() {
    const element = document.createElement('div');
    element.className = 'falling-element';
    const items = ['❤️', '💖', '🍺', '🍓', '✨'];
    element.innerHTML = items[Math.floor(Math.random() * items.length)];
    element.style.left = Math.random() * 100 + 'vw';
    const size = Math.random() * 20 + 20;
    element.style.fontSize = size + 'px';
    const duration = Math.random() * 3 + 4;
    element.style.animationDuration = duration + 's';
    document.body.appendChild(element);
    setTimeout(() => { element.remove(); }, duration * 1000);
}

const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
setInterval(createFallingElement, isMobileDevice ? 600 : 350);

// ==========================================
// 3. COUNTER RELAȚIE (PAGINA 2222)
// ==========================================

if (document.getElementById('counter')) {
    function updateCounter() {
        const acum = new Date();
        const diff = acum - DATA_RELATIEI;
        const zile = Math.floor(diff / (1000 * 60 * 60 * 24));
        const ore = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const min = Math.floor((diff / 1000 / 60) % 60);
        document.getElementById('counter').innerHTML = `${zile} zile, ${ore} ore, ${min} min`;
    }
    updateCounter();
    setInterval(updateCounter, 60000);
}

// ==========================================
// 4. GESTIONARE POZE SUPABASE (UPLOAD & DISPLAY)
// ==========================================

const photoInput = document.getElementById('photo-input');

if (photoInput) {
    photoInput.onchange = async function(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Comprimăm imaginea înainte de upload (pentru spațiu și viteză)
        let uploadBlob = file;
        let uploadName = file.name;

        try {
            const maxSize = 1000; // latura maximă în pixeli (mai mică pentru economie de spațiu)
            const quality = 0.5;  // calitate JPEG mai mică pentru fișiere mai mici
            const compressed = await compressImage(file, maxSize, quality);
            if (compressed) {
                uploadBlob = compressed;
                const baseName = file.name.replace(/\.[^.]+$/, '');
                uploadName = baseName + '-compressed.jpg';
            }
        } catch (err) {
            console.error('Nu am reușit să comprim poza, încarc originalul.', err);
        }

        // Creează un nume unic pentru fișier
        const fileName = `${Date.now()}-${uploadName}`;

        // 1. Încarcă fișierul în Storage Bucket 'amintiri'
        const { data: storageData, error: storageError } = await _supabase.storage
            .from('amintiri')
            .upload(fileName, uploadBlob, { contentType: 'image/jpeg' });

        if (storageError) {
            alert("Eroare la încărcare fișier: " + storageError.message);
            return;
        }

        // 2. Obține URL-ul public
        const { data: urlData } = _supabase.storage
            .from('amintiri')
            .getPublicUrl(fileName);
        
        const publicUrl = urlData.publicUrl;

        // 3. Inserează URL-ul în tabelul 'poze'
        const { error: dbError } = await _supabase
            .from('Poze')
            .insert([{ url: publicUrl }]);

        if (!dbError) {
            showPhoto(publicUrl); // Afișează poza în rama principală
            photoInput.value = ""; // Resetăm input-ul
        } else {
            alert("Eroare bază de date: " + dbError.message);
        }
    };
}

// Funcție helper pentru comprimarea imaginilor în browser folosind canvas
async function compressImage(file, maxSize, quality) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event) => {
            const img = new Image();

            img.onload = () => {
                let { width, height } = img;

                // Dacă imaginea este deja mică, nu o mai modificăm
                const longestSide = Math.max(width, height);
                if (longestSide <= maxSize) {
                    resolve(null);
                    return;
                }

                const scale = maxSize / longestSide;
                width = Math.round(width * scale);
                height = Math.round(height * scale);

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');

                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        if (blob) resolve(blob);
                        else resolve(null);
                    },
                    'image/jpeg',
                    quality
                );
            };

            img.onerror = (err) => reject(err);
            img.src = event.target.result;
        };

        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
    });
}

// Afișează o poză random din Cloud la intrarea pe site
async function loadRandomPhoto() {
    const { data, error } = await _supabase.from('Poze').select('url');
    
    if (data && data.length > 0) {
        const randomIndex = Math.floor(Math.random() * data.length);
        showPhoto(data[randomIndex].url);
    }
}

function showPhoto(src) {
    const displayImg = document.getElementById('random-photo');
    const noPhotoMsg = document.getElementById('no-photo-msg');
    const frame = document.getElementById('frame-container');

    if (displayImg) {
        // Un mic efect de fade-out înainte de schimbare
        displayImg.style.opacity = '0';
        
        setTimeout(() => {
            displayImg.src = src;
            displayImg.style.display = 'block';
            displayImg.style.opacity = '1'; // Revine la opacitate maximă
            
            if (noPhotoMsg) noPhotoMsg.style.display = 'none';

            frame.classList.add('glow');
            setTimeout(() => {
                frame.classList.remove('glow');
            }, 1500);
        }, 200); // 200 milisecunde de pauză pentru finețe
    }
}

// Apelăm poza random la încărcare dacă suntem pe pagina 2222
if (document.getElementById('random-photo')) {
    loadRandomPhoto();
}

// ==========================================
// 5. GALERIE & FULLSCREEN (SUPABASE VERSION)
// ==========================================

async function openGallery() {
    await renderGallery();
    document.getElementById('gallery-modal').style.display = 'block';
}

function closeGallery() {
    document.getElementById('gallery-modal').style.display = 'none';
}

async function renderGallery() {
    const grid = document.getElementById('gallery-grid');
    grid.innerHTML = '<p style="color:white; grid-column: 1/-1;">Se încarcă amintirile...</p>';

    // Preluăm pozele din tabelul 'Poze' (atenție la P mare)
    const { data, error } = await _supabase
        .from('Poze') 
        .select('id, url, created_at, photo_date')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Eroare la încărcarea galeriei:', error.message);
        grid.innerHTML = '<p style="color:white; grid-column: 1/-1;">Nu am putut încărca amintirile. 😔</p>';
        return;
    }

    if (!data || data.length === 0) {
        grid.innerHTML = '<p style="color:white; grid-column: 1/-1;">Nicio amintire încă. ❤️</p>';
        allPhotosData = [];
        return;
    }

    // Sortăm pozele cronologic descendent în funcție de data reală (photo_date sau created_at)
    const itemsWithDate = data
        .map((item) => {
            const rawDate = item.photo_date || item.created_at;
            const d = rawDate ? new Date(rawDate) : null;
            const time = d && !isNaN(d.getTime()) ? d.getTime() : 0; // 0 => cele fără dată ajung la final
            return { item, time };
        })
        .sort((a, b) => b.time - a.time);

    // Salvăm toate pozele pentru fullscreen, în aceeași ordine cronologică
    allPhotosData = itemsWithDate.map((wrap) => wrap.item);
    grid.innerHTML = '';

    const monthNames = [
        'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
        'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'
    ];

    // Grupăm pozele pe lună/an (folosind photo_date dacă există, altfel created_at)
    const groupsMap = new Map(); // cheie: "YYYY-MM", valoare: { label, items: [] }

    itemsWithDate.forEach((wrap, index) => {
        const item = wrap.item;
        const rawDate = item.photo_date || item.created_at;
        let key = 'unknown';
        let label = 'Fără dată';

        if (rawDate) {
            const d = new Date(rawDate);
            if (!isNaN(d.getTime())) {
                const year = d.getFullYear();
                const month = d.getMonth(); // 0-11
                key = `${year}-${String(month + 1).padStart(2, '0')}`;
                label = `${monthNames[month]} ${year}`;
            }
        }

        if (!groupsMap.has(key)) {
            groupsMap.set(key, { label, items: [] });
        }

        const group = groupsMap.get(key);

        const div = document.createElement('div');
        div.className = 'gallery-item';
        div.innerHTML = `
            <img src="${item.url}" onclick="openFullscreen(${index})">
            <button class="btn-delete" onclick="deletePhoto(${item.id}, '${item.url}')">🗑️</button>
        `;

        group.items.push(div);
    });

    // Redăm grupurile în ordinea în care apar (deja sortate descendent după data efectivă)
    groupsMap.forEach((group) => {
        const section = document.createElement('div');
        section.className = 'gallery-month-block';

        const header = document.createElement('div');
        header.className = 'gallery-month-header';
        header.textContent = group.label;

        const monthGrid = document.createElement('div');
        monthGrid.className = 'gallery-month-grid';
        group.items.forEach((elem) => monthGrid.appendChild(elem));

        section.appendChild(header);
        section.appendChild(monthGrid);
        grid.appendChild(section);
    });
}

async function deletePhoto(id, url) {
    if(confirm("Sigur vrei să ștergi această amintire de peste tot? 🗑️")) {
        try {
            // Calea relativă exactă
            const filePath = url.split('/object/public/amintiri/')[1];
            if(!filePath) {
                alert("Nu s-a putut determina calea fișierului!");
                return;
            }

            // Ștergere fișier din Storage
            const { error: storageError } = await _supabase.storage
                .from('amintiri')
                .remove([filePath]);

            if (storageError) {
                console.error("Eroare stergere fisier:", storageError.message);
                alert("Nu s-a putut șterge fișierul din Storage: " + storageError.message);
                return;
            }

            // Ștergere din baza de date
            const { error: dbError } = await _supabase
                .from('Poze')
                .delete()
                .eq('id', id);

            if (!dbError) {
                renderGallery();
                loadRandomPhoto(); 
            } else {
                alert("Eroare la ștergerea din baza de date: " + dbError.message);
            }

        } catch (err) {
            console.error("Eroare neprevăzută:", err);
        }
    }
}



function openFullscreen(index) {
    currentPhotoIndex = index;
    if (allPhotosData.length > 0) {
        document.getElementById('img-viewer').src = allPhotosData[index].url;
        updateFullscreenMeta();
        document.getElementById('fullscreen-modal').style.display = 'flex';
    }
}

function closeFullscreen() {
    document.getElementById('fullscreen-modal').style.display = 'none';
    const meta = document.querySelector('.fullscreen-meta');
    if (meta) meta.classList.remove('visible');
}

function changeFullscreenPhoto(direction) {
    if (allPhotosData.length === 0) return;
    
    currentPhotoIndex += direction;

    if (currentPhotoIndex >= allPhotosData.length) currentPhotoIndex = 0;
    if (currentPhotoIndex < 0) currentPhotoIndex = allPhotosData.length - 1;

    document.getElementById('img-viewer').src = allPhotosData[currentPhotoIndex].url;
    updateFullscreenMeta();
}

function togglePhotoMeta() {
    const meta = document.querySelector('.fullscreen-meta');
    if (!meta) return;
    meta.classList.toggle('visible');
}

function updateFullscreenMeta() {
    const label = document.getElementById('photo-date-label');
    const daySelect = document.getElementById('photo-day-select');
    const monthSelect = document.getElementById('photo-month-select');
    const yearSelect = document.getElementById('photo-year-select');
    if (!label || !daySelect || !monthSelect || !yearSelect) return;

    const item = allPhotosData[currentPhotoIndex];
    if (!item) {
        label.textContent = '';
        return;
    }

    const monthNames = [
        'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
        'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'
    ];

    const rawDate = item.photo_date || item.created_at;
    let d = rawDate ? new Date(rawDate) : null;
    if (!d || isNaN(d.getTime())) {
        d = new Date();
    }

    const year = d.getFullYear();
    const month = d.getMonth();
    const day = d.getDate();

    label.textContent = `${day} ${monthNames[month]} ${year}`;

    // Populăm opțiunile pentru zi (1-31)
    if (!daySelect.dataset.initialized) {
        daySelect.innerHTML = '';
        for (let dDay = 1; dDay <= 31; dDay++) {
            const opt = document.createElement('option');
            opt.value = String(dDay).padStart(2, '0');
            opt.textContent = String(dDay);
            daySelect.appendChild(opt);
        }
        daySelect.dataset.initialized = 'true';
    }

    // Populăm opțiunile pentru lună (1-12)
    if (!monthSelect.dataset.initialized) {
        monthSelect.innerHTML = '';
        monthNames.forEach((name, idx) => {
            const opt = document.createElement('option');
            opt.value = String(idx + 1).padStart(2, '0');
            opt.textContent = name;
            monthSelect.appendChild(opt);
        });
        monthSelect.dataset.initialized = 'true';
    }

    // Populăm opțiunile pentru ani (de ex. 2015 - anul curent+1)
    if (!yearSelect.dataset.initialized) {
        yearSelect.innerHTML = '';
        const currentYear = new Date().getFullYear();
        for (let y = currentYear + 1; y >= 2015; y--) {
            const opt = document.createElement('option');
            opt.value = String(y);
            opt.textContent = String(y);
            yearSelect.appendChild(opt);
        }
        yearSelect.dataset.initialized = 'true';
    }

    daySelect.value = String(day).padStart(2, '0');
    monthSelect.value = String(month + 1).padStart(2, '0');
    yearSelect.value = String(year);
}

async function savePhotoDate() {
    if (!allPhotosData || allPhotosData.length === 0) return;

    const item = allPhotosData[currentPhotoIndex];
    if (!item || !item.id) return;

    const daySelect = document.getElementById('photo-day-select');
    const monthSelect = document.getElementById('photo-month-select');
    const yearSelect = document.getElementById('photo-year-select');
    if (!daySelect || !monthSelect || !yearSelect) return;

    const day = parseInt(daySelect.value, 10);
    const month = parseInt(monthSelect.value, 10);
    const year = parseInt(yearSelect.value, 10);
    if (!day || !month || !year) return;

    // Validăm data folosind obiectul Date (evită date invalide, ex: 31 februarie),
    // dar construim stringul manual ca să nu mai pierdem o zi din cauza fusului orar.
    const tmpDate = new Date(year, month - 1, day);
    if (
        tmpDate.getFullYear() !== year ||
        tmpDate.getMonth() !== month - 1 ||
        tmpDate.getDate() !== day
    ) {
        alert('Data aleasă nu este validă.');
        return;
    }

    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`; // YYYY-MM-DD

    const { data, error } = await _supabase
        .from('Poze')
        .update({ photo_date: dateStr })
        .eq('id', item.id)
        .select('id, url, created_at, photo_date')
        .single();

    if (error) {
        console.error('Eroare la salvarea datei pozei:', error.message);
        alert('Nu am putut salva data pentru această poză.\nDetalii: ' + error.message);
        return;
    }

    // Reîncarcăm galeria pentru a regenera gruparea pe luni
    await renderGallery();

    // Găsim noul index al pozei în allPhotosData (după reîncărcare)
    const newIndex = allPhotosData.findIndex((p) => p.id === data.id);
    if (newIndex !== -1) {
        currentPhotoIndex = newIndex;
        document.getElementById('img-viewer').src = data.url;
        updateFullscreenMeta();
    }

    alert('Data pozei a fost salvată. 💾');
}