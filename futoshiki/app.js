// ============================================================
// FUTOSHIKI PWA – App-Logik
// ============================================================
import { generatePuzzle } from './generator.js';
import { countSolutions } from './solver.js';

// ---------- DOM-Refs ----------
const $size = document.getElementById('size-select');
const $diff = document.getElementById('difficulty-select');
const $new  = document.getElementById('new-btn');
const $board= document.getElementById('board');
const $status = document.getElementById('status');
const $timer = document.getElementById('timer');

// ---------- Zustand ----------
let current = null;        // aktives Puzzle
let userValues = [];       // vom Nutzer eingegebene Zahlen (0 = leer)
let selectedIdx = -1;      // Index der ausgewählten Zelle
let timerHandle = null;
let startTs = 0;

// ---------- Initial ----------
window.addEventListener('DOMContentLoaded', () => {
  // Defaults sind 4x4 / Leicht (HTML-Defaults), trotzdem defensiv setzen:
  if (!$size.value) $size.value = '4';
  if (!$diff.value) $diff.value = 'easy';
  bindEvents();
  newPuzzle(); // direkt ein Puzzle laden
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => { /* offline optional */ });
  }
});

function bindEvents() {
  $new.addEventListener('click', newPuzzle);
  $size.addEventListener('change', newPuzzle);
  $diff.addEventListener('change', newPuzzle);
}

// ---------- Puzzle laden ----------
function newPuzzle() {
  stopTimer();
  const N = parseInt($size.value, 10);
  const diff = $diff.value;
  setStatus('Generiere Puzzle …', '');
  // requestAnimationFrame, damit Status sichtbar wird
  requestAnimationFrame(() => {
    try {
      current = generatePuzzle(N, diff);
      userValues = current.clues.slice();
      selectedIdx = -1;
      renderBoard();
      setStatus(``, `Puzzle bereit (${current.clueCount} Hinweise, ${current.constraints.length} Hinweis-Pfeile).`);
      startTimer();
    } catch (err) {
      console.error(err);
      setStatus('Fehler beim Generieren: ' + err.message, 'err');
    }
  });
}

// ---------- Rendering ----------
function renderBoard() {
  const N = current.N;
  $board.dataset.size = String(N);
  $board.innerHTML = '';

  // Constraint-Map: schnell lookup nach Gap-Position
  // gapKey(row, colSide) -> '<'|'>'|'∧'|'∨'
  const gapMap = buildGapMap(current.constraints, N);

  const rows = 2 * N - 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < rows; c++) {
      const isCellRow = (r % 2 === 0);
      const isCellCol = (c % 2 === 0);
      if (isCellRow && isCellCol) {
        const idx = (r / 2) * N + (c / 2);
        $board.appendChild(buildCell(idx));
      } else if (!isCellRow && !isCellCol) {
        const div = document.createElement('div');
        div.className = 'corner';
        $board.appendChild(div);
      } else if (isCellRow && !isCellCol) {
        // horizontaler Gap
        const cellCol = (c - 1) / 2;
        const cellRow = r / 2;
        const key = `h:${cellRow}:${cellCol}`;
        const sym = gapMap.get(key);
        const div = document.createElement('div');
        div.className = 'gap horizontal';
        if (sym) div.textContent = sym;
        $board.appendChild(div);
      } else {
        // vertikaler Gap
        const cellRow = (r - 1) / 2;
        const cellCol = c / 2;
        const key = `v:${cellRow}:${cellCol}`;
        const sym = gapMap.get(key);
        const div = document.createElement('div');
        div.className = 'gap vertical';
        if (sym) div.textContent = sym;
        $board.appendChild(div);
      }
    }
  }
}

