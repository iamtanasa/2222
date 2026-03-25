// shop.js
// Pagina de shop pentru provocări între utilizatori

// Folosește clientul global _supabase și helperul getLoggedInUser din script.js

function formatUserName(name) {
  if (!name) return '';
  const lower = name.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

async function loadShopUser() {
  const subtitleEl = document.getElementById('shop-subtitle');
  const nameEl = document.getElementById('shop-username');
  const pointsEl = document.getElementById('shop-points');

  const user = getLoggedInUser && getLoggedInUser();
  if (!user) {
    if (subtitleEl) subtitleEl.textContent = 'Trebuie să fii logat ca să folosești shop-ul.';
    if (nameEl) nameEl.textContent = '-';
    if (pointsEl) pointsEl.textContent = '0';
    return null;
  }

  if (subtitleEl) subtitleEl.textContent = 'Shop-ul este pregătit';
  if (nameEl) nameEl.textContent = formatUserName(user.name);

  try {
    const { data, error } = await _supabase
      .from('LoginUsers')
      .select('id, wins_bulls_cows, wins_hangman, wins_memory, wins_macao, wins_razboi, wins_triangles, wins_balloon, wins_puzzle, shop_spent')
      .eq('id', user.id)
      .maybeSingle();

    if (error || !data) {
      console.error('Eroare la citirea datelor pentru shop:', error && (error.message || error));
      if (pointsEl) pointsEl.textContent = '0';
      return user;
    }

    const bulls = Number.isFinite(data.wins_bulls_cows) ? data.wins_bulls_cows : 0;
    const hangman = Number.isFinite(data.wins_hangman) ? data.wins_hangman : 0;
    const memory = Number.isFinite(data.wins_memory) ? data.wins_memory : 0;
    const macao = Number.isFinite(data.wins_macao) ? data.wins_macao : 0;
    const razboi = Number.isFinite(data.wins_razboi) ? data.wins_razboi : 0;
    const triangles = Number.isFinite(data.wins_triangles) ? data.wins_triangles : 0;
    const balloon = Number.isFinite(data.wins_balloon) ? data.wins_balloon : 0;
    const puzzle = Number.isFinite(data.wins_puzzle) ? data.wins_puzzle : 0;
    const totalWins = bulls + hangman + memory + macao + razboi + triangles + balloon + puzzle;

    const spent = Number.isFinite(data.shop_spent) ? data.shop_spent : 0;
    const balance = Math.max(0, totalWins - spent);

    if (pointsEl) pointsEl.textContent = String(balance);
    return { ...user, totalWins, shop_spent: spent, shop_balance: balance };
  } catch (e) {
    console.error('Eroare neașteptată la încărcarea userului pentru shop:', e);
    if (pointsEl) pointsEl.textContent = '0';
    return user;
  }
}

async function refreshBalance() {
  await loadShopUser();
}

function renderChallengesList(containerId, challenges, options = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!challenges || challenges.length === 0) {
    container.innerHTML = '<p style="color:white; text-align:center;">Nu există provocări aici încă.</p>';
    return;
  }

  const {
    showBuyButton = false,
    onBuyClick = null,
    showDelete = false,
    onDeleteClick = null,
  } = options;

  const html = challenges
    .map((c) => {
      const title = c.title || 'Provocare';
      const desc = c.description || '';
      const price = Number.isFinite(c.price) ? c.price : 0;
      const creatorName = c.creator_name ? formatUserName(c.creator_name) : '';
      const buyerName = c.buyer_name ? formatUserName(c.buyer_name) : '';

      let metaLines = [];
      if (creatorName) metaLines.push('Creată de ' + creatorName);
      if (c.purchased && buyerName) metaLines.push('Cumpărată de ' + buyerName);

      const metaText = metaLines.length ? metaLines.join(' • ') : '';

      let buttonHtml = '';
      if (showBuyButton && !c.purchased) {
        buttonHtml = `<button class="shop-buy-btn" data-id="${c.id}" data-price="${price}">Cumpără</button>`;
      }

      let deleteHtml = '';
      if (showDelete) {
        deleteHtml = `<button class="shop-delete-btn" data-id="${c.id}">Șterge</button>`;
      }

      return `
        <div class="shop-item">
          <div class="shop-item-main">
            <div class="shop-item-title">${title}</div>
            <div class="shop-item-desc">${desc}</div>
          </div>
          <div class="shop-item-side">
            <div class="shop-item-top-row">
              <div class="shop-item-price">${price}p</div>
              <div class="shop-item-actions">
                ${buttonHtml}
                ${deleteHtml}
              </div>
            </div>
            ${metaText ? `<div class="shop-item-meta">${metaText}</div>` : ''}
          </div>
        </div>
      `;
    })
    .join('');

  container.innerHTML = html;

  if (showBuyButton && typeof onBuyClick === 'function') {
    container.querySelectorAll('.shop-buy-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.getAttribute('data-id'));
        const price = Number(btn.getAttribute('data-price'));
        onBuyClick(id, price);
      });
    });
  }

  if (showDelete && typeof onDeleteClick === 'function') {
    container.querySelectorAll('.shop-delete-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.getAttribute('data-id'));
        onDeleteClick(id);
      });
    });
  }
}

