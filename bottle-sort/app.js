'use strict';

const CAPACITY = 4;
const COLORS = [
  '#e45756', '#f28e2b', '#f2c94c', '#6fcf97', '#27ae60', '#2d9cdb',
  '#2f80ed', '#9b51e0', '#bb6bd9', '#eb5757', '#56ccf2', '#8d6e63'
];
const COLOR_NAMES = ['Koralle', 'Mandarine', 'Sonne', 'Minze', 'Grün', 'Türkis', 'Blau', 'Violett', 'Lila', 'Rosa', 'Himmel', 'Kakao'];

const els = {};
let state = { rows: 4, columns: 5, colorCount: 6, bottles: [], selected: null, moves: 0, history: [], won: false, animating: false };

function $(id) { return document.getElementById(id); }
function cloneBottles(bottles) { return bottles.map(bottle => bottle.slice()); }
function topColor(bottle) { return bottle[bottle.length - 1]; }
function topRunLength(bottle) {
  if (!bottle.length) return 0;
  const color = topColor(bottle);
  let count = 0;
  for (let i = bottle.length - 1; i >= 0 && bottle[i] === color; i -= 1) count += 1;
  return count;
}
function isComplete(bottle) { return bottle.length === 0 || (new Set(bottle).size === 1); }
function canPour(bottles, from, to) {
  if (from === to || !bottles[from].length || bottles[to].length === CAPACITY) return false;
  return !bottles[to].length || topColor(bottles[from]) === topColor(bottles[to]);
}
function pour(bottles, from, to) {
  const amount = Math.min(topRunLength(bottles[from]), CAPACITY - bottles[to].length);
  const moved = bottles[from].splice(bottles[from].length - amount, amount);
  bottles[to].push(...moved);
  return amount;
}

function colorUnits(totalUnits, colorCount) {
  const active = Math.min(colorCount, Math.max(1, Math.floor(totalUnits / CAPACITY)));
  const groups = Array.from({ length: active }, () => 1);
  for (let i = active; i < totalUnits / CAPACITY; i += 1) groups[Math.floor(Math.random() * active)] += 1;
  return groups.map((groupsForColor, index) => Array(groupsForColor * CAPACITY).fill(index));
}
function shuffled(items) {
  for (let i = items.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
  return items;
}
function generateBottles(rows, columns, colorCount) {
  const count = rows * columns;
  const units = colorUnits((count - 2) * CAPACITY, colorCount).flat();
  shuffled(units);
  const bottles = Array.from({ length: count }, () => []);
  units.forEach((color, index) => bottles[index % count].push(color));
  shuffled(bottles);
  return bottles;
}

function isSolved(bottles) { return bottles.every(isComplete); }
function stateKey(bottles) { return bottles.map(bottle => bottle.join('')).join('|'); }
function rudimentarySolvability(bottles) {
  if (bottles.some(bottle => bottle.length > CAPACITY)) return false;
  const counts = new Map();
  bottles.flat().forEach(color => counts.set(color, (counts.get(color) || 0) + 1));
  if ([...counts.values()].some(count => count % CAPACITY !== 0)) return false;
  if (bottles.reduce((sum, bottle) => sum + bottle.length, 0) !== (bottles.length - 2) * CAPACITY) return false;
  if (isSolved(bottles)) return true;
  return bottles.some((_, from) => bottles.some((__, to) => canPour(bottles, from, to)));
}
function makePuzzle(rows, columns, colorCount) {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const candidate = generateBottles(rows, columns, colorCount);
    if (rudimentarySolvability(candidate)) return candidate;
  }
  return generateBottles(rows, columns, colorCount);
}

function render() {
  els.board.style.setProperty('--bottle-width', `${Math.max(28, Math.min(70, Math.floor(100 / state.columns) - 7))}px`);
  els.board.style.gridTemplateColumns = `repeat(${state.columns}, minmax(0, 1fr))`;
  els.board.replaceChildren();
  state.bottles.forEach((bottle, index) => {
    const button = document.createElement('button'); button.className = 'bottle'; button.type = 'button';
    button.setAttribute('aria-label', `Flasche ${index + 1}${bottle.length ? `, oben ${COLOR_NAMES[topColor(bottle)]}` : ', leer'}`);
    if (state.selected === index) button.classList.add('selected');
    if (state.animating && (state.selected === index)) button.classList.add('tilt');
    const glass = document.createElement('span'); glass.className = 'glass';
    bottle.forEach(color => { const layer = document.createElement('span'); layer.className = 'layer'; layer.style.backgroundColor = COLORS[color]; glass.appendChild(layer); });
    button.appendChild(glass); button.addEventListener('click', () => selectBottle(index)); els.board.appendChild(button);
  });
  els.moves.textContent = String(state.moves);
  els.undo.disabled = state.history.length === 0 || state.animating;
  els.board.setAttribute('aria-label', `${state.bottles.length} Flaschen, ${state.moves} Züge`);
}
function selectBottle(index) {
  if (state.animating || state.won) return;
  if (state.selected === null) { if (state.bottles[index].length) { state.selected = index; render(); } return; }
  if (state.selected === index) { state.selected = null; render(); return; }
  if (!canPour(state.bottles, state.selected, index)) { state.selected = state.bottles[index].length ? index : null; render(); return; }
  state.history.push(cloneBottles(state.bottles)); state.animating = true; render();
  const from = state.selected; state.selected = null;
  window.setTimeout(() => { pour(state.bottles, from, index); state.moves += 1; state.animating = false; state.won = isSolved(state.bottles); render(); if (state.won) showWin(); }, 220);
}
function showWin() { els.winMoves.textContent = `${state.moves} ${state.moves === 1 ? 'Zug' : 'Züge'}`; els.overlay.hidden = false; }
function newGame() { state = { rows: Number(els.rows.value), columns: Number(els.columns.value), colorCount: Number(els.colors.value), bottles: [], selected: null, moves: 0, history: [], won: false, animating: false }; state.bottles = makePuzzle(state.rows, state.columns, state.colorCount); els.overlay.hidden = true; render(); }
function undo() { if (!state.history.length || state.animating) return; state.bottles = state.history.pop(); state.moves = Math.max(0, state.moves - 1); state.selected = null; state.won = false; els.overlay.hidden = true; render(); }
function init() {
  Object.assign(els, { rows: $('rows'), columns: $('columns'), colors: $('colors'), board: $('board'), moves: $('move-count'), undo: $('undo'), newGame: $('new-game'), overlay: $('win-overlay'), winMoves: $('win-moves'), winNew: $('win-new') });
  els.newGame.addEventListener('click', newGame); els.winNew.addEventListener('click', newGame); els.undo.addEventListener('click', undo); newGame();
}
document.addEventListener('DOMContentLoaded', init);