/* =========================================
   MEMORIA — game.js
   Full game logic: board, flip, match, timer
   ========================================= */

'use strict';

/* ── Symbol pools ── */
const ALL_SYMBOLS = [
  '🌙', '🌿', '🦋', '🔮', '🌸', '🦚', '🌺', '🐚',
  '🍄', '🌊', '🦜', '🌻', '🐉', '🌹', '🦩', '🕊️',
  '🪷', '🌴', '🐦', '🌛',
];

/* ── State ── */
let flipped    = [];   // at most 2 cards being compared
let matched    = 0;
let moves      = 0;
let totalPairs = 8;
let locked     = false;
let timerID    = null;
let seconds    = 0;
let started    = false;
let bestTimes  = {};   // keyed by totalPairs

/* ── DOM shortcuts ── */
const board       = document.getElementById('board');
const movesEl     = document.getElementById('moves');
const pairsEl     = document.getElementById('pairs');
const timerEl     = document.getElementById('timer');
const bestEl      = document.getElementById('best');
const modal       = document.getElementById('modal');
const finalMoves  = document.getElementById('final-moves');
const finalTime   = document.getElementById('final-time');
const finalScore  = document.getElementById('final-score');
const playAgainBtn= document.getElementById('playAgainBtn');
const diffBtns    = document.querySelectorAll('.diff-btn');

/* ── Load persisted bests ── */
try {
  bestTimes = JSON.parse(localStorage.getItem('memoriaBest') || '{}');
} catch { bestTimes = {}; }

/* ─────────────────────────────────────────
   BOARD SETUP
───────────────────────────────────────── */
function buildBoard() {
  // Reset state
  flipped = [];
  matched = 0;
  moves   = 0;
  seconds = 0;
  started = false;
  locked  = false;
  clearInterval(timerID);

  // Pick symbols
  const symbols = shuffle(ALL_SYMBOLS).slice(0, totalPairs);
  const cards   = shuffle([...symbols, ...symbols]);

  // Update HUD
  movesEl.textContent = '0';
  pairsEl.textContent = `0 / ${totalPairs}`;
  timerEl.textContent = '0:00';
  updateBestDisplay();

  // Grid columns: sqrt-ish, always even
  const cols = totalPairs <= 6 ? 4 : totalPairs <= 8 ? 4 : 5;
  board.style.gridTemplateColumns = `repeat(${cols}, var(--card-size))`;

  // Clear board
  board.innerHTML = '';

  // Create cards with staggered appear animation
  cards.forEach((symbol, i) => {
    const card = createCard(symbol, i);
    board.appendChild(card);
  });
}

function createCard(symbol, index) {
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.symbol = symbol;
  card.style.animationDelay = `${index * 40}ms`;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', 'Memory card');
  card.setAttribute('tabindex', '0');

  card.innerHTML = `
    <div class="card-inner">
      <div class="card-face card-back"></div>
      <div class="card-face card-front">${symbol}</div>
    </div>
  `;

  card.addEventListener('click', () => handleFlip(card));
  card.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleFlip(card);
    }
  });

  // Mouse-move shine on card front
  card.addEventListener('mousemove', e => {
    const rect = card.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top)  / rect.height) * 100;
    card.style.setProperty('--shine-x', `${x}%`);
    card.style.setProperty('--shine-y', `${y}%`);
  });

  return card;
}

/* ─────────────────────────────────────────
   FLIP LOGIC
───────────────────────────────────────── */
function handleFlip(card) {
  if (locked) return;
  if (card.classList.contains('flipped')) return;
  if (card.classList.contains('matched')) return;
  if (flipped.length === 2) return;

  // Start timer on first flip
  if (!started) {
    started = true;
    timerID = setInterval(tickTimer, 1000);
  }

  card.classList.add('flipped');
  card.setAttribute('aria-label', card.dataset.symbol);
  flipped.push(card);

  if (flipped.length === 2) {
    moves++;
    movesEl.textContent = moves;
    bump('moves');
    checkMatch();
  }
}

function checkMatch() {
  const [a, b] = flipped;
  if (a.dataset.symbol === b.dataset.symbol) {
    // ✅ Match
    setTimeout(() => {
      a.classList.add('matched');
      b.classList.add('matched');
      a.setAttribute('aria-label', `${a.dataset.symbol} matched`);
      b.setAttribute('aria-label', `${b.dataset.symbol} matched`);
      flipped = [];
      matched++;
      pairsEl.textContent = `${matched} / ${totalPairs}`;
      bump('pairs');
      if (matched === totalPairs) endGame();
    }, 400);
  } else {
    // ❌ No match — flip back
    locked = true;
    a.classList.add('wrong');
    b.classList.add('wrong');
    setTimeout(() => {
      a.classList.remove('flipped', 'wrong');
      b.classList.remove('flipped', 'wrong');
      a.setAttribute('aria-label', 'Memory card');
      b.setAttribute('aria-label', 'Memory card');
      flipped = [];
      locked  = false;
    }, 900);
  }
}

/* ─────────────────────────────────────────
   TIMER
───────────────────────────────────────── */
function tickTimer() {
  seconds++;
  timerEl.textContent = formatTime(seconds);
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/* ─────────────────────────────────────────
   END GAME
───────────────────────────────────────── */
function endGame() {
  clearInterval(timerID);

  // Calculate score: higher = better
  const score = Math.max(0, Math.round(10000 / (moves * 0.4 + seconds * 0.6)));

  // Update best time
  const key = String(totalPairs);
  if (!bestTimes[key] || seconds < bestTimes[key]) {
    bestTimes[key] = seconds;
    try { localStorage.setItem('memoriaBest', JSON.stringify(bestTimes)); } catch {}
  }
  updateBestDisplay();

  // Show modal
  finalMoves.textContent  = moves;
  finalTime.textContent   = formatTime(seconds);
  finalScore.textContent  = score.toLocaleString();
  modal.removeAttribute('aria-hidden');
  modal.classList.add('show');
}

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function bump(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
  setTimeout(() => el.classList.remove('bump'), 200);
}

function updateBestDisplay() {
  const key  = String(totalPairs);
  const best = bestTimes[key];
  bestEl.textContent = best !== undefined ? formatTime(best) : '—';
}

/* ─────────────────────────────────────────
   EVENT LISTENERS
───────────────────────────────────────── */

// Difficulty buttons
diffBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    diffBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    totalPairs = parseInt(btn.dataset.pairs, 10);
    buildBoard();
  });
});

// Play again (inside modal)
playAgainBtn.addEventListener('click', () => {
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden', 'true');
  setTimeout(buildBoard, 300);
});

// Close modal on overlay click
modal.addEventListener('click', e => {
  if (e.target === modal) playAgainBtn.click();
});

/* ─────────────────────────────────────────
   INIT
───────────────────────────────────────── */
buildBoard();
