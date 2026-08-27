(() => {
  'use strict';

  const CAPACITY = 4;
  const PALETTE = ['#eb674d','#f3a43b','#f5d547','#9acb52','#42b883','#27a7a0','#3c91c9','#5367c9','#8355b8','#bd5799','#e85d8b','#ec7f9c','#9b684d','#6f8790','#d45c32','#86b84d','#19a997','#4271a8','#7560a8','#b34862'];
  const $ = id => document.getElementById(id);
  let bottles = [], history = [], selected = null, moves = 0, level = 0, animating = false;
  let confettiFrame = 0;

  function fillSelects() {
    const rows = $('rowsSelect'), cols = $('colsSelect');
    rows.innerHTML = ''; cols.innerHTML = '';
    for (let value = 2; value <= 8; value++) rows.add(new Option(String(value), String(value), value === 4, value === 4));
    for (let value = 2; value <= 10; value++) cols.add(new Option(String(value), String(value), value === 5, value === 5));
  }

  function colorCount() {
    const control = $('difficulty');
    const value = control.value === 'custom' ? $('customColors').value : control.value;
    return Math.max(2, Math.min(20, Number(value) || 6));
  }

  function makeSolved(total, count) {
    const result = [];
    for (let color = 0; color < count; color++) result.push(Array(CAPACITY).fill(color));
    while (result.length < total) result.push([]);
    return result;
  }

  function topRun(bottle) {
    if (!bottle.length) return 0;
    const color = bottle[bottle.length - 1];
    let run = 0;
    while (run < bottle.length && bottle[bottle.length - 1 - run] === color) run++;
    return run;
  }

  function canPour(from, to) {
    if (from === to || !bottles[from]?.length || bottles[to]?.length === CAPACITY) return false;
    const source = bottles[from], target = bottles[to];
    return !target.length || target[target.length - 1] === source[source.length - 1];
  }

  function pour(from, to) {
    if (!canPour(from, to)) return 0;
    const source = bottles[from], target = bottles[to];
    const amount = Math.min(topRun(source), CAPACITY - target.length);
    for (let i = 0; i < amount; i++) target.push(source.pop());
    return amount;
  }

  function reverseMixSolvedState(total, count) {
    bottles = makeSolved(total, count);
    const rounds = Math.max(120, total * count * 16);
    let lastFrom = -1, lastTo = -1;
    for (let round = 0; round < rounds; round++) {
      const candidates = [];
      for (let from = 0; from < total; from++) {
        const run = topRun(bottles[from]);
        if (!run) continue;
        for (let to = 0; to < total; to++) {
          const room = CAPACITY - bottles[to].length;
          const reversibleAmount = run === bottles[from].length ? run : run - 1;
          const maxAmount = Math.min(reversibleAmount, room);
          if (from !== to && maxAmount > 0 && from !== lastTo && to !== lastFrom) candidates.push([from, to, maxAmount]);
        }
      }
      if (!candidates.length) break;
      const [from, to, maxAmount] = candidates[Math.floor(Math.random() * candidates.length)];
      const amount = 1 + Math.floor(Math.random() * maxAmount);
      for (let i = 0; i < amount; i++) bottles[to].push(bottles[from].pop());
      lastFrom = from; lastTo = to;
    }
    if (bottles.every(bottle => !bottle.length || (bottle.length === CAPACITY && bottle.every(color => color === bottle[0])))) {
      for (let from = 0; from < total; from++) {
        if (topRun(bottles[from]) > 1) {
          const to = bottles.findIndex((bottle, index) => index !== from && bottle.length < CAPACITY);
          if (to >= 0) { bottles[to].push(bottles[from].pop()); break; }
        }
      }
    }
  }

  function generateLevel() {
    const rows = Number($('rowsSelect').value), cols = Number($('colsSelect').value);
    const total = rows * cols, count = Math.min(colorCount(), total - 2);
    reverseMixSolvedState(total, count);
    history = []; moves = 0; selected = null; level++;
    $('winOverlay').classList.add('hidden');
    $('hint').textContent = 'Wähle eine Quellflasche.';
    render(); updateGridSizing();
  }

  function render() {
    const board = $('board');
    board.innerHTML = '';
    const total = bottles.length, count = Math.min(colorCount(), total - 2);
    $('levelLabel').textContent = `Level ${level} (${rowsSelect.value}×${colsSelect.value} = ${total} Flaschen, ${count} Farben)`;
    $('moveCount').textContent = String(moves);
    $('puzzleNo').textContent = String(level).padStart(3, '0');
    $('undo').disabled = history.length === 0;
    bottles.forEach((bottle, index) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'bottle' + (index === selected ? ' selected' : '');
      button.dataset.index = String(index);
      button.setAttribute('aria-label', `Flasche ${index + 1}, ${bottle.length} von ${CAPACITY} Einheiten`);
      button.setAttribute('aria-pressed', String(index === selected));
      bottle.forEach(color => {
        const layer = document.createElement('span'); layer.className = 'layer';
        layer.style.backgroundColor = PALETTE[color % PALETTE.length];
        layer.setAttribute('aria-hidden', 'true'); button.appendChild(layer);
      });
      button.addEventListener('click', () => chooseBottle(index));
      board.appendChild(button);
    });
  }

  function chooseBottle(index) {
    if (animating) return;
    if (selected === null) {
      if (!bottles[index].length) { $('hint').textContent = 'Diese Flasche ist leer.'; return; }
      selected = index; $('hint').textContent = 'Jetzt eine Zielflasche wählen.'; render(); return;
    }
    if (index === selected) { selected = null; $('hint').textContent = 'Wähle eine Quellflasche.'; render(); return; }
    if (!canPour(selected, index)) { $('hint').textContent = 'Dieser Zug ist nicht möglich.'; return; }
    history.push(bottles.map(bottle => bottle.slice()));
    const sourceIndex = selected;
    const sourceElement = document.querySelector(`[data-index="${sourceIndex}"]`);
    if (sourceElement) sourceElement.classList.add('pouring');
    animating = true;
    window.setTimeout(() => {
      pour(sourceIndex, index); moves++; selected = null; animating = false;
      render(); updateGridSizing(); $('hint').textContent = 'Wähle eine Quellflasche.';
      if (isSolved()) showWin();
    }, 520);
  }

  function isSolved() {
    const counts = new Map();
    for (const bottle of bottles) {
      if (!bottle.length) continue;
      if (bottle.length !== CAPACITY || bottle.some(color => color !== bottle[0])) return false;
      counts.set(bottle[0], (counts.get(bottle[0]) || 0) + 1);
    }
    const expected = Math.min(colorCount(), bottles.length - 2);
    return counts.size === expected && [...counts.values()].every(value => value === 1);
  }

  function undo() {
    if (animating || !history.length) return;
    bottles = history.pop(); moves = Math.max(0, moves - 1); selected = null;
    $('hint').textContent = 'Zug rückgängig gemacht.'; render(); updateGridSizing();
  }

  function updateGridSizing() {
    const rows = Number($('rowsSelect').value), cols = Number($('colsSelect').value), board = $('board');
    const gap = Math.min(30, Math.max(10, window.innerWidth * 0.022));
    const availableWidth = Math.max(44, (board.clientWidth - (cols - 1) * gap) / cols);
    const availableHeight = Math.max(80, (board.clientHeight - (rows - 1) * gap) / rows / 2.6);
    const width = Math.max(34, Math.min(availableWidth, availableHeight));
    document.documentElement.style.setProperty('--cols', String(cols));
    document.documentElement.style.setProperty('--bottle-w', `${width}px`);
    document.documentElement.style.setProperty('--bottle-h', `${width * 2.6}px`);
  }

  function showWin() {
    $('winText').textContent = `${moves} Züge · Level ${level}`;
    $('winOverlay').classList.remove('hidden'); startConfetti();
  }

  function startConfetti() {
    const canvas = $('confetti'), context = canvas.getContext('2d');
    if (!context) return;
    cancelAnimationFrame(confettiFrame);
    const ratio = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * ratio; canvas.height = window.innerHeight * ratio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const pieces = Array.from({ length: 120 }, () => ({
      x: window.innerWidth / 2 + (Math.random() - .5) * 180, y: window.innerHeight * .34,
      vx: (Math.random() - .5) * 8, vy: -Math.random() * 9 - 3,
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)], size: Math.random() * 5 + 2, angle: Math.random() * 6
    }));
    let frame = 0;
    const draw = () => {
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);
      pieces.forEach(piece => { piece.x += piece.vx; piece.vy += .25; piece.y += piece.vy; piece.angle += .12; context.save(); context.translate(piece.x, piece.y); context.rotate(piece.angle); context.fillStyle = piece.color; context.fillRect(0, 0, piece.size, piece.size * 1.8); context.restore(); });
      if (frame++ < 220 && !$('winOverlay').classList.contains('hidden')) confettiFrame = requestAnimationFrame(draw);
    };
    draw();
  }

  function bindEvents() {
    $('difficulty').addEventListener('change', () => { $('customWrap').classList.toggle('hidden', $('difficulty').value !== 'custom'); generateLevel(); });
    $('customColors').addEventListener('change', generateLevel);
    $('rowsSelect').addEventListener('change', generateLevel);
    $('colsSelect').addEventListener('change', generateLevel);
    $('newGame').addEventListener('click', generateLevel);
    $('playAgain').addEventListener('click', generateLevel);
    $('undo').addEventListener('click', undo);
    window.addEventListener('resize', updateGridSizing);
  }

  fillSelects(); bindEvents(); generateLevel();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js').catch(() => {});
})();