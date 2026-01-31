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

function valideazaLogin() {
    const user = document.getElementById('username').value.trim();
    const pass = document.getElementById('password').value;
    const error = document.getElementById('error-message');
    const container = document.querySelector('.login-container');

    if ((user.toLowerCase() === "andrei" || user.toLowerCase() === "georgiana") && pass === "2222") {
        if (error) error.style.display = 'none';
        container.classList.add('container-exit');
        
        setTimeout(() => {
            document.body.classList.add('page-fade-out');
        }, 200);

        setTimeout(() => {
            window.location.href = "2222.html";
        }, 1000);
    } else {
        if (error) {
            error.textContent = "Ceva nu e bine... mai încearcă.";
            error.style.display = 'block';
        }
        container.classList.add('shake-effect');
        setTimeout(() => { container.classList.remove('shake-effect'); }, 400);
    }
}

function logout() {
    document.body.classList.add('page-fade-out');
    setTimeout(() => { window.location.href = "index.html"; }, 800);
}

function navigateTo(page) {
    document.body.classList.add('page-fade-out');
    setTimeout(() => { window.location.href = page; }, 600);
}

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
        .select('*')
        .order('created_at', { ascending: false });

    if (data) {
        allPhotosData = data; 
        grid.innerHTML = '';
        
        if (data.length === 0) {
            grid.innerHTML = '<p style="color:white; grid-column: 1/-1;">Nicio amintire încă. ❤️</p>';
            return;
        }

        data.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'gallery-item';
            // IMPORTANT: Folosim item.id pentru ștergere și item.url pentru storage
            div.innerHTML = `
                <img src="${item.url}" onclick="openFullscreen(${index})">
                <button class="btn-delete" onclick="deletePhoto(${item.id}, '${item.url}')">&times;</button>
            `;
            grid.appendChild(div);
        });
    }
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
        document.getElementById('fullscreen-modal').style.display = 'flex';
    }
}

function closeFullscreen() {
    document.getElementById('fullscreen-modal').style.display = 'none';
}

function changeFullscreenPhoto(direction) {
    if (allPhotosData.length === 0) return;
    
    currentPhotoIndex += direction;

    if (currentPhotoIndex >= allPhotosData.length) currentPhotoIndex = 0;
    if (currentPhotoIndex < 0) currentPhotoIndex = allPhotosData.length - 1;

    document.getElementById('img-viewer').src = allPhotosData[currentPhotoIndex].url;
}