function buildGapMap(constraints, N) {
  // op: '<' bedeutet grid[a] < grid[b]
  // Wir übersetzen in das sichtbare Symbol je Gap-Position.
  const m = new Map();
  for (const c of constraints) {
    const ra = Math.floor(c.a / N), ca = c.a % N;
    const rb = Math.floor(c.b / N), cb = c.b % N;
    if (ra === rb && Math.abs(ca - cb) === 1) {
      // horizontal
      const left = Math.min(ca, cb);
      if (ca < cb) {
        // a ist links, b ist rechts
        m.set(`h:${ra}:${left}`, c.op === '<' ? '<' : '>');
      } else {
        // a ist rechts, b ist links -> Symbol spiegeln
        m.set(`h:${ra}:${left}`, c.op === '<' ? '>' : '<');
      }
    } else if (ca === cb && Math.abs(ra - rb) === 1) {
      // vertikal
      const top = Math.min(ra, rb);
      if (ra < rb) {
        // a oben, b unten
        // a < b => kleiner oben => ∧ (öffnet nach oben)
        m.set(`v:${top}:${ca}`, c.op === '<' ? '∧' : '∨');
      } else {
        // a unten, b oben
        // a < b => kleiner unten => ∨ (öffnet nach unten)
        m.set(`v:${top}:${ca}`, c.op === '<' ? '∨' : '∧');
      }
    }
  }
  return m;
}

function buildCell(idx) {
  const div = document.createElement('div');
  div.className = 'cell';
  div.dataset.idx = String(idx);
  const isGiven = current.givens.has(idx);
  const v = userValues[idx];
  if (isGiven) div.classList.add('given');
  else div.classList.add('user');
  if (v !== 0) div.textContent = String(v);
  div.setAttribute('role', 'gridcell');
  div.setAttribute('tabindex', '0');

  // Tap-Zyklus auf editierbarer Zelle: aktueller Wert +1,
  // bei N -> leer (0), bei leer -> 1.
  div.addEventListener('click', () => {
    if (!isGiven) {
      const N = current.N;
      const cur = userValues[idx] || 0;
      const next = (cur >= N) ? 0 : cur + 1;
      setCellValue(idx, next);
    }
    selectCell(idx);
  });
  div.addEventListener('keydown', (e) => {
    if (isGiven) return;
    const k = e.key;
    if (/^[1-9]$/.test(k)) {
      const n = parseInt(k, 10);
      if (n >= 1 && n <= current.N) {
        setCellValue(idx, n);
        e.preventDefault();
      }
    } else if (k === 'Backspace' || k === 'Delete' || k === '0') {
      setCellValue(idx, 0);
      e.preventDefault();
    }
  });
  return div;
}

function selectCell(idx) {
  selectedIdx = idx;
  for (const el of $board.querySelectorAll('.cell')) {
    el.classList.toggle('selected', Number(el.dataset.idx) === idx);
  }
}

function setCellValue(idx, v) {
  if (current.givens.has(idx)) return; // Vorgaben sind unveränderlich
  userValues[idx] = v;
  const cellEl = $board.querySelector(`.cell[data-idx="${idx}"]`);
  if (cellEl) {
    // Erstes Text-Kind ist die Ziffer (kein Numpad-Button), daher:
    cellEl.firstChild && cellEl.firstChild.nodeType === 3
      ? (cellEl.firstChild.nodeValue = v === 0 ? '' : String(v))
      : (cellEl.insertBefore(document.createTextNode(v === 0 ? '' : String(v)), cellEl.firstChild || null));
    cellEl.classList.remove('ok', 'err');
  }
  checkAutoSolved();
}


// Zyklischer Tap-Inkrement: leer -> 1, n -> n+1, N -> leer (0).
function cycleCellValue(idx) {
  if (!current) return;
  if (current.givens.has(idx)) return; // Vorgaben sind geschützt
  const N = current.N;
  const cur = userValues[idx] || 0;
  const next = (cur >= N) ? 0 : cur + 1;
  setCellValue(idx, next);
}

