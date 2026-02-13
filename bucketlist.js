'use strict';

// Bucket List pentru Universul 2222 (stocat în Supabase)

let bucketItems = [];
let bucketFilter = 'all'; // 'all' | 'todo' | 'done'

function mapBucketRow(row) {
  return {
    id: row.id,
    title: String(row.title || ''),
    description: String(row.description || ''),
    isDone: !!row.is_done,
    createdAt: row.created_at ? new Date(row.created_at) : null,
    doneAt: row.done_at ? new Date(row.done_at) : null,
  };
}

async function loadBucketItems() {
  const statsEl = document.getElementById('bucket-stats');
  if (typeof _supabase === 'undefined') {
    bucketItems = [];
    if (statsEl) {
      statsEl.textContent = 'Nu mă pot conecta la server acum. Încearcă mai târziu.';
    }
    renderBucketLists();
    return;
  }

  const { data, error } = await _supabase
    .from('BucketList')
    .select('id, title, description, is_done, created_at, done_at')
    .order('is_done', { ascending: true })
    .order('created_at', { ascending: true });

  if (error || !Array.isArray(data)) {
    console.error('Eroare la încărcarea Bucket List:', error);
    bucketItems = [];
    if (statsEl) {
      statsEl.textContent = 'Nu am putut încărca Bucket List-ul.';
    }
    renderBucketLists();
    return;
  }

  bucketItems = data.map(mapBucketRow);
  renderBucketLists();
}

async function addBucketItem(title, description) {
  if (typeof _supabase === 'undefined') return false;

  const user = typeof getLoggedInUser === 'function' ? getLoggedInUser() : null;
  const nowIso = new Date().toISOString();

  const payload = {
    title,
    description: description || null,
    is_done: false,
    created_at: nowIso,
    done_at: null,
  };

  if (user && user.id) {
    payload.user_id = user.id; // nu afișăm niciodată numele în UI
  }

  const { data, error } = await _supabase
    .from('BucketList')
    .insert(payload)
    .select('id, title, description, is_done, created_at, done_at')
    .single();

  if (error || !data) {
    alert('Nu am putut adăuga în Bucket List: ' + (error && error.message ? error.message : 'eroare necunoscută'));
    return false;
  }

  const item = mapBucketRow(data);
  bucketItems.push(item);
  bucketItems.sort((a, b) => {
    if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
    if (a.createdAt && b.createdAt) return a.createdAt - b.createdAt;
    return 0;
  });

  renderBucketLists();
  return true;
}

async function markBucketItemDone(id) {
  if (typeof _supabase === 'undefined') return;
  const item = bucketItems.find((x) => x.id === id);
  if (!item || item.isDone) return;

  const nowIso = new Date().toISOString();

  const { data, error } = await _supabase
    .from('BucketList')
    .update({ is_done: true, done_at: nowIso })
    .eq('id', id)
    .select('id, title, description, is_done, created_at, done_at')
    .single();

  if (error || !data) {
    alert('Nu am putut bifa această dorință: ' + (error && error.message ? error.message : 'eroare necunoscută'));
    return;
  }

  const updated = mapBucketRow(data);
  const idx = bucketItems.findIndex((x) => x.id === id);
  if (idx !== -1) {
    bucketItems[idx] = updated;
  }

  renderBucketLists();
}

async function deleteBucketItem(id) {
  if (typeof _supabase === 'undefined') return;
  const ok = confirm('Sigur vrei să ștergi această dorință din Bucket List?');
  if (!ok) return;

  const { error } = await _supabase.from('BucketList').delete().eq('id', id);
  if (error) {
    alert('Nu am putut șterge: ' + (error && error.message ? error.message : 'eroare necunoscută'));
    return;
  }

  bucketItems = bucketItems.filter((x) => x.id !== id);
  renderBucketLists();
}