async function loadChallengesForShop(user) {
  if (!user) return;

  const availableContainer = document.getElementById('available-challenges');
  const mineContainer = document.getElementById('my-challenges');
  const boughtContainer = document.getElementById('bought-challenges');
  if (availableContainer) {
    availableContainer.innerHTML = '<p style="color:white; text-align:center;">Se încarcă provocările...</p>';
  }
  if (mineContainer) {
    mineContainer.innerHTML = '<p style="color:white; text-align:center;">Se încarcă provocările tale...</p>';
  }
  if (boughtContainer) {
    boughtContainer.innerHTML = '<p style="color:white; text-align:center;">Se încarcă provocările cumpărate...</p>';
  }

  try {
    const { data, error } = await _supabase
      .from('ShopChallenges')
      .select('id, title, description, price, creator_id, is_active, purchased_by_id, creator:creator_id(name), buyer:purchased_by_id(name)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Eroare la încărcarea provocărilor:', error.message || error);
      if (availableContainer) {
        availableContainer.innerHTML = '<p style="color:white; text-align:center;">Nu am putut încărca provocările.</p>';
      }
      if (mineContainer) {
        mineContainer.innerHTML = '<p style="color:white; text-align:center;">Nu am putut încărca provocările tale.</p>';
      }
      return;
    }

    const all = (data || []).map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      price: row.price,
      creator_id: row.creator_id,
      purchased: !!row.purchased_by_id,
      purchased_by_id: row.purchased_by_id,
      creator_name: row.creator ? row.creator.name : null,
      buyer_name: row.buyer ? row.buyer.name : null,
    }));

    const available = all.filter((c) => c.creator_id !== user.id && !c.purchased);
    const mine = all.filter((c) => c.creator_id === user.id);
    const boughtByMe = all.filter((c) => c.purchased && c.purchased_by_id === user.id);

    renderChallengesList('available-challenges', available, {
      showBuyButton: true,
      onBuyClick: (id, price) => buyChallenge(user, id, price),
    });

    renderChallengesList('my-challenges', mine, {
      showBuyButton: false,
      showDelete: true,
      onDeleteClick: (id) => deleteChallenge(user, id, 'creator'),
    });

    renderChallengesList('bought-challenges', boughtByMe, {
      showBuyButton: false,
      showDelete: true,
      onDeleteClick: (id) => deleteChallenge(user, id, 'buyer'),
    });
  } catch (e) {
    console.error('Eroare neașteptată la încărcarea provocărilor:', e);
    if (availableContainer) {
      availableContainer.innerHTML = '<p style="color:white; text-align:center;">Nu am putut încărca provocările.</p>';
    }
    if (mineContainer) {
      mineContainer.innerHTML = '<p style="color:white; text-align:center;">Nu am putut încărca provocările tale.</p>';
    }
    if (boughtContainer) {
      boughtContainer.innerHTML = '<p style="color:white; text-align:center;">Nu am putut încărca provocările cumpărate.</p>';
    }
  }
}

