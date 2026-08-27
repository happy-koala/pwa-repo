const COLORS = [
  '#ef4444', '#3b82f6', '#22c55e', '#eab308',
  '#a855f7', '#ec4899', '#14b8a6', '#f97316',
  '#84cc16', '#06b6d4', '#f43f5e', '#8b5cf6',
  '#0ea5e9', '#d946ef', '#65a30d', '#fb923c',
  '#4ade80', '#facc15', '#38bdf8', '#e879f9'
];

const CAPACITY = 4;
const BOTTLE_RATIO = 3.5; // Höhe = Breite * 3.5

let bottles = [];
let selectedIndex = null;
let moveCount = 0;
let level = 1;
let history = [];
let numColors = 6;
let customRows = 0; // 0 = automatisch
let customCols = 0;
let isAnimating = false;

const bottleContainer = document.getElementById('bottleContainer');
const moveCounterEl = document.getElementById('moveCounter');
const levelLabelEl = document.getElementById('levelLabel');
const winOverlay = document.getElementById('winOverlay');
const winStatsEl = document.getElementById('winStats');
const difficultySelect = document.getElementById('difficultySelect');
const customWrap = document.getElementById('customWrap');
const customColorsInput = document.getElementById('customColors');
const rowsInput = document.getElementById('rowsInput');
const colsInput = document.getElementById('colsInput');

difficultySelect.addEventListener('change', () => {
  const val = difficultySelect.value;
  customWrap.classList.toggle('hidden', val !== 'custom');
  switch (val) {
    case 'easy': numColors = 4; break;
    case 'medium': numColors = 6; break;
    case 'hard': numColors = 8; break;
    case 'extreme': numColors = 12; break;
    case 'custom': numColors = parseInt(customColorsInput.value) || 6; break;
  }
});

customColorsInput.addEventListener('input', () => {
  let v = parseInt(customColorsInput.value);
  if (isNaN(v)) v = 6;
  v = Math.max(2, Math.min(COLORS.length, v));
  numColors = v;
});

rowsInput.addEventListener('input', () => {
  customRows = Math.max(0, parseInt(rowsInput.value) || 0);
});

colsInput.addEventListener('input', () => {
  customCols = Math.max(0, parseInt(colsInput.value) || 0);
});

// Berechnet die Gesamtzahl der Flaschen basierend auf Zeilen/Spalten (falls gesetzt)
function getTotalBottleSlots(minRequired) {
  if (customRows > 0 && customCols > 0) {
    return customRows * customCols;
  }
  // automatisch: minRequired = Farben + 2 leere
  return minRequired;
}

function generateLevel(nColors) {
  let stacks;
  do {
    stacks = createSolvableStacks(nColors);
  } while (!stacks);
  return stacks;
}

function createSolvableStacks(nColors) {
  const minRequired = nColors + 2; // mind. Farben + 2 leere Flaschen nötig
  const totalSlots = getTotalBottleSlots(minRequired);

  // Falls Grid zu klein für die gewählte Farbenzahl ist, auf Minimum anheben
  const numBottles = Math.max(totalSlots, minRequired);

  const units = [];
  for (let c = 0; c < nColors; c++) {
    for (let i = 0; i < CAPACITY; i++) units.push(c);
  }
  for (let i = units.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [units[i], units[j]] = [units[j], units[i]];
  }

  const stacks = Array.from({ length: numBottles }, () => []);
  let idx = 0;
  for (let b = 0; b < nColors; b++) {
    for (let i = 0; i < CAPACITY; i++) {
      stacks[b].push(units[idx++]);
    }
  }
  // restliche Flaschen bleiben leer

  const alreadySolved = stacks.every(s => s.length === 0 || (s.length === CAPACITY && s.every(v => v === s[0])));
  if (alreadySolved) return null;

  return stacks;
}

// Bestimmt Spaltenanzahl fürs Grid-Layout
function determineCols(totalBottles) {
  if (customCols > 0) return customCols;
  const maxPerRow = window.innerWidth < 500 ? 5 : 8;
  let cols = Math.ceil(Math.sqrt(totalBottles));
  cols = Math.min(cols, maxPerRow, totalBottles);
  return Math.max(1, cols);
}