function formatBucketDate(d) {
  if (!d || Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ro-RO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function renderBucketLists() {
  const listContainer = document.getElementById('bucket-list');
  const statsEl = document.getElementById('bucket-stats');

  if (!listContainer) return;

  listContainer.innerHTML = '';

  const todos = bucketItems.filter((x) => !x.isDone);
  const dones = bucketItems.filter((x) => x.isDone);

  const total = bucketItems.length;
  const totalTodos = todos.length;
  const totalDones = dones.length;

  if (statsEl) {
    if (!total) {
      statsEl.textContent = 'Încă nu avem nimic în Bucket List. Hai să adăugăm primul vis!';
    } 
  }

  // Alegem lista in functie de filtru
  let visibleItems;
  if (bucketFilter === 'todo') visibleItems = todos;
  else if (bucketFilter === 'done') visibleItems = dones;
  else visibleItems = bucketItems;

  if (!visibleItems.length) {
    const p = document.createElement('p');
    p.className = 'bucket-empty-text';
    if (!bucketItems.length) {
      p.textContent = 'Încă nu avem nimic în Bucket List. Hai să adăugăm primul vis!';
    } else if (bucketFilter === 'todo') {
      p.textContent = 'Nu mai avem nimic de făcut aici. Doar dorințe împlinite.';
    } else if (bucketFilter === 'done') {
      p.textContent = 'Încă nu am împlinit nimic aici, dar o să se umple în curând.';
    } else {
      p.textContent = 'Nu s-a găsit nicio dorință pentru filtrul ales.';
    }
    listContainer.appendChild(p);
    return;
  }

  visibleItems.forEach((item) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'bucket-item';

    const header = document.createElement('div');
    header.className = 'bucket-item-header';

    const titleEl = document.createElement('div');
    titleEl.className = 'bucket-item-title' + (item.isDone ? ' done' : '');
    titleEl.textContent = item.title;

    const rightSide = document.createElement('div');
    rightSide.className = 'bucket-item-header-right';

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'bucket-trash';
    deleteBtn.textContent = '🗑️';
    deleteBtn.addEventListener('click', () => deleteBucketItem(item.id));

    const heartBtn = document.createElement('button');
    heartBtn.type = 'button';
    heartBtn.className = 'bucket-heart' + (item.isDone ? ' done' : '');
    heartBtn.textContent = item.isDone ? '♥' : '♡';
    if (!item.isDone) {
      heartBtn.addEventListener('click', () => markBucketItemDone(item.id));
    }

    // cosul in stanga, inimioara in dreapta
    rightSide.appendChild(deleteBtn);
    rightSide.appendChild(heartBtn);

    header.appendChild(titleEl);
    header.appendChild(rightSide);

    const notesEl = document.createElement('div');
    notesEl.className = 'bucket-item-notes';
    if (item.description) {
      notesEl.textContent = item.description;
    }

    wrapper.appendChild(header);
    if (item.description) wrapper.appendChild(notesEl);
    // nu mai afisam textul "Împlinită pe...", doar cosul langa inimioara in header

    listContainer.appendChild(wrapper);
  });
}

function initBucketList() {
  const titleInput = document.getElementById('bucket-title');
  const notesInput = document.getElementById('bucket-notes');
  const addBtn = document.getElementById('bucket-add');
  const modeCreateBtn = document.getElementById('bucket-mode-create');
  const modeListBtn = document.getElementById('bucket-mode-list');
  const viewCreate = document.getElementById('bucket-view-create');
  const viewList = document.getElementById('bucket-view-list');
  const filterAllBtn = document.getElementById('bucket-filter-all');
  const filterTodoBtn = document.getElementById('bucket-filter-todo');
  const filterDoneBtn = document.getElementById('bucket-filter-done');

  (async () => {
    await loadBucketItems();
  })();

  if (addBtn) {
    addBtn.addEventListener('click', async () => {
      const title = (titleInput.value || '').trim();
      const notes = (notesInput.value || '').trim();

      if (!title) {
        alert('Scrie măcar un titlu mic pentru dorința ta.');
        return;
      }

      const ok = await addBucketItem(title, notes);
      if (!ok) return;

      titleInput.value = '';
      notesInput.value = '';

      // după ce adăugăm o dorință, comutăm elegant pe lista de dorințe
      if (modeListBtn && modeCreateBtn && viewCreate && viewList) {
        modeCreateBtn.classList.remove('active');
        modeListBtn.classList.add('active');
        viewCreate.classList.remove('active');
        viewList.classList.add('active');
      }
    });
  }

  // Filtre lista in functie de status
  function setBucketFilter(newFilter) {
    bucketFilter = newFilter;
    if (filterAllBtn && filterTodoBtn && filterDoneBtn) {
      filterAllBtn.classList.toggle('active', newFilter === 'all');
      filterTodoBtn.classList.toggle('active', newFilter === 'todo');
      filterDoneBtn.classList.toggle('active', newFilter === 'done');
    }
    renderBucketLists();
  }

  if (filterAllBtn) {
    filterAllBtn.addEventListener('click', () => setBucketFilter('all'));
  }
  if (filterTodoBtn) {
    filterTodoBtn.addEventListener('click', () => setBucketFilter('todo'));
  }
  if (filterDoneBtn) {
    filterDoneBtn.addEventListener('click', () => setBucketFilter('done'));
  }

  if (modeCreateBtn && modeListBtn && viewCreate && viewList) {
    modeCreateBtn.addEventListener('click', () => {
      modeCreateBtn.classList.add('active');
      modeListBtn.classList.remove('active');
      viewCreate.classList.add('active');
      viewList.classList.remove('active');
    });

    modeListBtn.addEventListener('click', () => {
      modeCreateBtn.classList.remove('active');
      modeListBtn.classList.add('active');
      viewCreate.classList.remove('active');
      viewList.classList.add('active');
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if (page === 'bucketlist') {
    initBucketList();
  }
});
