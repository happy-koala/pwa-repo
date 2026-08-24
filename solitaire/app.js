(() => {
  'use strict';

  const suits = ['♠', '♥', '♦', '♣'];
  const redSuits = new Set(['♥', '♦']);
  const rankNames = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  const board = document.getElementById('board');
  const topRow = document.getElementById('topRow');
  const tableauRow = document.getElementById('tableauRow');
  const movesEl = document.getElementById('movesEl');
  const timerEl = document.getElementById('timerEl');
  const solveBtn = document.getElementById('solveBtn');
  const winOverlay = document.getElementById('winOverlay');
  const winStats = document.getElementById('winStats');

  let state;
  let history = [];
  let dragData = null;
  let timer = null;
  let startedAt = 0;

  const clone = (v) => JSON.parse(JSON.stringify(v));

  function newGame() {
    const color =
      Math.random() < 0.5
        ? { light: '#b91c1c', dark: '#7a1212' }
        : { light: '#1d4ed8', dark: '#15339e' };

    document.documentElement.style.setProperty('--back-color-dark', color.light);
    document.documentElement.style.setProperty('--btn-color', color.dark);

    const deck = [];

    suits.forEach((s, si) => {
      for (let r = 1; r <= 13; r++) {
        deck.push({
          rank: r,
          suit: s,
          color: redSuits.has(s) ? 'red' : 'black',
          faceUp: false,
          id: si * 13 + r
        });
      }
    });

    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    state = {
      stock: [],
      waste: [],
      foundations: [[], [], [], []],
      tableau: [[], [], [], [], [], [], []],
      moves: 0
    };

    for (let c = 0; c < 7; c++) {
      for (let n = 0; n <= c; n++) {
        const card = deck.pop();
        card.faceUp = n === c;
        state.tableau[c].push(card);
      }
    }

    state.stock = deck;
    history = [];
    startedAt = Date.now();

    clearInterval(timer);
    timer = setInterval(updateTimer, 1000);

    winOverlay?.classList.remove('show');

    render();
  }

  function updateTimer() {
    if (!startedAt) return;

    const s = Math.floor((Date.now() - startedAt) / 1000);
    const m = Math.floor(s / 60);

    if (timerEl) {
      timerEl.textContent =
        `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    }
  }

  function snapshot() {
    return clone({
      stock: state.stock,
      waste: state.waste,
      foundations: state.foundations,
      tableau: state.tableau,
      moves: state.moves
    });
  }

  function pushHistory() {
    history.push(snapshot());

    if (history.length > 100) {
      history.shift();
    }
  }

  function restore(s) {
    state = clone(s);
    render();
  }

  function undo() {
    if (history.length) {
      restore(history.pop());
    }
  }

  function setupLayout() {
    const w = board.clientWidth - 16;
    const h = board.clientHeight - 16;
    const gap = Math.max(4, Math.min(10, w * 0.012));
    const cw = Math.max(34, Math.min(92, (w - 6 * gap) / 7));
    const ch = cw * 1.42;

    board.style.setProperty('--cw', `${cw}px`);
    board.style.setProperty('--ch', `${ch}px`);
    board.style.setProperty('--gap', `${gap}px`);
  }

  function cardHTML(c, i, source, col) {
    const el = document.createElement('div');

    el.className = `card ${c.color}${c.faceUp ? '' : ' facedown'}`;
    el.dataset.cardIndex = i;
    el.dataset.source = source;

    if (col !== undefined) {
      el.dataset.sourceIndex = col;
    }

    el.innerHTML = c.faceUp
      ? `
        <div class="corner">
          <span>${rankNames[c.rank]}</span>
          <span>${c.suit}</span>
        </div>
        <span class="center-suit">${c.suit}</span>
        <div class="corner bottom">
          <span>${rankNames[c.rank]}</span>
          <span>${c.suit}</span>
        </div>
      `
      : '';

    return el;
  }

  function addDropZone(el, type, index) {
    el.dataset.dropType = type;
    el.dataset.dropIndex = index;
  }

  function allCardsFaceUp() {
    return (
      state.stock.length === 0 &&
      state.tableau.every((col) => col.every((c) => c.faceUp === true))
    );
  }

  function render() {
    setupLayout();

    topRow.innerHTML = '';
    tableauRow.innerHTML = '';

    const stock = document.createElement('div');

    stock.className = 'pile stock';
    addDropZone(stock, 'stock', 0);
    stock.addEventListener('pointerdown', drawStock);

    topRow.append(stock);

    const waste = document.createElement('div');

    waste.className = 'pile waste';
    addDropZone(waste, 'waste', 0);

    if (state.waste.length) {
      waste.append(
        cardHTML(state.waste.at(-1), 0, 'waste')
      );
    }

    topRow.append(waste);

    const spacer = document.createElement('div');
    spacer.style.flex = '1';

    topRow.append(spacer);

    state.foundations.forEach((f, i) => {
      const p = document.createElement('div');

      p.className = 'pile foundation';
      p.innerHTML = `<span class="suit-hint">${suits[i]}</span>`;

      addDropZone(p, 'foundation', i);

      if (f.length) {
        p.append(
          cardHTML(f.at(-1), f.length - 1, 'foundation', i)
        );
      }

      topRow.append(p);
    });

    state.tableau.forEach((col, i) => {
      const el = document.createElement('div');

      el.className = 'tableau-col';
      addDropZone(el, 'tableau', i);

      let y = 0;

      col.forEach((c, j) => {
        const card = cardHTML(c, j, 'tableau', i);

        card.style.top = `${y}px`;
        el.append(card);

        if (c.faceUp) {
          y += Math.max(
            20,
            parseFloat(
              getComputedStyle(board).getPropertyValue('--cw')
            ) * 0.32
          );
        } else {
          y += Math.max(
            16,
            parseFloat(
              getComputedStyle(board).getPropertyValue('--cw')
            ) * 0.22
          );
        }
      });

      tableauRow.append(el);
    });

    document.querySelectorAll('.card').forEach(attachDrag);

    if (movesEl) {
      movesEl.textContent = state.moves;
    }

    solveBtn?.classList.toggle(
      'hidden',
      !(allCardsFaceUp() && !state.foundations.every((f) => f.length === 13))
    );

    checkWin();
  }

  function drawStock(e) {
    e.preventDefault();

    pushHistory();

    if (state.stock.length) {
      state.waste.push({
        ...state.stock.pop(),
        faceUp: true
      });
    } else {
      while (state.waste.length) {
        state.stock.push({
          ...state.waste.pop(),
          faceUp: false
        });
      }
    }

    state.moves++;
    render();
  }

  function attachDrag(el) {
    el.addEventListener('pointerdown', startDrag);
  }

  function startDrag(e) {
    if (e.button !== undefined && e.button !== 0) {
      return;
    }

    const el = e.currentTarget;
    const c = +el.dataset.cardIndex;
    const src = el.dataset.source;
    const idx = +(el.dataset.sourceIndex || 0);

    if (src === 'tableau' && !state.tableau[idx][c].faceUp) {
      return;
    }

    if (
      src === 'foundation' &&
      c !== state.foundations[idx].length - 1
    ) {
      return;
    }

    const group =
      src === 'tableau'
        ? state.tableau[idx].slice(c)
        : [
            src === 'waste'
              ? state.waste.at(-1)
              : state.foundations[idx].at(-1)
          ];

    if (!group[0]) {
      return;
    }

    dragData = {
      source: src,
      sourceIndex: idx,
      index: c,
      group,
      originX: e.clientX,
      originY: e.clientY,
      moved: false,
      pointerId: e.pointerId,
      el
    };

    el.setPointerCapture?.(e.pointerId);

    document.addEventListener('pointermove', onDragMove);
    document.addEventListener('pointerup', onDragEnd, { once: true });
  }

  function onDragMove(e) {
    if (!dragData) {
      return;
    }

    if (
      Math.hypot(
        e.clientX - dragData.originX,
        e.clientY - dragData.originY
      ) > 6
    ) {
      dragData.moved = true;
    }

    if (!dragData.moved) {
      return;
    }

    const dx = e.clientX - dragData.originX;
    const dy = e.clientY - dragData.originY;

    const cards = [...document.querySelectorAll('.card')]
      .filter(
        (x) =>
          x.dataset.source === dragData.source &&
          +x.dataset.sourceIndex === dragData.sourceIndex &&
          +x.dataset.cardIndex >= dragData.index
      );

    cards.forEach((x) => {
      x.classList.add('dragging');
      x.style.transform = `translate(${dx}px, ${dy}px)`;
    });
  }

  function onDragEnd(e) {
    if (!dragData) {
      return;
    }

    const d = dragData;

    dragData = null;

    document.removeEventListener('pointermove', onDragMove);

    document.querySelectorAll('.card.dragging').forEach((x) => {
      x.classList.remove('dragging');
      x.style.transform = '';
    });

    if (d.moved) {
      tryDropWithTolerance(e.clientX, e.clientY, d);
    } else {
      tryAutoMove(d);
    }
  }

  function zoneRect(z, type) {
    const r = z.getBoundingClientRect();

    if (type !== 'tableau') {
      return r;
    }

    const col = state.tableau[+z.dataset.dropIndex];
    const cw = parseFloat(
      getComputedStyle(board).getPropertyValue('--cw')
    );
    const ch = parseFloat(
      getComputedStyle(board).getPropertyValue('--ch')
    );

    let y = 0;

    col.forEach((c) => {
      y += c.faceUp
        ? Math.max(20, cw * 0.32)
        : Math.max(16, cw * 0.22);
    });

    return {
      left: r.left,
      top: r.top,
      right: r.right,
      bottom: Math.min(r.top + y + ch, r.bottom)
    };
  }

  function distanceToRect(x, y, r) {
    return Math.hypot(
      Math.max(r.left - x, 0, x - r.right),
      Math.max(r.top - y, 0, y - r.bottom)
    );
  }

  function tryDropWithTolerance(x, y, drag) {
    const candidates = [];

    document.querySelectorAll('[data-drop-type]').forEach((z) => {
      const type = z.dataset.dropType;
      const idx = +z.dataset.dropIndex;

      if (
        type === 'foundation' &&
        canPlaceOnFoundation(drag.group[0], idx)
      ) {
        candidates.push({ z, type, idx });
      }

      if (
        type === 'tableau' &&
        canPlaceOnTableau(drag.group, idx, drag)
      ) {
        candidates.push({ z, type, idx });
      }
    });

    candidates.sort(
      (a, b) =>
        distanceToRect(x, y, zoneRect(a.z, a.type)) -
        distanceToRect(x, y, zoneRect(b.z, b.type))
    );

    if (
      candidates.length &&
      distanceToRect(
        x,
        y,
        zoneRect(candidates[0].z, candidates[0].type)
      ) <= 45
    ) {
      executeDrop(
        candidates[0].type,
        candidates[0].idx,
        drag
      );
    } else {
      render();
    }
  }

  function removeFromSource(d) {
    if (d.source === 'tableau') {
      state.tableau[d.sourceIndex].splice(
        d.index,
        d.group.length
      );
    } else if (d.source === 'waste') {
      state.waste.pop();
    } else {
      state.foundations[d.sourceIndex].pop();
    }
  }

  function flipNewTopIfNeeded(col) {
    if (col?.length && !col.at(-1).faceUp) {
      col.at(-1).faceUp = true;
    }
  }

  function executeDrop(type, idx, d) {
    pushHistory();
    removeFromSource(d);

    if (type === 'foundation') {
      state.foundations[idx].push(d.group[0]);
    } else {
      state.tableau[idx].push(...d.group);
    }

    if (d.source === 'tableau') {
      flipNewTopIfNeeded(state.tableau[d.sourceIndex]);
    }

    state.moves++;
    render();
  }

  function canPlaceOnFoundation(card, idx) {
    const f = state.foundations[idx];

    return f.length
      ? f.at(-1).suit === card.suit &&
          card.rank === f.at(-1).rank + 1
      : card.rank === 1;
  }

  function canPlaceOnTableau(group, idx, d) {
    if (
      d &&
      d.source === 'tableau' &&
      d.sourceIndex === idx
    ) {
      return false;
    }

    const col = state.tableau[idx];
    const card = group[0];

    return col.length
      ? col.at(-1).faceUp &&
          col.at(-1).color !== card.color &&
          col.at(-1).rank === card.rank + 1
      : card.rank === 13;
  }

  function tryAutoMove(d) {
    const card = d.group[0];

    for (let i = 0; i < 4; i++) {
      if (
        d.group.length === 1 &&
        canPlaceOnFoundation(card, i)
      ) {
        executeDrop('foundation', i, d);
        return;
      }
    }

    const valid = [];

    for (let i = 0; i < 7; i++) {
      if (canPlaceOnTableau(d.group, i, d)) {
        valid.push(i);
      }
    }

    if (valid.length === 1) {
      executeDrop('tableau', valid[0], d);
    }
  }

  function autoSolve() {
    let guard = 0;

    while (guard++ < 300) {
      let moved = false;

      for (let c = 0; c < 7 && !moved; c++) {
        const col = state.tableau[c];

        if (col.length && col.at(-1).faceUp) {
          const d = {
            source: 'tableau',
            sourceIndex: c,
            index: col.length - 1,
            group: [col.at(-1)]
          };

          for (let f = 0; f < 4; f++) {
            if (canPlaceOnFoundation(d.group[0], f)) {
              executeDrop('foundation', f, d);
              moved = true;
              break;
            }
          }
        }
      }

      if (!moved && state.waste.length) {
        const d = {
          source: 'waste',
          sourceIndex: 0,
          index: 0,
          group: [state.waste.at(-1)]
        };

        for (let f = 0; f < 4; f++) {
          if (canPlaceOnFoundation(d.group[0], f)) {
            executeDrop('foundation', f, d);
            moved = true;
            break;
          }
        }
      }

      if (!moved) {
        break;
      }
    }
  }

  function checkWin() {
    if (state.foundations.every((f) => f.length === 13)) {
      clearInterval(timer);

      if (winStats) {
        winStats.textContent =
          `Züge: ${state.moves} · Zeit: ${timerEl?.textContent || '00:00'}`;
      }

      winOverlay?.classList.add('show');
    }
  }

  document
    .getElementById('newGameBtn')
    ?.addEventListener('click', newGame);

  document
    .getElementById('winNewGame')
    ?.addEventListener('click', newGame);

  document
    .getElementById('undoBtn')
    ?.addEventListener('click', undo);

  solveBtn?.addEventListener('click', autoSolve);

  window.addEventListener('resize', render);

  newGame();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('sw.js')
        .catch(() => {});
    });
  }
})();