// ---------- Aktionen ----------
function checkAutoSolved() {
  if (!current) return;
  const givens = new Set(current.givens);
  const grid = userValues.slice();
  let allFilled = true;
  for (let i = 0; i < grid.length; i++) if (grid[i] === 0) { allFilled = false; break; }
  if (allFilled && isValidComplete(grid, givens, current.constraints, current.N)) {
    for (let i = 0; i < grid.length; i++) {
      const el = $board.querySelector(`.cell[data-idx="${i}"]`);
      if (el) el.classList.add('ok');
    }
    setStatus('Gelöst! \uD83C\uDF89', 'ok');
    stopTimer();
  }
}

// Prüft ein vollständig gefülltes Grid gegen alle Futoshiki-Regeln:
//  - jeder Wert liegt im Bereich 1..N
//  - jede Zeile enthält jede Zahl 1..N genau einmal
//  - jede Spalte enthält jede Zahl 1..N genau einmal
//  - alle Ungleichheits-Constraints (grid[a] < grid[b] bzw. grid[a] > grid[b])
// Gibt true zurück, wenn das Grid alle Regeln erfüllt.
function isValidComplete(grid, givens, constraints, N) {
  // 1) Wertebereich
  for (let i = 0; i < grid.length; i++) {
    const v = grid[i];
    if (!Number.isInteger(v) || v < 1 || v > N) return false;
  }
  // 2) Zeilen-Eindeutigkeit (jede Zahl 1..N genau einmal)
  for (let r = 0; r < N; r++) {
    const seen = new Set();
    for (let c = 0; c < N; c++) {
      const v = grid[r * N + c];
      if (seen.has(v)) return false;
      seen.add(v);
    }
  }
  // 3) Spalten-Eindeutigkeit (jede Zahl 1..N genau einmal)
  for (let c = 0; c < N; c++) {
    const seen = new Set();
    for (let r = 0; r < N; r++) {
      const v = grid[r * N + c];
      if (seen.has(v)) return false;
      seen.add(v);
    }
  }
  // 4) Ungleichheits-Constraints
  for (const cn of constraints) {
    const va = grid[cn.a];
    const vb = grid[cn.b];
    if (cn.op === '<' && !(va < vb)) return false;
    if (cn.op === '>' && !(va > vb)) return false;
  }
  return true;
}

function markObviousErrors() {
  // Doppelte Werte in Zeile / Spalte markieren
  const N = current.N;
  for (let r = 0; r < N; r++) {
    const seen = new Map();
    for (let c = 0; c < N; c++) {
      const i = r * N + c;
      const v = userValues[i];
      if (v === 0) continue;
      if (seen.has(v)) {
        const j = seen.get(v);
        const e1 = $board.querySelector(`.cell[data-idx="${i}"]`);
        const e2 = $board.querySelector(`.cell[data-idx="${j}"]`);
        e1 && e1.classList.add('err');
        e2 && e2.classList.add('err');
      } else {
        seen.set(v, i);
      }
    }
  }
  for (let c = 0; c < N; c++) {
    const seen = new Map();
    for (let r = 0; r < N; r++) {
      const i = r * N + c;
      const v = userValues[i];
      if (v === 0) continue;
      if (seen.has(v)) {
        const j = seen.get(v);
        const e1 = $board.querySelector(`.cell[data-idx="${i}"]`);
        const e2 = $board.querySelector(`.cell[data-idx="${j}"]`);
        e1 && e1.classList.add('err');
        e2 && e2.classList.add('err');
      } else {
        seen.set(v, i);
      }
    }
  }
}

// ---------- Timer ----------
function startTimer() {
  startTs = Date.now();
  $timer.hidden = false;
  updateTimer();
  timerHandle = setInterval(updateTimer, 1000);
}
function stopTimer() {
  if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
  $timer.hidden = true;
}
function updateTimer() {
  const s = Math.floor((Date.now() - startTs) / 1000);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  $timer.textContent = `${mm}:${ss}`;
}

function setStatus(msg, kind) {
  $status.textContent = msg;
  $status.classList.remove('ok', 'err');
  if (kind === 'ok') $status.classList.add('ok');
  if (kind === 'err') $status.classList.add('err');
}
