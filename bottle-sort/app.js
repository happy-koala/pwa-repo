const COLORS = [
  '#ef4444', '#3b82f6', '#22c55e', '#eab308',
  '#a855f7', '#ec4899', '#14b8a6', '#f97316',
  '#84cc16', '#06b6d4'
];

const CAPACITY = 4;
let bottles = [];
let selectedIndex = null;
let moveCount = 0;
let level = 1;
let history = [];

const bottleContainer = document.getElementById('bottleContainer');
const moveCounterEl = document.getElementById('moveCounter');
const levelLabelEl = document.getElementById('levelLabel');
const winOverlay = document.getElementById('winOverlay');
const winStatsEl = document.getElementById('winStats');

function generateLevel(numColors) {
  let stacks;
  do {
    stacks = createSolvableStacks(numColors);
  } while (!stacks);
  return stacks;
}

function createSolvableStacks(numColors) {
  const numBottles = numColors + 2; // extra leere Flaschen
  const units = [];
  for (let c = 0; c < numColors; c++) {
    for (let i = 0; i < CAPACITY; i++) units.push(c);
  }
  // Shuffle
  for (let i = units.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [units[i], units[j]] = [units[j], units[i]];
  }

  const stacks = Array.from({ length: numBottles }, () => []);
  let idx = 0;
  for (let b = 0; b < numColors; b++) {
    for (let i = 0; i < CAPACITY; i++) {
      stacks[b].push(units[idx++]);
    }
  }
  // restliche Flaschen bleiben leer

  // Prüfen ob nicht bereits gelöst (jede Farbe komplett in einer Flasche)
  const alreadySolved = stacks.every(s => s.length === 0 || (s.length === CAPACITY && s.every(v => v === s[0])));
  if (alreadySolved) return null;

  return stacks;
}

function renderBottles() {
  bottleContainer.innerHTML = '';
  bottles.forEach((stack, i) => {
    const bottleEl = document.createElement('div');
    bottleEl.className = 'bottle';
    bottleEl.dataset.index = i;
    if (i === selectedIndex) bottleEl.classList.add('selected');

    // Segmente von unten nach oben rendern
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

    bottleEl.addEventListener('click', () => handleBottleClick(i));
    bottleContainer.appendChild(bottleEl);
  });
}

function handleBottleClick(index) {
  if (selectedIndex === null) {
    if (bottles[index].length === 0) return; // leere Flasche kann nicht Quelle sein
    selectedIndex = index;
    renderBottles();
    return;
  }

  if (selectedIndex === index) {
    selectedIndex = null;
    renderBottles();
    return;
  }

  const success = pourLiquid(selectedIndex, index);
  if (!success) {
    flashInvalid(index);
  }
  selectedIndex = null;
  renderBottles();

  if (success) {
    checkWin();
  }
}

function flashInvalid(index) {
  const el = bottleContainer.children[index];
  el.classList.add('invalid');
  setTimeout(() => el.classList.remove('invalid'), 300);
}

function pourLiquid(fromIdx, toIdx) {
  const from = bottles[fromIdx];
  const to = bottles[toIdx];

  if (from.length === 0) return false;
  if (to.length >= CAPACITY) return false;

  const topColor = from[from.length - 1];
  if (to.length > 0 && to[to.length - 1] !== topColor) return false;

  // Anzahl gleicher Farbe oben in "from"
  let count = 0;
  for (let i = from.length - 1; i >= 0; i--) {
    if (from[i] === topColor) count++;
    else break;
  }

  const space = CAPACITY - to.length;
  const amount = Math.min(count, space);

  if (amount <= 0) return false;

  // Speichere Historie
  history.push(JSON.parse(JSON.stringify(bottles)));

  for (let i = 0; i < amount; i++) {
    to.push(from.pop());
  }

  moveCount++;
  moveCounterEl.textContent = `Züge: ${moveCount}`;
  return true;
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
  const numColors = Math.min(4 + Math.floor(level / 2), COLORS.length);
  bottles = generateLevel(numColors);
  moveCount = 0;
  selectedIndex = null;
  history = [];
  moveCounterEl.textContent = `Züge: 0`;
  levelLabelEl.textContent = `Level ${level}`;
  winOverlay.classList.add('hidden');
  renderBottles();
}

function resetLevel() {
  if (history.length > 0) {
    bottles = JSON.parse(JSON.stringify(history[0]));
  }
  moveCount = 0;
  selectedIndex = null;
  history = [];
  moveCounterEl.textContent = `Züge: 0`;
  renderBottles();
}

function undoMove() {
  if (history.length === 0) return;
  bottles = history.pop();
  moveCount = Math.max(0, moveCount - 1);
  moveCounterEl.textContent = `Züge: ${moveCount}`;
  selectedIndex = null;
  renderBottles();
}

document.getElementById('newGameBtn').addEventListener('click', () => {
  newGame();
});

document.getElementById('resetBtn').addEventListener('click', resetLevel);
document.getElementById('undoBtn').addEventListener('click', undoMove);

document.getElementById('nextLevelBtn').addEventListener('click', () => {
  level++;
  newGame();
});

// Erste Runde starten, dabei erste Historie sichern
function initGame() {
  newGame();
  history = [JSON.parse(JSON.stringify(bottles))];
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
