// leaderboard.js
// Afișează victoriile pentru Andrei și Georgiana din tabela LoginUsers

const SUPABASE_URL = 'https://nzkihyaifxkfccwgiilp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_5oxupUfCOgvdMAe0guBQWQ_XKfwq6dL';

const lbClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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
      return `
        <div class="leaderboard-row">
          <div class="leaderboard-name">${name}</div>
          <div class="leaderboard-stat">
            <span class="lb-label">Bulls &amp; Cows</span>
            <span class="lb-value">${bulls}</span>
          </div>
          <div class="leaderboard-stat">
            <span class="lb-label">Spânzurătoarea</span>
            <span class="lb-value">${hangman}</span>
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
      .select('name, wins_bulls_cows, wins_hangman')
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

window.addEventListener('DOMContentLoaded', loadLeaderboard);
