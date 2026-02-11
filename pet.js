// Pet virtual - challenge 6 luni
// Folosește _supabase și getLoggedInUser() din script.js

const PET_TOTAL_MONTHS = 6;
const PET_ESTIMATED_DAYS = PET_TOTAL_MONTHS * 30; // aproximativ
const PET_TOTAL_ACTIONS_FOR_FULL = PET_ESTIMATED_DAYS; // ~o acțiune/zi
const PET_PHOTO_COUNT = 15;
const PET_ACTIONS_PER_PHOTO = Math.ceil(PET_TOTAL_ACTIONS_FOR_FULL / PET_PHOTO_COUNT);

let petState = {
  id: null,
  userId: null,
  actionsCount: 0,
  progress: 0,
  unlockedPhotos: 1,
};

let petCurrentViewPhoto = 1;
let petIsSaving = false;
let petDailyCountdownTimer = null;

async function petLoadState() {
  if (typeof _supabase === 'undefined' || typeof getLoggedInUser !== 'function') {
    console.warn('Supabase sau getLoggedInUser nu sunt disponibile.');
    return;
  }

  const user = getLoggedInUser();
  if (!user) {
    window.location.href = 'index.html';
    return;
  }

  petState.userId = user.id;

  try {
    const { data, error } = await _supabase
      .from('PetProgress')
      .select('id, user_id, actions_count, progress, unlocked_photos')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Eroare la citirea progresului pet:', error.message || error);
    }

    if (data) {
      petState.id = data.id;
      petState.actionsCount = data.actions_count ?? 0;
      petState.progress = data.progress ?? 0;
      petState.unlockedPhotos = data.unlocked_photos ?? 1;
    } else {
      const { data: insertData, error: insertError } = await _supabase
        .from('PetProgress')
        .insert([{ user_id: user.id, actions_count: 0, progress: 0, unlocked_photos: 1 }])
        .select('id')
        .maybeSingle();

      if (insertError) {
        console.error('Nu am putut crea rândul de progres:', insertError.message || insertError);
      } else if (insertData) {
        petState.id = insertData.id;
      }
    }
  } catch (e) {
    console.error('Eroare neașteptată la load pet:', e);
  }
  petClampState();

  // La intrarea în pagină alegem automat poza cu progresul cel mai mic
  // (în logica noastră este ultima poză deblocată; cele anterioare sunt considerate pline)
  if (petState.unlockedPhotos < PET_PHOTO_COUNT) {
    petCurrentViewPhoto = petState.unlockedPhotos;
  } else {
    petCurrentViewPhoto = PET_PHOTO_COUNT;
  }

  petUpdateUI();
}

function petClampState() {
  if (petState.unlockedPhotos < 1) petState.unlockedPhotos = 1;
  if (petState.unlockedPhotos > PET_PHOTO_COUNT) petState.unlockedPhotos = PET_PHOTO_COUNT;
  if (petState.progress < 0) petState.progress = 0;
  if (petState.progress > 100) petState.progress = 100;
}

async function petSaveState() {
  if (!petState.userId || typeof _supabase === 'undefined') return;
  petIsSaving = true;

  const payload = {
    user_id: petState.userId,
    actions_count: petState.actionsCount,
    progress: petState.progress,
    unlocked_photos: petState.unlockedPhotos,
  };

  try {
    if (petState.id) {
      const { error } = await _supabase
        .from('PetProgress')
        .update(payload)
        .eq('id', petState.id);
      if (error) console.error('Eroare la actualizarea progresului pet:', error.message || error);
    } else {
      const { data, error } = await _supabase
        .from('PetProgress')
        .insert([payload])
        .select('id')
        .maybeSingle();
      if (error) {
        console.error('Eroare la inserarea progresului pet:', error.message || error);
      } else if (data) {
        petState.id = data.id;
      }
    }
  } catch (e) {
    console.error('Eroare neașteptată la salvare pet:', e);
  } finally {
    petIsSaving = false;
  }
}

