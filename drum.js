// ==========================================
// DRUMUL NOSTRU – „Un an împreună" ♾️
// Opririle alternează stânga/dreapta, iar drumul
// serpuiește printre ele. Curba se recalculează
// din pozițiile reale ale cardurilor, deci se
// potrivește pe orice ecran.
// ==========================================

(function () {
    'use strict';

    // Aceeași dată ca în script.js, ca să nu existe două surse de adevăr
    var START_DATE = (typeof DATA_RELATIEI !== 'undefined') ? DATA_RELATIEI : new Date(2025, 6, 11);
    var MONTHS = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
                  'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];
    var NODE_ICONS = ['❤️', '💖', '💕', '🌸', '💗', '✨', '💘', '🌼'];
    var NODE_RADIUS = 20; // jumătate din nod + puțin aer
    var ROAD_HALF = 17;   // jumătate din lățimea drumului, cu tot cu bordură
    var MAX_PROPS = 95;

    // Ilustrațiile de pe marginea drumului, desenate în paleta caldă a site-ului.
    // Toate folosesc același viewBox 0 0 48 48 și au aceeași umbră la bază.
    var C = {
        crem: '#FFF3E2', cremUmbra: '#FFE3C6',
        rosu: '#E85D4F', rosuInchis: '#C0403A',
        teal: '#3F8A94', tealDeschis: '#7FC6CE', tealInchis: '#2E6E77',
        lemn: '#8C5A3B', trunchi: '#7A4F32',
        frunzeDeschis: '#4FA268', frunze: '#3E8E5A', frunzeInchis: '#2F6F45',
        gri: '#C9CBD2', griInchis: '#6B6F76',
        auriu: '#FFC24D', roz: '#FF7A9C',
        vin: '#8E3B52', piatra: '#8390A6', piatraDeschis: '#9AA6BA'
    };

    var UMBRA = '<ellipse cx="24" cy="43" rx="14" ry="2.2" fill="#000" opacity=".13"/>';

    // scale = mărimea relativă (clădirile sunt mai mari decât florile)
    // sway  = se leagănă în vânt (doar vegetația)
    var PROPS = {
        casa: { scale: 1.1, sway: false, svg: UMBRA + `
            <rect x="29.5" y="10" width="4" height="9" rx="1" fill="${C.rosuInchis}"/>
            <path d="M6 23 24 8l18 15z" fill="${C.rosu}"/>
            <path d="M24 8l18 15h-5.5L24 12.5z" fill="${C.rosuInchis}"/>
            <rect x="11" y="22" width="26" height="19" rx="2" fill="${C.crem}"/>
            <rect x="20.5" y="30" width="7" height="11" rx="1" fill="${C.lemn}"/>
            <rect x="14" y="26" width="5" height="5" rx="1.2" fill="${C.tealDeschis}"/>
            <rect x="29" y="26" width="5" height="5" rx="1.2" fill="${C.tealDeschis}"/>` },

        casa2: { scale: 1.1, sway: false, svg: UMBRA + `
            <path d="M6 24 22 10l16 14z" fill="${C.teal}"/>
            <path d="M22 10l16 14h-5L22 14z" fill="${C.tealInchis}"/>
            <rect x="10" y="23" width="24" height="18" rx="2" fill="${C.crem}"/>
            <rect x="19" y="31" width="6" height="10" rx="1" fill="${C.lemn}"/>
            <rect x="13" y="27" width="4.5" height="4.5" rx="1.2" fill="${C.auriu}"/>
            <rect x="27" y="27" width="4.5" height="4.5" rx="1.2" fill="${C.auriu}"/>
            <rect x="40" y="33" width="2" height="8" rx="1" fill="${C.trunchi}"/>
            <circle cx="41" cy="30" r="6" fill="${C.frunze}"/>` },

        insiruite: { scale: 1.15, sway: false, svg: UMBRA + `
            <rect x="6" y="21" width="12" height="20" rx="1.5" fill="${C.cremUmbra}"/>
            <path d="M4.5 22 12 14.5 19.5 22z" fill="${C.rosu}"/>
            <rect x="10" y="26" width="4" height="4" rx="1" fill="${C.tealDeschis}"/>
            <rect x="18" y="16" width="12" height="25" rx="1.5" fill="${C.crem}"/>
            <path d="M16.5 17 24 9.5 31.5 17z" fill="${C.teal}"/>
            <rect x="22" y="21" width="4" height="4" rx="1" fill="${C.auriu}"/>
            <rect x="21.5" y="31" width="5" height="10" rx="1" fill="${C.lemn}"/>
            <rect x="30" y="23" width="12" height="18" rx="1.5" fill="${C.cremUmbra}"/>
            <path d="M28.5 24 36 16.5 43.5 24z" fill="${C.auriu}"/>
            <rect x="34" y="28" width="4" height="4" rx="1" fill="${C.tealDeschis}"/>` },

        bloc: { scale: 1.25, sway: false, svg: UMBRA + `
            <rect x="12" y="7" width="24" height="34" rx="2" fill="${C.crem}"/>
            <rect x="12" y="7" width="24" height="4.5" rx="2" fill="${C.rosuInchis}"/>
            <rect x="16" y="15" width="5" height="5" rx="1" fill="${C.tealDeschis}"/>
            <rect x="27" y="15" width="5" height="5" rx="1" fill="${C.tealInchis}"/>
            <rect x="16" y="23" width="5" height="5" rx="1" fill="${C.tealInchis}"/>
            <rect x="27" y="23" width="5" height="5" rx="1" fill="${C.tealDeschis}"/>
            <rect x="16" y="31" width="5" height="5" rx="1" fill="${C.tealDeschis}"/>
            <rect x="25" y="33" width="7" height="8" rx="1" fill="${C.lemn}"/>` },

        turn: { scale: 1.3, sway: false, svg: UMBRA + `
            <rect x="23.4" y="1.5" width="1.2" height="5" fill="${C.griInchis}"/>
            <rect x="14" y="6" width="20" height="35" rx="2" fill="#EDF1F5"/>
            <rect x="14" y="6" width="20" height="3" rx="1.5" fill="${C.gri}"/>
            <rect x="16.5" y="11.5" width="3.6" height="3.6" rx=".8" fill="${C.tealInchis}"/>
            <rect x="22.2" y="11.5" width="3.6" height="3.6" rx=".8" fill="${C.tealDeschis}"/>
            <rect x="27.9" y="11.5" width="3.6" height="3.6" rx=".8" fill="${C.tealInchis}"/>
            <rect x="16.5" y="17" width="3.6" height="3.6" rx=".8" fill="${C.tealDeschis}"/>
            <rect x="22.2" y="17" width="3.6" height="3.6" rx=".8" fill="${C.tealInchis}"/>
            <rect x="27.9" y="17" width="3.6" height="3.6" rx=".8" fill="${C.tealDeschis}"/>
            <rect x="16.5" y="22.5" width="3.6" height="3.6" rx=".8" fill="${C.tealInchis}"/>
            <rect x="22.2" y="22.5" width="3.6" height="3.6" rx=".8" fill="${C.tealDeschis}"/>
            <rect x="27.9" y="22.5" width="3.6" height="3.6" rx=".8" fill="${C.tealInchis}"/>
            <rect x="16.5" y="28" width="3.6" height="3.6" rx=".8" fill="${C.tealDeschis}"/>
            <rect x="27.9" y="28" width="3.6" height="3.6" rx=".8" fill="${C.tealDeschis}"/>
            <rect x="20" y="35" width="8" height="6" rx="1" fill="${C.tealInchis}"/>` },

        magazin: { scale: 1.1, sway: false, svg: UMBRA + `
            <rect x="8" y="17" width="32" height="24" rx="2" fill="${C.crem}"/>
            <rect x="7" y="13" width="34" height="4" rx="2" fill="${C.rosuInchis}"/>
            <path d="M7 18h34v5H7z" fill="${C.rosu}"/>
            <path d="M12 18h5v5h-5zM22 18h5v5h-5zM32 18h5v5h-5z" fill="${C.crem}" opacity=".85"/>
            <rect x="11" y="27" width="11" height="8" rx="1" fill="${C.tealDeschis}"/>
            <rect x="26" y="27" width="9" height="14" rx="1" fill="${C.lemn}"/>` },

        cinema: { scale: 1.25, sway: false, svg: UMBRA + `
            <rect x="10" y="11" width="28" height="30" rx="2" fill="${C.vin}"/>
            <rect x="15" y="4" width="18" height="7" rx="1.5" fill="${C.roz}"/>
            <rect x="18" y="6.5" width="12" height="2" rx="1" fill="${C.crem}" opacity=".8"/>
            <rect x="7" y="16" width="34" height="8" rx="2" fill="${C.auriu}"/>
            <circle cx="12" cy="20" r="1.3" fill="${C.crem}"/>
            <circle cx="18" cy="20" r="1.3" fill="${C.crem}"/>
            <circle cx="24" cy="20" r="1.3" fill="${C.crem}"/>
            <circle cx="30" cy="20" r="1.3" fill="${C.crem}"/>
            <circle cx="36" cy="20" r="1.3" fill="${C.crem}"/>
            <rect x="14" y="28" width="8" height="13" rx="1" fill="#2A1E28"/>
            <rect x="26" y="28" width="8" height="13" rx="1" fill="#2A1E28"/>` },

        mall: { scale: 1.2, sway: false, svg: UMBRA + `
            <rect x="5" y="18" width="38" height="23" rx="2.5" fill="${C.crem}"/>
            <rect x="5" y="18" width="38" height="5" rx="2.5" fill="${C.teal}"/>
            <rect x="15" y="10" width="18" height="6" rx="1.5" fill="${C.roz}"/>
            <rect x="9" y="26" width="7" height="6" rx="1" fill="${C.tealDeschis}"/>
            <rect x="32" y="26" width="7" height="6" rx="1" fill="${C.tealDeschis}"/>
            <rect x="19" y="28" width="10" height="13" rx="1" fill="${C.tealInchis}"/>
            <rect x="23.4" y="28" width="1.2" height="13" fill="${C.crem}" opacity=".7"/>` },

        biserica: { scale: 1.2, sway: false, svg: UMBRA + `
            <rect x="6" y="25" width="22" height="16" rx="1.5" fill="${C.crem}"/>
            <path d="M4.5 26 17 17l12.5 9z" fill="${C.rosuInchis}"/>
            <rect x="29" y="17" width="12" height="24" rx="1.5" fill="${C.crem}"/>
            <path d="M27.5 18 35 9.5 42.5 18z" fill="${C.rosuInchis}"/>
            <rect x="34.2" y="3" width="1.6" height="7" fill="${C.auriu}"/>
            <rect x="32.5" y="5" width="5" height="1.6" fill="${C.auriu}"/>
            <rect x="33" y="23" width="4" height="6" rx="2" fill="${C.tealDeschis}"/>
            <rect x="14.5" y="31" width="5" height="10" rx="2.5" fill="${C.lemn}"/>` },

        scoala: { scale: 1.15, sway: false, svg: UMBRA + `
            <rect x="7" y="19" width="34" height="22" rx="2" fill="${C.cremUmbra}"/>
            <path d="M5.5 20 24 10l18.5 10z" fill="${C.rosuInchis}"/>
            <circle cx="24" cy="25" r="4" fill="${C.crem}"/>
            <path d="M24 22.5v2.5h1.8" stroke="${C.griInchis}" stroke-width="1" fill="none" stroke-linecap="round"/>
            <rect x="11" y="24" width="5" height="5" rx="1" fill="${C.tealDeschis}"/>
            <rect x="32" y="24" width="5" height="5" rx="1" fill="${C.tealDeschis}"/>
            <rect x="20" y="32" width="8" height="9" rx="1" fill="${C.lemn}"/>` },

        copac: { scale: 1.1, sway: true, svg: UMBRA + `
            <rect x="22.4" y="27" width="3.2" height="14" rx="1.4" fill="${C.trunchi}"/>
            <circle cx="24" cy="19" r="11" fill="${C.frunze}"/>
            <circle cx="16" cy="24" r="7" fill="${C.frunzeDeschis}"/>
            <circle cx="32" cy="24" r="7" fill="${C.frunzeInchis}"/>
            <circle cx="21" cy="15" r="4" fill="${C.frunzeDeschis}" opacity=".55"/>` },

        brad: { scale: 1.15, sway: true, svg: UMBRA + `
            <rect x="22.6" y="34" width="2.8" height="7" rx="1" fill="${C.trunchi}"/>
            <path d="M24 5 33 19H15z" fill="${C.frunzeInchis}"/>
            <path d="M24 13 35 28H13z" fill="${C.frunze}"/>
            <path d="M24 21 37 36H11z" fill="${C.frunzeDeschis}"/>` },

        tufa: { scale: 0.95, sway: true, svg: UMBRA + `
            <circle cx="17" cy="33" r="8" fill="${C.frunze}"/>
            <circle cx="31" cy="34" r="7" fill="${C.frunzeInchis}"/>
            <circle cx="24" cy="28" r="8" fill="${C.frunzeDeschis}"/>` },

        flori: { scale: 0.9, sway: true, svg: UMBRA + `
            <path d="M14 41V28" stroke="${C.frunze}" stroke-width="2.6" stroke-linecap="round"/>
            <path d="M24.5 41V25" stroke="${C.frunze}" stroke-width="2.6" stroke-linecap="round"/>
            <path d="M34.5 41V30" stroke="${C.frunze}" stroke-width="2.6" stroke-linecap="round"/>
            <circle cx="14" cy="23" r="6" fill="${C.roz}"/>
            <circle cx="14" cy="23" r="2.4" fill="${C.auriu}"/>
            <circle cx="24.5" cy="19.5" r="6" fill="${C.auriu}"/>
            <circle cx="24.5" cy="19.5" r="2.4" fill="${C.crem}"/>
            <circle cx="34.5" cy="25" r="5.4" fill="${C.crem}"/>
            <circle cx="34.5" cy="25" r="2.2" fill="${C.auriu}"/>` },

        fantana: { scale: 1.0, sway: false, svg: UMBRA + `
            <ellipse cx="24" cy="37" rx="15" ry="4.5" fill="${C.gri}"/>
            <ellipse cx="24" cy="35.5" rx="12" ry="3.4" fill="${C.tealDeschis}"/>
            <rect x="22.5" y="23" width="3" height="12" fill="${C.gri}"/>
            <ellipse cx="24" cy="23" rx="6.5" ry="2" fill="${C.gri}"/>
            <path d="M24 21c-2.5-3 2.5-5 0-8" stroke="${C.tealDeschis}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
            <circle cx="18" cy="19" r="1.6" fill="${C.tealDeschis}"/>
            <circle cx="30" cy="20" r="1.4" fill="${C.tealDeschis}"/>` },

        felinar: { scale: 0.95, sway: false, svg: UMBRA + `
            <rect x="22.8" y="20" width="2.4" height="20" rx="1.2" fill="${C.griInchis}"/>
            <rect x="16" y="38.5" width="16" height="3" rx="1.5" fill="${C.griInchis}"/>
            <path d="M15.5 20h17l-4.5-9.5h-8z" fill="${C.griInchis}"/>
            <path d="M18 18.5h12l-3.2-6.5h-5.6z" fill="${C.auriu}"/>
            <circle cx="24" cy="8.5" r="2.2" fill="${C.griInchis}"/>` },

        masina: { scale: 1.0, sway: false, svg: UMBRA + `
            <path d="M13 26l4.5-7h13l4.5 7z" fill="${C.rosuInchis}"/>
            <rect x="17" y="20.5" width="5.5" height="5" rx="1" fill="${C.tealDeschis}"/>
            <rect x="25.5" y="20.5" width="5.5" height="5" rx="1" fill="${C.tealDeschis}"/>
            <rect x="7" y="25" width="34" height="10" rx="3.5" fill="${C.rosu}"/>
            <circle cx="15" cy="36" r="4" fill="#3A3A3A"/>
            <circle cx="15" cy="36" r="1.6" fill="${C.gri}"/>
            <circle cx="33" cy="36" r="4" fill="#3A3A3A"/>
            <circle cx="33" cy="36" r="1.6" fill="${C.gri}"/>` },

        roata: { scale: 1.25, sway: false, svg: UMBRA + `
            <path d="M24 20 15 41M24 20 33 41" stroke="${C.gri}" stroke-width="2.2" stroke-linecap="round"/>
            <rect x="14" y="40" width="20" height="2.6" rx="1.3" fill="${C.griInchis}"/>
            <circle cx="24" cy="20" r="15" fill="none" stroke="${C.crem}" stroke-width="2.2"/>
            <path d="M24 5v30M9 20h30M13.4 9.4 34.6 30.6M34.6 9.4 13.4 30.6" stroke="${C.crem}" stroke-width="1.2" opacity=".8"/>
            <circle cx="24" cy="20" r="2.8" fill="${C.auriu}"/>
            <circle cx="39" cy="20" r="2.6" fill="${C.roz}"/>
            <circle cx="34.6" cy="9.4" r="2.6" fill="${C.auriu}"/>
            <circle cx="24" cy="5" r="2.6" fill="${C.tealDeschis}"/>
            <circle cx="13.4" cy="9.4" r="2.6" fill="${C.roz}"/>
            <circle cx="9" cy="20" r="2.6" fill="${C.auriu}"/>
            <circle cx="13.4" cy="30.6" r="2.6" fill="${C.tealDeschis}"/>
            <circle cx="24" cy="35" r="2.6" fill="${C.roz}"/>
            <circle cx="34.6" cy="30.6" r="2.6" fill="${C.auriu}"/>` },

        cort: { scale: 1.15, sway: false, svg: UMBRA + `
            <rect x="23.4" y="3" width="1.2" height="7" fill="${C.griInchis}"/>
            <path d="M24.6 3.5 30 5.3l-5.4 1.8z" fill="${C.auriu}"/>
            <path d="M24 9 42 40H6z" fill="${C.crem}"/>
            <path d="M24 9 30 40h-5.5zM24 9 18 40h5.5z" fill="${C.rosu}"/>
            <path d="M24 9 40.5 40H35zM24 9 7.5 40H13z" fill="${C.rosu}" opacity=".55"/>
            <path d="M19.5 40v-8a4.5 4.5 0 019 0v8z" fill="${C.vin}"/>` },

        carusel: { scale: 1.15, sway: false, svg: UMBRA + `
            <ellipse cx="24" cy="39" rx="16" ry="3.6" fill="${C.gri}"/>
            <rect x="11.5" y="26" width="2" height="13" fill="${C.auriu}"/>
            <rect x="23" y="26" width="2" height="13" fill="${C.auriu}"/>
            <rect x="34.5" y="26" width="2" height="13" fill="${C.auriu}"/>
            <path d="M24 7 41 27H7z" fill="${C.crem}"/>
            <path d="M24 7 29 27h-5zM24 7 19 27h5z" fill="${C.roz}"/>
            <path d="M24 7 39.5 27H35zM24 7 8.5 27H13z" fill="${C.roz}" opacity=".55"/>
            <circle cx="24" cy="5.5" r="2" fill="${C.auriu}"/>` },

        munte: { scale: 1.2, sway: false, svg: UMBRA + `
            <path d="M2 41 18 11l13 30z" fill="${C.piatra}"/>
            <path d="M18 11l5.5 10.5-5.5 4-5-5z" fill="#FFFFFF" opacity=".92"/>
            <path d="M24 41 35 19l11 22z" fill="${C.piatraDeschis}"/>
            <path d="M35 19l4 8-7.5.5z" fill="#FFFFFF" opacity=".85"/>` },

        grau: { scale: 0.9, sway: true, svg: UMBRA + `
            <path d="M14.5 41V22" stroke="#C99A3E" stroke-width="1.8" stroke-linecap="round"/>
            <path d="M24 41V17" stroke="#C99A3E" stroke-width="1.8" stroke-linecap="round"/>
            <path d="M33.5 41V24" stroke="#C99A3E" stroke-width="1.8" stroke-linecap="round"/>
            <ellipse cx="14.5" cy="18" rx="3" ry="6" fill="${C.auriu}"/>
            <ellipse cx="24" cy="13" rx="3.2" ry="6.5" fill="${C.auriu}"/>
            <ellipse cx="33.5" cy="20" rx="3" ry="6" fill="${C.auriu}"/>
            <path d="M14.5 13v10M24 7.5v11M33.5 15v10" stroke="#C99A3E" stroke-width=".9" opacity=".7"/>
            <path d="M12.5 16.5h4M12.5 20h4M22 11.5h4M22 15h4M31.5 18.5h4M31.5 22h4" stroke="#C99A3E" stroke-width=".7" opacity=".55"/>` }
    };

    // Lumea de pe marginea drumului se schimbă pe măsură ce cobori:
    // cartier → parc → oraș → distracție → natură.
    var CHAPTERS = [
        { until: 0.20, items: ['casa', 'copac', 'casa2', 'flori', 'insiruite', 'felinar', 'tufa', 'masina'] },
        { until: 0.42, items: ['copac', 'brad', 'tufa', 'flori', 'fantana', 'felinar'] },
        { until: 0.64, items: ['bloc', 'turn', 'magazin', 'biserica', 'scoala', 'masina', 'felinar', 'insiruite'] },
        { until: 0.84, items: ['cinema', 'mall', 'roata', 'cort', 'carusel', 'magazin', 'felinar'] },
        { until: 1.01, items: ['brad', 'copac', 'munte', 'grau', 'tufa', 'flori'] }
    ];

    var chapterOrder = [];

    var roadEl, svgEl, nodesEl, sceneryEl, emptyEl;
    var edgePath, basePath, dashPath, progressPath, linksPath;
    var nodeEls = [];
    var roadLength = 0;
    var drawQueued = false;
    var finaleDone = false;
    var scenerySignature = '';
    var propObserver = null;

    document.addEventListener('DOMContentLoaded', function () {
        // Surpriza rămâne surpriză: pagina nu se deschide nici pe adresă directă
        // înainte de 11 iulie, ora 12:00. Andrei intră oricând.
        if (typeof poateVedeaDrumul === 'function' && !poateVedeaDrumul()) {
            window.location.href = '2222.html';
            return;
        }

        setTitluAniversar();

        roadEl = document.getElementById('drum-road');
        svgEl = document.getElementById('drum-svg');
        nodesEl = document.getElementById('drum-nodes');
        sceneryEl = document.getElementById('drum-scenery');
        emptyEl = document.getElementById('drum-empty');
        edgePath = document.getElementById('drum-edge');
        basePath = document.getElementById('drum-base');
        dashPath = document.getElementById('drum-dash');
        progressPath = document.getElementById('drum-progress');
        linksPath = document.getElementById('drum-links');

        startCounter();
        showEditLinkForAndrei();
        setupLightbox();
        watchFinale();
        loadStops();
    });

    // ---------- Titlul care crește cu anii ----------

    function setTitluAniversar() {
        if (typeof numeAniversare !== 'function') return;

        var titlu = numeAniversare();
        document.title = titlu;

        var h1 = document.querySelector('.drum-title');
        if (h1) h1.textContent = titlu;
    }

    // ---------- Contorul din antet ----------

    function startCounter() {
        var el = document.getElementById('drum-counter');
        if (!el) return;

        function tick() {
            var diff = Date.now() - START_DATE.getTime();
            if (diff < 0) diff = 0;
            var zile = Math.floor(diff / 86400000);
            var ore = Math.floor(diff / 3600000) % 24;
            var min = Math.floor(diff / 60000) % 60;
            el.textContent = zile + ' zile · ' + ore + ' ore · ' + min + ' min';
        }

        tick();
        setInterval(tick, 30000);
    }

    function currentUserName() {
        if (typeof getLoggedInUser !== 'function') return null;
        var user = getLoggedInUser();
        return user ? user.name : null;
    }

    function showEditLinkForAndrei() {
        var link = document.getElementById('drum-edit-link');
        if (link && currentUserName() === 'andrei') {
            link.style.display = 'block';
        }
    }

    // ---------- Datele ----------

    async function loadStops() {
        var rows = null;

        try {
            var res = await _supabase
                .from('drum_amintiri')
                .select('id, photo_url, title, message, photo_date, ordine')
                .order('ordine', { ascending: true })
                .order('id', { ascending: true });

            if (res.error) throw res.error;
            rows = res.data;
        } catch (err) {
            console.error('Nu am putut încărca drumul:', err.message || err);
            var missingTable = err.code === 'PGRST205' || /schema cache/i.test(err.message || '');
            showEmpty(missingTable && currentUserName() === 'andrei'
                ? 'Tabelul drum_amintiri nu există încă. Rulează drum-setup.sql în Supabase → SQL Editor.'
                : 'Nu am putut încărca amintirile acum. Încearcă din nou peste puțin. 😔');
            return;
        }

        if (!rows || !rows.length) {
            showEmpty(currentUserName() === 'andrei'
                ? 'Drumul e încă gol. Apasă „Alege poze și scrie mesaje” ca să adaugi prima amintire.'
                : 'Drumul nostru se scrie chiar acum... revino în curând. ❤️');
            return;
        }

        renderStops(rows);
    }

    function showEmpty(text) {
        if (emptyEl) {
            emptyEl.textContent = text;
            emptyEl.style.display = 'block';
        }
        if (roadEl) roadEl.style.display = 'none';
    }

    function formatDate(raw) {
        if (!raw) return '';
        var m = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!m) return '';
        var month = MONTHS[parseInt(m[2], 10) - 1];
        if (!month) return '';
        return parseInt(m[3], 10) + ' ' + month + ' ' + m[1];
    }

    // ---------- Construirea opririlor ----------

    function renderStops(rows) {
        var frag = document.createDocumentFragment();

        rows.forEach(function (row, i) {
            frag.appendChild(buildStop(row, i));
            nodesEl.appendChild(buildNode(i));
        });

        roadEl.appendChild(frag);

        observeStops();
        scheduleDraw();

        window.addEventListener('resize', scheduleDraw);
        window.addEventListener('orientationchange', scheduleDraw);
        window.addEventListener('scroll', onScroll, { passive: true });

        if (window.ResizeObserver) {
            new ResizeObserver(scheduleDraw).observe(roadEl);
        }
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(scheduleDraw).catch(function () {});
        }
    }

    function buildStop(row, i) {
        var stop = document.createElement('article');
        stop.className = 'drum-stop ' + (i % 2 === 0 ? 'left' : 'right');
        stop.dataset.idx = String(i);

        var card = document.createElement('div');
        card.className = 'drum-card';

        var wrap = document.createElement('div');
        wrap.className = 'drum-photo-wrap';

        var img = document.createElement('img');
        img.className = 'drum-photo';
        img.src = row.photo_url;
        img.alt = row.title || ('Amintirea ' + (i + 1));
        img.loading = 'lazy';
        img.decoding = 'async';
        img.addEventListener('click', function () {
            openLightbox(row.photo_url, row.title, formatDate(row.photo_date));
        });
        img.addEventListener('load', scheduleDraw);
        wrap.appendChild(img);

        var badge = document.createElement('span');
        badge.className = 'drum-step-badge';
        badge.textContent = String(i + 1);
        wrap.appendChild(badge);

        card.appendChild(wrap);

        if (row.title) {
            var h = document.createElement('h2');
            h.className = 'drum-stop-title';
            h.textContent = row.title;
            card.appendChild(h);
        }

        var dateText = formatDate(row.photo_date);
        if (dateText) {
            var d = document.createElement('div');
            d.className = 'drum-stop-date';
            d.textContent = dateText;
            card.appendChild(d);
        }

        if (row.message) {
            var p = document.createElement('p');
            p.className = 'drum-stop-message';
            p.textContent = row.message;
            card.appendChild(p);
        }

        stop.appendChild(card);
        return stop;
    }

    function buildNode(i) {
        var node = document.createElement('div');
        node.className = 'drum-node';
        node.textContent = NODE_ICONS[i % NODE_ICONS.length];
        nodeEls.push(node);
        return node;
    }

    // ---------- Desenarea drumului ----------

    function scheduleDraw() {
        if (drawQueued) return;
        drawQueued = true;
        requestAnimationFrame(function () {
            drawQueued = false;
            drawRoad();
        });
    }

    function drawRoad() {
        var stops = Array.prototype.slice.call(roadEl.querySelectorAll('.drum-stop'));
        if (!stops.length) return;

        var W = roadEl.clientWidth;
        var H = roadEl.clientHeight;
        if (!W || !H) return;

        svgEl.setAttribute('viewBox', '0 0 ' + W + ' ' + H);

        var points = [{ x: W / 2, y: 0 }];
        var links = '';

        stops.forEach(function (el, i) {
            var isLeft = el.classList.contains('left');
            var cardLeft = el.offsetLeft;
            var cardRight = cardLeft + el.offsetWidth;

            // Drumul trece prin mijlocul spațiului rămas liber lângă card,
            // deci opririle vecine ajung de-o parte și de alta a lui.
            var x = isLeft ? (cardRight + W) / 2 : cardLeft / 2;
            var y = el.offsetTop + el.offsetHeight / 2;

            points.push({ x: x, y: y });

            // Firul scurt care leagă cardul de drum
            var edge = isLeft ? cardRight : cardLeft;
            if (Math.abs(x - edge) > NODE_RADIUS + 10) {
                var from = isLeft ? edge + 5 : edge - 5;
                var to = isLeft ? x - NODE_RADIUS : x + NODE_RADIUS;
                links += 'M ' + from + ' ' + y + ' L ' + to + ' ' + y + ' ';
            }

            var node = nodeEls[i];
            if (node) {
                node.style.left = x + 'px';
                node.style.top = y + 'px';
            }
        });

        points.push({ x: W / 2, y: H });

        var d = buildPath(points);
        edgePath.setAttribute('d', d);
        basePath.setAttribute('d', d);
        dashPath.setAttribute('d', d);
        progressPath.setAttribute('d', d);
        linksPath.setAttribute('d', links.trim());

        roadLength = basePath.getTotalLength();
        progressPath.style.strokeDasharray = roadLength + ' ' + roadLength;

        // Decorurile depind de traseu, dar nu le refacem la fiecare poză încărcată
        var signature = W + 'x' + Math.round(H);
        if (signature !== scenerySignature) {
            scenerySignature = signature;
            buildScenery(W, H);
        }

        onScroll();
    }

    // Cubice cu tangente verticale în fiecare punct => serpuire lină
    function buildPath(points) {
        var d = 'M ' + points[0].x + ' ' + points[0].y;
        for (var i = 1; i < points.length; i++) {
            var a = points[i - 1];
            var b = points[i];
            var dy = (b.y - a.y) * 0.42;
            d += ' C ' + a.x + ' ' + (a.y + dy) +
                 ', ' + b.x + ' ' + (b.y - dy) +
                 ', ' + b.x + ' ' + b.y;
        }
        return d;
    }

    // ---------- Lumea de pe marginea drumului ----------

    // Pseudo-aleator dar stabil: aceleași case, aceiași copaci după redesenare.
    function seeded(seed) {
        var x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
        return x - Math.floor(x);
    }

    function chapterIndexFor(t) {
        for (var i = 0; i < CHAPTERS.length; i++) {
            if (t <= CHAPTERS[i].until) return i;
        }
        return CHAPTERS.length - 1;
    }

    // Fiecare capitol își amestecă lista o singură dată, apoi o parcurge în cerc.
    // Așa nu vezi de cinci ori aceeași casă înainte să apară un copac.
    function orderFor(ci) {
        if (chapterOrder[ci]) return chapterOrder[ci];

        var arr = CHAPTERS[ci].items.slice();
        for (var i = arr.length - 1; i > 0; i--) {
            var j = Math.floor(seeded((ci + 1) * 31.7 + i) * (i + 1));
            var tmp = arr[i];
            arr[i] = arr[j];
            arr[j] = tmp;
        }

        chapterOrder[ci] = arr;
        return arr;
    }

    function buildScenery(W, H) {
        if (!sceneryEl || !roadLength) return;

        if (propObserver) propObserver.disconnect();
        sceneryEl.innerHTML = '';

        var narrow = W < 340;
        var step = narrow ? 58 : 50;
        var placed = [];
        var counters = [];

        var cards = Array.prototype.slice.call(roadEl.querySelectorAll('.drum-stop')).map(function (el) {
            return {
                left: el.offsetLeft - 6,
                top: el.offsetTop - 6,
                right: el.offsetLeft + el.offsetWidth + 6,
                bottom: el.offsetTop + el.offsetHeight + 6
            };
        });

        var nodes = nodeEls.map(function (n) {
            return { x: parseFloat(n.style.left) || 0, y: parseFloat(n.style.top) || 0 };
        });

        var sample = 0;
        for (var s = 24; s < roadLength - 24 && placed.length < MAX_PROPS; s += step) {
            sample++;

            var p = basePath.getPointAtLength(s);
            var q = basePath.getPointAtLength(Math.min(roadLength, s + 1));
            var tx = q.x - p.x;
            var ty = q.y - p.y;
            var len = Math.sqrt(tx * tx + ty * ty) || 1;
            var nx = -ty / len;
            var ny = tx / len;

            var ci = chapterIndexFor(p.y / H);
            var order = orderFor(ci);
            counters[ci] = (counters[ci] || 0) + 1;
            var key = order[(counters[ci] - 1) % order.length];
            var prop = PROPS[key];

            var base = (narrow ? 19 : 22) + seeded(sample * 3.1) * (narrow ? 6 : 9);
            var size = base * prop.scale;

            // Încercăm ambele maluri, întâi lipit de drum, apoi mai depărtat.
            var first = seeded(sample * 7.3) > 0.5 ? 1 : -1;
            var offsets = [ROAD_HALF + 8 + size / 2, ROAD_HALF + 8 + size / 2 + 11];
            var done = false;

            for (var o = 0; o < offsets.length && !done; o++) {
                for (var k = 0; k < 2 && !done; k++) {
                    var side = k === 0 ? first : -first;
                    var cx = p.x + nx * side * offsets[o];
                    var cy = p.y + ny * side * offsets[o];

                    if (fits(cx, cy, size, W, H, cards, nodes, placed)) {
                        placed.push({ x: cx, y: cy, r: size / 2 });
                        sceneryEl.appendChild(makeProp(cx, cy, size, prop, sample));
                        done = true;
                    }
                }
            }

            // Dacă nu a încăput nicăieri, capitolul nu pierde rândul
            if (!done) counters[ci]--;
        }

        observeProps();
    }

    function fits(cx, cy, size, W, H, cards, nodes, placed) {
        var half = size / 2;

        if (cx - half < 2 || cx + half > W - 2) return false;
        if (cy - half < 2 || cy + half > H - 2) return false;

        for (var i = 0; i < cards.length; i++) {
            var c = cards[i];
            if (cx + half > c.left && cx - half < c.right &&
                cy + half > c.top && cy - half < c.bottom) return false;
        }

        for (var j = 0; j < nodes.length; j++) {
            if (Math.hypot(cx - nodes[j].x, cy - nodes[j].y) < half + 26) return false;
        }

        for (var m = 0; m < placed.length; m++) {
            if (Math.hypot(cx - placed[m].x, cy - placed[m].y) < half + placed[m].r + 7) return false;
        }

        return true;
    }

    function makeProp(cx, cy, size, prop, sample) {
        var el = document.createElement('span');
        el.className = 'drum-prop' + (prop.sway ? ' sway' : '');
        el.style.left = cx + 'px';
        el.style.top = cy + 'px';
        el.style.width = size + 'px';
        el.style.height = size + 'px';

        // Doar vegetația se leagănă, defazat, ca să nu pulseze tot decorul odată
        var inner = document.createElement('span');
        inner.className = 'drum-prop-inner';
        inner.innerHTML = '<svg viewBox="0 0 48 48" aria-hidden="true">' + prop.svg + '</svg>';

        if (prop.sway) {
            inner.style.animationDelay = (seeded(sample * 2.7) * -6).toFixed(2) + 's';
            inner.style.animationDuration = (4.5 + seeded(sample * 4.4) * 3).toFixed(2) + 's';
        }

        el.appendChild(inner);
        return el;
    }

    function observeProps() {
        var props = sceneryEl.querySelectorAll('.drum-prop');

        if (!('IntersectionObserver' in window)) {
            props.forEach(function (el) { el.classList.add('visible'); });
            return;
        }

        propObserver = new IntersectionObserver(function (entries, obs) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('visible');
                obs.unobserve(entry.target);
            });
        }, { rootMargin: '0px 0px -6% 0px', threshold: 0.1 });

        props.forEach(function (el) { propObserver.observe(el); });
    }

    // Drumul se colorează pe măsură ce cobori
    function onScroll() {
        if (!roadLength) return;
        var rect = roadEl.getBoundingClientRect();
        var focus = window.innerHeight * 0.62;
        var progress = (focus - rect.top) / rect.height;
        progress = Math.max(0, Math.min(1, progress));
        progressPath.style.strokeDashoffset = String(roadLength * (1 - progress));
    }

    // ---------- Apariția opririlor ----------

    function observeStops() {
        var stops = roadEl.querySelectorAll('.drum-stop');

        if (!('IntersectionObserver' in window)) {
            stops.forEach(function (el) { el.classList.add('visible'); });
            nodeEls.forEach(function (n) { n.classList.add('visible'); });
            return;
        }

        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('visible');
                var node = nodeEls[parseInt(entry.target.dataset.idx, 10)];
                if (node) node.classList.add('visible');
                observer.unobserve(entry.target);
            });
        }, { rootMargin: '0px 0px -12% 0px', threshold: 0.15 });

        stops.forEach(function (el) { observer.observe(el); });
    }

    // ---------- Finalul: ploaie de inimi ----------

    function watchFinale() {
        var finale = document.getElementById('drum-finale');
        if (!finale || !('IntersectionObserver' in window)) return;

        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting && !finaleDone) {
                    finaleDone = true;
                    rainHearts();
                    observer.disconnect();
                }
            });
        }, { threshold: 0.45 });

        observer.observe(finale);
    }

    function rainHearts() {
        var canvas = document.getElementById('effects-canvas');
        if (!canvas) return;

        var chars = ['❤️', '💕', '💖', '💗', '💓', '💝', '💞', '🥰'];

        for (var i = 0; i < 32; i++) {
            (function (index) {
                setTimeout(function () {
                    var el = document.createElement('span');
                    el.className = 'effect-particle';
                    el.textContent = chars[Math.floor(Math.random() * chars.length)];

                    var startX = Math.random() * 100;
                    var duration = 3200 + Math.random() * 2200;

                    el.style.left = startX + '%';
                    el.style.fontSize = (14 + Math.random() * 18) + 'px';
                    el.style.setProperty('--end-x', (startX + (Math.random() - 0.5) * 40) + '%');
                    el.style.animationDuration = duration + 'ms';

                    canvas.appendChild(el);
                    setTimeout(function () { if (el.parentNode) el.remove(); }, duration + 200);
                }, index * 90);
            })(i);
        }
    }

    // ---------- Poza pe tot ecranul ----------

    function setupLightbox() {
        var box = document.getElementById('drum-lightbox');
        if (!box) return;

        box.addEventListener('click', closeLightbox);
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeLightbox();
        });
    }

    function openLightbox(url, title, dateText) {
        var box = document.getElementById('drum-lightbox');
        var img = document.getElementById('drum-lightbox-img');
        var cap = document.getElementById('drum-lightbox-cap');
        if (!box || !img) return;

        img.src = url;
        if (cap) {
            cap.textContent = [title, dateText].filter(Boolean).join(' · ');
        }
        box.classList.add('open');
    }

    function closeLightbox() {
        var box = document.getElementById('drum-lightbox');
        if (box) box.classList.remove('open');
    }
})();
