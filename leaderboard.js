// leaderboard.js
// Afișează victoriile pentru Andrei și Georgiana din tabela LoginUsers

// Folosim nume diferite pentru a nu intra în conflict cu constanții din script.js
const LB_SUPABASE_URL = 'https://nzkihyaifxkfccwgiilp.supabase.co';
const LB_SUPABASE_KEY = 'sb_publishable_5oxupUfCOgvdMAe0guBQWQ_XKfwq6dL';

const lbClient = supabase.createClient(LB_SUPABASE_URL, LB_SUPABASE_KEY);

function formatName(name) {
  if (!name) return '';
  const lower = name.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function renderLeaderboard(users) {
  const container = document.getElementById('leaderboard-content');
  if (!container) return;

  if (!users || users.length === 0) {
    container.innerHTML = '<p style="color:white; text-align:center;">Nu am găsit utilizatori în LoginUsers.</p>';
    return;
  }

  // Ne concentrăm pe Andrei și Georgiana, dar afișăm oricine există în tabel
  const rowsHtml = users
    .map((u) => {
      const name = formatName(u.name || '');
      const bulls = Number.isFinite(u.wins_bulls_cows) ? u.wins_bulls_cows : 0;
      const hangman = Number.isFinite(u.wins_hangman) ? u.wins_hangman : 0;
      const memory = Number.isFinite(u.wins_memory) ? u.wins_memory : 0;
      const macao = Number.isFinite(u.wins_macao) ? u.wins_macao : 0;
      const razboi = Number.isFinite(u.wins_razboi) ? u.wins_razboi : 0;
      const triangles = Number.isFinite(u.wins_triangles) ? u.wins_triangles : 0;
      return `
        <div class="leaderboard-row">
          <div class="leaderboard-row-header">
            <div class="leaderboard-name">${name}</div>
          </div>
          <div class="leaderboard-row-stats">
            <div class="leaderboard-stat">
              <span class="lb-label">Bulls &amp; Cows</span>
              <span class="lb-value">${bulls}</span>
            </div>
            <div class="leaderboard-stat">
              <span class="lb-label">Spânzurătoarea</span>
              <span class="lb-value">${hangman}</span>
            </div>
            <div class="leaderboard-stat">
              <span class="lb-label">Memory Game</span>
              <span class="lb-value">${memory}</span>
            </div>
            <div class="leaderboard-stat">
              <span class="lb-label">Macao</span>
              <span class="lb-value">${macao}</span>
            </div>
            <div class="leaderboard-stat">
              <span class="lb-label">Război</span>
              <span class="lb-value">${razboi}</span>
            </div>
            <div class="leaderboard-stat">
              <span class="lb-label">Triunghiuri</span>
              <span class="lb-value">${triangles}</span>
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  container.innerHTML = rowsHtml;
}

async function loadLeaderboard() {
  const container = document.getElementById('leaderboard-content');
  if (container) {
    container.innerHTML = '<p style="color:white; text-align:center;">Se încarcă clasamentul...</p>';
  }

  try {
    const { data, error } = await lbClient
      .from('LoginUsers')
      .select('name, wins_bulls_cows, wins_hangman, wins_memory, wins_macao, wins_razboi, wins_triangles')
      .order('name', { ascending: true });

    if (error) {
      console.error('Eroare la încărcarea clasamentului:', error.message);
      if (container) {
        container.innerHTML = '<p style="color:white; text-align:center;">Nu am putut încărca clasamentul.</p>';
      }
      return;
    }

    renderLeaderboard(data || []);
  } catch (e) {
    console.error('Eroare la încărcarea clasamentului:', e);
    if (container) {
      container.innerHTML = '<p style="color:white; text-align:center;">Nu am putut încărca clasamentul.</p>';
    }
  }
}
async function resetScores() {
  const container = document.getElementById('leaderboard-content');

  const ok = window.confirm('Sigur vrei să resetezi scorurile? Toate victoriile vor deveni 0.');
  if (!ok) return;

  if (container) {
    container.innerHTML = '<p style="color:white; text-align:center;">Resetez scorurile...</p>';
  }

  try {
    // Luăm întâi lista de utilizatori (cu id) ca să facem update filtrat,
    // nu un update "pe tot tabelul" – asta e mai prietenos cu politicile RLS.
    const { data, error: loadError } = await lbClient
      .from('LoginUsers')
      .select('id');

    if (loadError) {
      console.error('Eroare la citirea utilizatorilor pentru reset:', loadError.message || loadError);
      if (container) {
        container.innerHTML = '<p style="color:white; text-align:center;">Nu am putut reseta scorurile.</p>';
      }
      return;
    }

    if (!data || data.length === 0) {
      await loadLeaderboard();
      return;
    }

    const ids = data.map((u) => u.id).filter((id) => typeof id === 'number');
    if (!ids.length) {
      await loadLeaderboard();
      return;
    }

    const { error: updateError } = await lbClient
      .from('LoginUsers')
      .update({ wins_bulls_cows: 0, wins_hangman: 0, wins_memory: 0, wins_macao: 0, wins_razboi: 0, wins_triangles: 0 })
      .in('id', ids);

    if (updateError) {
      console.error('Eroare la resetarea scorurilor:', updateError.message || updateError);
      if (container) {
        container.innerHTML = '<p style="color:white; text-align:center;">Nu am putut reseta scorurile.</p>';
      }
      return;
    }

    await loadLeaderboard();
  } catch (e) {
    console.error('Eroare la resetarea scorurilor:', e);
    if (container) {
      container.innerHTML = '<p style="color:white; text-align:center;">Nu am putut reseta scorurile.</p>';
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  loadLeaderboard();

  const resetBtn = document.getElementById('reset-scores-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', resetScores);
  }
});