function updateGridSizing() {
  const total = bottles.length;
  const cols = determineCols(total);
  const rows = customRows > 0 ? customRows : Math.ceil(total / cols);

  bottleContainer.style.setProperty('--grid-cols', cols);

  const containerWidth = bottleContainer.clientWidth || (window.innerWidth - 24);
  const headerFooterHeight = 260;
  const availableHeight = Math.max(200, window.innerHeight - headerFooterHeight);

  const gap = cols > 8 ? 8 : cols > 5 ? 12 : 16;
  bottleContainer.style.setProperty('--grid-gap', gap + 'px');

  // Breite aus Spaltenzahl
  const totalGapWidth = gap * (cols - 1);
  let bottleW = Math.floor((containerWidth - totalGapWidth) / cols * 0.8);

  // Höhe aus Zeilenzahl
  const totalGapHeight = gap * (rows - 1);
  let bottleHFromRows = Math.floor((availableHeight - totalGapHeight) / rows * 0.9);

  // Feste Seitenverhältnis-Berechnung: Höhe = Breite * RATIO
  let bottleHFromRatio = bottleW * BOTTLE_RATIO;

  // Den limitierenden Faktor nehmen (damit es nie überläuft)
  let bottleH = Math.min(bottleHFromRows, bottleHFromRatio);
  bottleW = bottleH / BOTTLE_RATIO;

  // Sinnvolle Grenzen
  bottleW = Math.max(18, Math.min(70, bottleW));
  bottleH = bottleW * BOTTLE_RATIO;

  bottleContainer.style.setProperty('--bottle-w', bottleW + 'px');
  bottleContainer.style.setProperty('--bottle-h', bottleH + 'px');
  bottleContainer.style.setProperty('--seg-count', CAPACITY);
}

function renderBottles() {
  bottleContainer.innerHTML = '';
  bottles.forEach((stack, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'bottle-wrap';
    wrap.dataset.index = i;
    if (i === selectedIndex) wrap.classList.add('selected');

    const bottleEl = document.createElement('div');
    bottleEl.className = 'bottle';

    for (let s = 0; s < CAPACITY; s++) {
      const seg = document.createElement('div');
      seg.className = 'segment';
      if (s < stack.length) {
        seg.style.background = COLORS[stack[s]];
      } else {
        seg.style.background = 'transparent';
      }
      bottleEl.appendChild(seg);
    }

    wrap.appendChild(bottleEl);
    wrap.addEventListener('click', () => handleBottleClick(i));
    bottleContainer.appendChild(wrap);
  });

  updateGridSizing();
}

function handleBottleClick(index) {
  if (isAnimating) return;

  if (selectedIndex === null) {
    if (bottles[index].length === 0) return;
    selectedIndex = index;
    renderBottles();
    return;
  }

  if (selectedIndex === index) {
    selectedIndex = null;
    renderBottles();
    return;
  }

  const fromIdx = selectedIndex;
  const toIdx = index;
  selectedIndex = null;

  const info = getPourInfo(fromIdx, toIdx);
  if (!info.valid) {
    flashInvalid(toIdx);
    renderBottles();
    return;
  }

  animatePour(fromIdx, toIdx, info, () => {
    renderBottles();
    checkWin();
  });
}

function flashInvalid(index) {
  renderBottles();
  const el = bottleContainer.children[index];
  if (!el) return;
  el.classList.add('invalid');
  setTimeout(() => el.classList.remove('invalid'), 300);
}

function getPourInfo(fromIdx, toIdx) {
  const from = bottles[fromIdx];
  const to = bottles[toIdx];

  if (from.length === 0) return { valid: false };
  if (to.length >= CAPACITY) return { valid: false };

  const topColor = from[from.length - 1];
  if (to.length > 0 && to[to.length - 1] !== topColor) return { valid: false };

  let count = 0;
  for (let i = from.length - 1; i >= 0; i--) {
    if (from[i] === topColor) count++;
    else break;
  }

  const space = CAPACITY - to.length;
  const amount = Math.min(count, space);

  if (amount <= 0) return { valid: false };

  return { valid: true, amount, color: topColor };
}