async function createChallenge() {
  const msgEl = document.getElementById('create-challenge-msg');
  if (msgEl) {
    msgEl.textContent = '';
    msgEl.className = 'shop-info-msg';
  }

  const user = getLoggedInUser && getLoggedInUser();
  if (!user) {
    if (msgEl) {
      msgEl.textContent = 'Trebuie să fii logat ca să creezi provocări.';
      msgEl.classList.add('error');
    }
    return;
  }

  const titleInput = document.getElementById('challenge-title');
  const descInput = document.getElementById('challenge-desc');
  const priceInput = document.getElementById('challenge-price');

  const title = titleInput ? titleInput.value.trim() : '';
  const desc = descInput ? descInput.value.trim() : '';
  const price = priceInput ? Number(priceInput.value) : NaN;

  if (!title || !desc || !Number.isFinite(price) || price <= 0) {
    if (msgEl) {
      msgEl.textContent = 'Completează titlul, descrierea și un preț valid (>0).';
      msgEl.classList.add('error');
    }
    return;
  }

  try {
    const { error } = await _supabase
      .from('ShopChallenges')
      .insert([
        {
          title,
          description: desc,
          price,
          creator_id: user.id,
        },
      ]);

    if (error) {
      console.error('Eroare la creare provocare:', error.message || error);
      if (msgEl) {
        msgEl.textContent = 'Nu am putut salva provocarea. Încearcă din nou.';
        msgEl.classList.add('error');
      }
      return;
    }

    if (titleInput) titleInput.value = '';
    if (descInput) descInput.value = '';
    if (priceInput) priceInput.value = '';

    if (msgEl) {
      msgEl.textContent = 'Provocarea a fost salvată pentru celălalt dintre voi.';
      msgEl.classList.add('success');
    }

    const fullUser = await loadShopUser();
    await loadChallengesForShop(fullUser || user);
  } catch (e) {
    console.error('Eroare neașteptată la creare provocare:', e);
    if (msgEl) {
      msgEl.textContent = 'Nu am putut salva provocarea. Încearcă din nou.';
      msgEl.classList.add('error');
    }
  }
}

async function buyChallenge(user, challengeId, price) {
  if (!user) return;

  const confirmBuy = window.confirm('Cumperi provocarea pentru ' + price + ' puncte?');
  if (!confirmBuy) return;

  try {
    // 1. Re-citim soldul din LoginUsers (victorii + ce s-a cheltuit până acum)
    const { data: userRow, error: userError } = await _supabase
      .from('LoginUsers')
      .select('id, wins_bulls_cows, wins_hangman, wins_memory, wins_macao, wins_razboi, wins_triangles, wins_balloon, wins_puzzle, shop_spent')
      .eq('id', user.id)
      .maybeSingle();

    if (userError || !userRow) {
      console.error('Eroare la recitirea userului:', userError || 'no data');
      alert('Nu pot verifica soldul de puncte acum. Încearcă mai târziu.');
      return;
    }

    const bulls = Number.isFinite(userRow.wins_bulls_cows) ? userRow.wins_bulls_cows : 0;
    const hangman = Number.isFinite(userRow.wins_hangman) ? userRow.wins_hangman : 0;
    const memory = Number.isFinite(userRow.wins_memory) ? userRow.wins_memory : 0;
    const macao = Number.isFinite(userRow.wins_macao) ? userRow.wins_macao : 0;
    const razboi = Number.isFinite(userRow.wins_razboi) ? userRow.wins_razboi : 0;
    const triangles = Number.isFinite(userRow.wins_triangles) ? userRow.wins_triangles : 0;
    const balloon = Number.isFinite(userRow.wins_balloon) ? userRow.wins_balloon : 0;
    const puzzle = Number.isFinite(userRow.wins_puzzle) ? userRow.wins_puzzle : 0;
    const totalWins = bulls + hangman + memory + macao + razboi + triangles + balloon + puzzle;

    const spent = Number.isFinite(userRow.shop_spent) ? userRow.shop_spent : 0;
    const currentPoints = Math.max(0, totalWins - spent);

    if (currentPoints < price) {
      alert('Nu ai suficiente puncte pentru această provocare.');
      return;
    }

    // 2. Verificăm că provocarea există și nu e cumpărată deja și nu e a ta
    const { data: challengeRow, error: chError } = await _supabase
      .from('ShopChallenges')
      .select('id, creator_id, purchased_by_id, price')
      .eq('id', challengeId)
      .maybeSingle();

    if (chError || !challengeRow) {
      console.error('Eroare la recitirea provocării:', chError || 'no data');
      alert('Provocarea nu mai există. Reîncarcă pagina.');
      return;
    }

    if (challengeRow.creator_id === user.id) {
      alert('Nu poți cumpăra propria provocare.');
      return;
    }

    if (challengeRow.purchased_by_id) {
      alert('Această provocare a fost deja cumpărată.');
      return;
    }

    const effectivePrice = Number.isFinite(challengeRow.price) ? challengeRow.price : price;

    if (currentPoints < effectivePrice) {
      alert('Nu ai suficiente puncte pentru această provocare.');
      return;
    }

    // 3. Creștem "cheltuielile" și marcăm provocarea ca fiind cumpărată
    const { error: updateUserError } = await _supabase
      .from('LoginUsers')
      .update({ shop_spent: spent + effectivePrice })
      .eq('id', user.id);

    if (updateUserError) {
      console.error('Eroare la actualizarea punctelor:', updateUserError.message || updateUserError);
      alert('Nu am putut actualiza punctele. Încearcă din nou.');
      return;
    }

    const { error: updateChallengeError } = await _supabase
      .from('ShopChallenges')
      .update({ purchased_by_id: user.id, is_active: false })
      .eq('id', challengeRow.id);

    if (updateChallengeError) {
      console.error('Eroare la marcarea provocării ca cumpărată:', updateChallengeError.message || updateChallengeError);
      alert('Punctele au fost scăzute, dar nu am putut marca provocarea ca cumpărată. Verificați în Supabase.');
    }

    await refreshBalance();
    const fullUser = await loadShopUser();
    await loadChallengesForShop(fullUser || user);

    alert('Ai cumpărat provocarea! Acum trebuie îndeplinită ❤️');
  } catch (e) {
    console.error('Eroare neașteptată la cumpărarea provocării:', e);
    alert('A apărut o eroare. Încearcă din nou.');
  }
}