function petUpdateUI() {
  const progressFill = document.getElementById('pet-progress-fill');
  const progressLabel = document.getElementById('pet-progress-label');
  const caption = document.getElementById('pet-photo-caption');
  const img = document.getElementById('pet-photo');
  const unlockedCountEl = document.getElementById('pet-unlocked-count');
  
  petClampState();
  if (!petCurrentViewPhoto || petCurrentViewPhoto > petState.unlockedPhotos) {
    petCurrentViewPhoto = petState.unlockedPhotos;
  }

  // Progresul barei este calculat pe poză, nu global
  const actionsPerPhoto = PET_ACTIONS_PER_PHOTO;
  const baseActionsForPhoto = (petCurrentViewPhoto - 1) * actionsPerPhoto;
  let actionsInCurrent = petState.actionsCount - baseActionsForPhoto;
  if (actionsInCurrent < 0) actionsInCurrent = 0;
  if (actionsInCurrent > actionsPerPhoto) actionsInCurrent = actionsPerPhoto;
  let progressForCurrent = (actionsInCurrent / actionsPerPhoto) * 100;

  // Pentru ultima poză, dacă este deja deblocată, nu mai avem nevoie de progres suplimentar
  if (petCurrentViewPhoto === PET_PHOTO_COUNT && petState.unlockedPhotos === PET_PHOTO_COUNT) {
    progressForCurrent = 100;
  }

  if (progressFill) progressFill.style.width = `${progressForCurrent}%`;
  if (progressLabel) progressLabel.textContent = `${Math.round(progressForCurrent)}%`;

  if (img) {
    img.src = `mic/${petCurrentViewPhoto}.jpeg`;
  }

  if (caption) {
    caption.textContent = `Poză ${petCurrentViewPhoto} din ${PET_PHOTO_COUNT}`;
  }

  if (unlockedCountEl) {
    unlockedCountEl.textContent = String(petState.unlockedPhotos);
  }

  petRenderGallery();
}

function petHandleSuccessfulDrop(kind) {
  if (petIsSaving) return;

  // Verificăm limita zilnică ținând cont separat de mâncare și apă
  const dailyInfo = petCheckDailyLimit(kind);
  if (!dailyInfo.allowedForThisAction) {
    petShowDailyLimitMessage(dailyInfo);
    return;
  }

  const previousUnlocked = petState.unlockedPhotos;

  petState.actionsCount += 1;

  const progress = (petState.actionsCount / PET_TOTAL_ACTIONS_FOR_FULL) * 100;
  petState.progress = progress > 100 ? 100 : progress;

  const unlocked = 1 + Math.floor(petState.actionsCount / PET_ACTIONS_PER_PHOTO);
  petState.unlockedPhotos = Math.min(PET_PHOTO_COUNT, unlocked);

  // Dacă tocmai s-a deblocat o poză nouă, afișăm imediat acea poză
  if (petState.unlockedPhotos > previousUnlocked) {
    petCurrentViewPhoto = petState.unlockedPhotos;
  }

  petClampState();
  petUpdateUI();
  petSpawnParticles(kind);
  petSaveState();

  petMarkDailyAction(dailyInfo, kind);
  const afterInfo = petCheckDailyLimit();
  petShowDailyLimitMessage(afterInfo);

  const frame = document.getElementById('pet-photo-frame');
  if (frame) {
    frame.classList.add('glow');
    setTimeout(() => frame.classList.remove('glow'), 800);
  }
}

function petCheckDailyLimit(kind) {
  const today = new Date().toISOString().slice(0, 10);
  let userId = null;
  try {
    if (typeof getLoggedInUser === 'function') {
      const u = getLoggedInUser();
      if (u && u.id) userId = u.id;
    }
  } catch (e) {
    console.warn('Nu pot citi utilizatorul pentru limita zilnică:', e);
  }

  const baseKey = userId ? `pet-daily-${userId}` : 'pet-daily-guest';
  const keyFood = `${baseKey}-food`;
  const keyWater = `${baseKey}-water`;

  try {
    const lastFoodDay = localStorage.getItem(keyFood);
    const lastWaterDay = localStorage.getItem(keyWater);

    const foodUsedToday = lastFoodDay === today;
    const waterUsedToday = lastWaterDay === today;
    const allUsedToday = foodUsedToday && waterUsedToday;

    let allowedForThisAction = true;
    if (kind === 'food') {
      allowedForThisAction = !foodUsedToday;
    } else if (kind === 'water') {
      allowedForThisAction = !waterUsedToday;
    }

    let nextReset = null;
    if (allUsedToday) {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      nextReset = tomorrow.getTime();
    }

    return {
      today,
      keyFood,
      keyWater,
      foodUsedToday,
      waterUsedToday,
      allUsedToday,
      allowedForThisAction,
      nextReset,
    };
  } catch (e) {
    console.warn('Nu pot accesa localStorage pentru limita zilnică:', e);
    return {
      today,
      keyFood: null,
      keyWater: null,
      foodUsedToday: false,
      waterUsedToday: false,
      allUsedToday: false,
      allowedForThisAction: true,
      nextReset: null,
    };
  }
}

