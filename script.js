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

// Helper: înregistrează o victorie în LoginUsers (bulls sau hangman)
async function recordWin(game) {
    const user = getLoggedInUser();
    if (!user) return; // dacă nu e login real, nu facem nimic

    let column = null;
    if (game === 'bulls') column = 'wins_bulls_cows';
    else if (game === 'hangman') column = 'wins_hangman';
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

// Protejăm pagina principală (2222.html) astfel încât să fie accesibilă doar după login reușit
document.addEventListener('DOMContentLoaded', () => {
    const body = document.body;
    if (!body) return;

    const page = body.dataset.page;
    if (page === 'universe') {
        const isLoggedIn = localStorage.getItem('berea_auth_ok') === '1';
        if (!isLoggedIn) {
            window.location.href = 'index.html';
        }
    }
});

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
    const dataNoastra = new Date("2025-07-11"); 
    
    function updateCounter() {
        const acum = new Date();
        const diff = acum - dataNoastra;
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

    // Construim o dată validă folosind obiectul Date (evită date invalide, ex: 31 februarie)
    const tmpDate = new Date(year, month - 1, day);
    const dateStr = tmpDate.toISOString().slice(0, 10); // YYYY-MM-DD

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