async function deleteChallenge(user, challengeId, mode) {
  if (!user) return;

  const isCreator = mode === 'creator';
  const message = isCreator
    ? 'Ștergi această provocare? Va dispărea pentru amândoi.'
    : 'Ștergi această provocare cumpărată? Punctele cheltuite nu vor fi returnate.';

  const ok = window.confirm(message);
  if (!ok) return;

  try {
    const { error } = await _supabase
      .from('ShopChallenges')
      .delete()
      .eq('id', challengeId);

    if (error) {
      console.error('Eroare la ștergerea provocării:', error.message || error);
      alert('Nu am putut șterge provocarea. Încearcă din nou.');
      return;
    }

    const fullUser = await loadShopUser();
    await loadChallengesForShop(fullUser || user);
  } catch (e) {
    console.error('Eroare neașteptată la ștergerea provocării:', e);
    alert('A apărut o eroare. Încearcă din nou.');
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  const user = await loadShopUser();

  const createBtn = document.getElementById('create-challenge-btn');
  if (createBtn) {
    createBtn.addEventListener('click', createChallenge);
  }

   const btnModeShop = document.getElementById('btn-mode-shop');
   const btnModeCreate = document.getElementById('btn-mode-create');
   const shopView = document.getElementById('shop-view-section');
   const createView = document.getElementById('create-view-section');

   function setMode(mode) {
     if (!shopView || !createView || !btnModeShop || !btnModeCreate) return;

     const isShop = mode === 'shop';
     shopView.classList.toggle('shop-hidden', !isShop);
     createView.classList.toggle('shop-hidden', isShop);

     btnModeShop.classList.toggle('active', isShop);
     btnModeCreate.classList.toggle('active', !isShop);
   }

   if (btnModeShop) {
     btnModeShop.addEventListener('click', () => setMode('shop'));
   }
   if (btnModeCreate) {
     btnModeCreate.addEventListener('click', () => setMode('create'));
   }

   // pornim în modul „shop” (listă de provocări)
   setMode('shop');

  if (user) {
    await loadChallengesForShop(user);
  }
});