function petMarkDailyAction(info, kind) {
  if (!info || !info.today) return;
  try {
    if (kind === 'food' && info.keyFood) {
      localStorage.setItem(info.keyFood, info.today);
    } else if (kind === 'water' && info.keyWater) {
      localStorage.setItem(info.keyWater, info.today);
    }
  } catch (e) {
    console.warn('Nu pot salva limita zilnică în localStorage:', e);
  }
}

function petShowDailyLimitMessage(info) {
  const el = document.getElementById('pet-daily-msg');
  if (!el) return;

  // Dacă nu am folosit și mâncarea și apa în aceeași zi,
  // arătăm doar mesajul de bază (încă mai ai cel puțin o acțiune disponibilă).
  if (!info || !info.allUsedToday) {
    if (petDailyCountdownTimer) {
      clearInterval(petDailyCountdownTimer);
      petDailyCountdownTimer = null;
    }
    el.textContent = 'Hrănește-mă';
    return;
  }

  petStartDailyCountdown(info);
}

function petStartDailyCountdown(info) {
  const el = document.getElementById('pet-daily-msg');
  if (!el) return;

  if (petDailyCountdownTimer) {
    clearInterval(petDailyCountdownTimer);
    petDailyCountdownTimer = null;
  }

  const update = () => {
    if (!info || !info.nextReset) {
      el.textContent = 'Astăzi l-ai hrănit deja. Revino mâine!';
      return;
    }

    const now = Date.now();
    const remainingMs = info.nextReset - now;

    if (remainingMs <= 0) {
      el.textContent = 'Îl poți hrăni din nou acum!';
      if (petDailyCountdownTimer) {
        clearInterval(petDailyCountdownTimer);
        petDailyCountdownTimer = null;
      }
      return;
    }

    const totalSeconds = Math.floor(remainingMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    let parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (hours === 0 && minutes === 0) parts.push(`${seconds}s`);

    const timeText = parts.join(' ');
    el.textContent = `Astăzi l-ai hrănit deja. Poți să-l hrănești din nou peste ${timeText}.`;
  };

  update();
  petDailyCountdownTimer = setInterval(update, 1000);
}

function petSpawnParticles(kind) {
  const frame = document.getElementById('pet-photo-frame');
  if (!frame) return;

  const container = document.createElement('div');
  container.className = 'pet-particles';

  const isFood = kind === 'food';
  const symbols = isFood
    ? ['💖', '✨', '⭐', '💫', '💕']
    : ['✨', '⭐', '💖', '💛', '✨'];

  const count = 14;
  for (let i = 0; i < count; i++) {
    const span = document.createElement('span');
    span.className = 'pet-particle';
    span.textContent = symbols[Math.floor(Math.random() * symbols.length)];

    const left = 15 + Math.random() * 70; // între 15% și 85%
    const delay = Math.random() * 0.4;
    const duration = 0.9 + Math.random() * 0.6;
    const scale = 0.8 + Math.random() * 0.8;

    span.style.left = `${left}%`;
    span.style.setProperty('--pet-particle-delay', `${delay}s`);
    span.style.setProperty('--pet-particle-duration', `${duration}s`);
    span.style.setProperty('--pet-particle-scale', `${scale}`);

    container.appendChild(span);
  }

  frame.appendChild(container);
  setTimeout(() => {
    container.remove();
  }, 2000);
}

function petSetupDragAndDrop() {
  const items = document.querySelectorAll('.pet-item');
  const frame = document.getElementById('pet-photo-frame');
  if (!items.length || !frame) return;

  items.forEach((item) => {
    item.addEventListener('pointerdown', (ev) => petStartDrag(ev, item));
  });
}

function petStartDrag(ev, source) {
  ev.preventDefault();

  const clone = source.cloneNode(true);
  clone.classList.add('dragging-clone');
  document.body.appendChild(clone);

  const type = source.dataset.type || 'food';

  const move = (e) => {
    const x = e.clientX;
    const y = e.clientY;
    clone.style.left = `${x - clone.offsetWidth / 2}px`;
    clone.style.top = `${y - clone.offsetHeight / 2}px`;
  };

  const up = (e) => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);

    const frame = document.getElementById('pet-photo-frame');
    if (frame) {
      const rect = frame.getBoundingClientRect();
      const x = e.clientX;
      const y = e.clientY;
      const inside = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
      if (inside) {
        petHandleSuccessfulDrop(type);
      }
    }

    clone.remove();
  };

  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);

  move(ev);
}