function animatePour(fromIdx, toIdx, info, callback) {
  isAnimating = true;
  const fromWrap = bottleContainer.children[fromIdx];
  const toWrap = bottleContainer.children[toIdx];

  const fromRect = fromWrap.getBoundingClientRect();
  const toRect = toWrap.getBoundingClientRect();

  const movingRight = fromRect.left < toRect.left;
  const dx = (toRect.left - fromRect.left) + (movingRight ? 20 : -20);
  const dy = -Math.max(50, fromRect.height * 0.35);

  fromWrap.classList.add('pouring-from');
  fromWrap.style.transition = 'transform 0.4s ease';
  fromWrap.style.transform = `translate(${dx}px, ${dy}px) rotate(${movingRight ? -80 : 80}deg)`;

  const stream = document.createElement('div');
  stream.className = 'pour-stream';
  stream.style.background = COLORS[info.color];
  stream.style.height = Math.max(20, fromRect.height * 0.2) + 'px';
  stream.style.left = (toRect.left + toRect.width / 2 - 3) + 'px';
  stream.style.top = (toRect.top - 10) + 'px';
  document.body.appendChild(stream);

  setTimeout(() => {
    history.push(JSON.parse(JSON.stringify(bottles)));
    const from = bottles[fromIdx];
    const to = bottles[toIdx];
    for (let i = 0; i < info.amount; i++) {
      to.push(from.pop());
    }
    moveCount++;
    moveCounterEl.textContent = `Züge: ${moveCount}`;

    updateSegmentsOnly(fromIdx, toIdx);

    setTimeout(() => {
      fromWrap.style.transform = '';
      stream.remove();
      setTimeout(() => {
        fromWrap.classList.remove('pouring-from');
        fromWrap.style.transition = '';
        isAnimating = false;
        callback();
      }, 250);
    }, 220);
  }, 380);
}

function updateSegmentsOnly(fromIdx, toIdx) {
  [fromIdx, toIdx].forEach(idx => {
    const wrap = bottleContainer.children[idx];
    if (!wrap) return;
    const bottleEl = wrap.querySelector('.bottle');
    const segs = bottleEl.querySelectorAll('.segment');
    const stack = bottles[idx];
    segs.forEach((seg, s) => {
      seg.style.background = s < stack.length ? COLORS[stack[s]] : 'transparent';
    });
  });
}

function checkWin() {
  const solved = bottles.every(stack =>
    stack.length === 0 || (stack.length === CAPACITY && stack.every(v => v === stack[0]))
  );
  if (solved) {
    winStatsEl.textContent = `Level ${level} in ${moveCount} Zügen gelöst!`;
    winOverlay.classList.remove('hidden');
    launchConfetti();
  }
}

function newGame() {
  bottles = generateLevel(numColors);
  moveCount = 0;
  selectedIndex = null;
  history = [];
  moveCounterEl.textContent = `Züge: 0`;
  levelLabelEl.textContent = `Level ${level} (${numColors} Farben, ${bottles.length} Flaschen)`;
  winOverlay.classList.add('hidden');
  renderBottles();
  history = [JSON.parse(JSON.stringify(bottles))];
}

function resetLevel() {
  if (history.length > 0) {
    bottles = JSON.parse(JSON.stringify(history[0]));
  }
  moveCount = 0;
  selectedIndex = null;
  history = [JSON.parse(JSON.stringify(bottles))];
  moveCounterEl.textContent = `Züge: 0`;
  renderBottles();
}

function undoMove() {
  if (history.length <= 1) return;
  history.pop();
  bottles = JSON.parse(JSON.stringify(history[history.length - 1]));
  moveCount = Math.max(0, moveCount - 1);
  moveCounterEl.textContent = `Züge: ${moveCount}`;
  selectedIndex = null;
  renderBottles();
}

document.getElementById('newGameBtn').addEventListener('click', () => {
  level = 1;
  newGame();
});

document.getElementById('resetBtn').addEventListener('click', resetLevel);
document.getElementById('undoBtn').addEventListener('click', undoMove);

document.getElementById('nextLevelBtn').addEventListener('click', () => {
  level++;
  newGame();
});

let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(updateGridSizing, 150);
});

function initGame() {
  newGame();
}

initGame();

// ==== Konfetti-Effekt ====
const canvas = document.getElementById('confettiCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

function launchConfetti() {
  const particles = [];
  for (let i = 0; i < 150; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: -20,
      r: Math.random() * 6 + 4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      speed: Math.random() * 3 + 2,
      angle: Math.random() * Math.PI * 2,
      spin: Math.random() * 0.2 - 0.1
    });
  }

  let frame = 0;
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.y += p.speed;
      p.angle += p.spin;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r);
      ctx.restore();
    });
    frame++;
    if (frame < 150) {
      requestAnimationFrame(animate);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
  animate();
}

// ==== Service Worker Registrierung ====
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then(() => console.log('Service Worker registriert'))
      .catch(err => console.log('SW Fehler:', err));
  });
}