function petRenderGallery() {
  const grid = document.getElementById('pet-gallery-grid');
  if (!grid) return;
  grid.innerHTML = '';

  // Afișăm doar pozele deja deblocate, fără preview-uri pentru cele viitoare
  for (let i = 1; i <= petState.unlockedPhotos; i++) {
    const div = document.createElement('div');
    div.className = 'pet-gallery-item';

    const img = document.createElement('img');
    img.src = `mic/${i}.jpeg`;
    img.alt = `Poză ${i}`;

    img.addEventListener('click', () => {
      petOpenFullscreen(i);
    });

    div.appendChild(img);
    grid.appendChild(div);
  }
}

// --- FULLSCREEN VIEWER PENTRU POZELE DIN PET ---

let petFullscreenIndex = 1;

function petOpenFullscreen(index) {
  if (!petState.unlockedPhotos) return;

  if (!index || index < 1) index = petCurrentViewPhoto || 1;
  if (index > petState.unlockedPhotos) index = petState.unlockedPhotos;

  petFullscreenIndex = index;
  petCurrentViewPhoto = index;

  const modal = document.getElementById('pet-fullscreen-modal');
  const img = document.getElementById('pet-fullscreen-img');
  if (!modal || !img) return;

  img.src = `mic/${petFullscreenIndex}.jpeg`;
  modal.style.display = 'flex';
}

function petCloseFullscreen() {
  const modal = document.getElementById('pet-fullscreen-modal');
  if (modal) modal.style.display = 'none';
}

function petChangeFullscreenPhoto(direction) {
  if (!petState.unlockedPhotos) return;

  petFullscreenIndex += direction;
  if (petFullscreenIndex > petState.unlockedPhotos) petFullscreenIndex = 1;
  if (petFullscreenIndex < 1) petFullscreenIndex = petState.unlockedPhotos;

  petCurrentViewPhoto = petFullscreenIndex;
  const img = document.getElementById('pet-fullscreen-img');
  if (img) img.src = `mic/${petFullscreenIndex}.jpeg`;
  petUpdateUI();
}

function petSetupPhotoStack() {
  const btn = document.getElementById('pet-stack-button');
  const modal = document.getElementById('pet-gallery-modal');
  const close = document.getElementById('pet-gallery-close');
  const fsModal = document.getElementById('pet-fullscreen-modal');
  const fsClose = document.getElementById('pet-fullscreen-close');
  const fsPrev = document.getElementById('pet-fullscreen-prev');
  const fsNext = document.getElementById('pet-fullscreen-next');

  if (btn && modal) {
    btn.addEventListener('click', () => {
      modal.classList.remove('hidden');
    });
  }
  if (close && modal) {
    close.addEventListener('click', () => {
      modal.classList.add('hidden');
    });
  }

  modal?.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  });

  // Evenimente pentru fullscreen viewer
  if (fsClose && fsModal) {
    fsClose.addEventListener('click', () => petCloseFullscreen());
  }
  if (fsPrev) {
    fsPrev.addEventListener('click', () => petChangeFullscreenPhoto(-1));
  }
  if (fsNext) {
    fsNext.addEventListener('click', () => petChangeFullscreenPhoto(1));
  }

  fsModal?.addEventListener('click', (e) => {
    if (e.target === fsModal) petCloseFullscreen();
  });
}

function petSetupPhotoClickCycle() {
  const frame = document.getElementById('pet-photo-frame');
  if (!frame) return;
  frame.addEventListener('click', (e) => {
    if (e.target instanceof HTMLElement && e.target.id === 'pet-stack-button') return;
    if (petState.unlockedPhotos <= 1) return;
    petCurrentViewPhoto += 1;
    if (petCurrentViewPhoto > petState.unlockedPhotos) petCurrentViewPhoto = 1;
    petUpdateUI();
  });
}

window.addEventListener('DOMContentLoaded', () => {
  petSetupDragAndDrop();
  petSetupPhotoStack();
  petSetupPhotoClickCycle();
  petLoadState();
  const dailyInfo = petCheckDailyLimit();
  petShowDailyLimitMessage(dailyInfo);
});
