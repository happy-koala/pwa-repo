(function() {
  "use strict";

  // ---------- Konstanten ----------
  const SUITS = ['♠', '♥', '♦', '♣'];
  const RED_SUITS = ['♥', '♦'];
  const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

  let board = document.getElementById('board');
  let topRow = document.getElementById('topRow');
  let tableauRow = document.getElementById('tableauRow');
  let movesEl = document.getElementById('moves');
  let timerEl = document.getElementById('timer');
  let winOverlay = document.getElementById('winOverlay');
  let winStats = document.getElementById('winStats');

  let state = {
    stock: [],
    waste: [],
    foundations: [[],[],[],[]], // ♠ ♥ ♦ ♣
    tableau: [[],[],[],[],[],[],[]],
    moves: 0,
    seconds: 0,
    history: [],
    started: false
  };

  let timerInterval = null;

  // ---------- Karten Setup ----------
  function makeDeck() {
    let deck = [];
    let id = 0;
    for (let s = 0; s < 4; s++) {
      for (let r = 0; r < 13; r++) {
        deck.push({
          id: id++,
          suit: SUITS[s],
          suitIndex: s,
          rank: r + 1,
          rankLabel: RANKS[r],
          color: RED_SUITS.includes(SUITS[s]) ? 'red' : 'black',
          faceUp: false
        });
      }
    }
    return deck;
  }

  function shuffle(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  function newGame() {
    let deck = shuffle(makeDeck());
    state = {
      stock: [],
      waste: [],
      foundations: [[],[],[],[]],
      tableau: [[],[],[],[],[],[],[]],
      moves: 0,
      seconds: 0,
      history: [],
      started: false
    };
    for (let col = 0; col < 7; col++) {
      for (let i = 0; i <= col; i++) {
        const card = deck.pop();
        card.faceUp = (i === col);
        state.tableau[col].push(card);
      }
    }
    state.stock = deck.map(c => ({ ...c, faceUp: false }));
    stopTimer();
    timerEl.textContent = '00:00';
    movesEl.textContent = '0';
    winOverlay.classList.remove('show');
    render();
  }

  // ---------- Timer ----------
  function startTimerIfNeeded() {
    if (state.started) return;
    state.started = true;
    timerInterval = setInterval(() => {
      state.seconds++;
      const m = String(Math.floor(state.seconds / 60)).padStart(2, '0');
      const s = String(state.seconds % 60).padStart(2, '0');
      timerEl.textContent = m + ':' + s;
    }, 1000);
  }
  function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
  }

  // ---------- History (Undo) ----------
  function snapshot() {
    return JSON.stringify({
      stock: state.stock, waste: state.waste,
      foundations: state.foundations, tableau: state.tableau,
      moves: state.moves
    });
  }
  function pushHistory() {
    state.history.push(snapshot());
    if (state.history.length > 60) state.history.shift();
  }
  function undo() {
    if (state.history.length === 0) return;
    const prev = JSON.parse(state.history.pop());
    state.stock = prev.stock;
    state.waste = prev.waste;
    state.foundations = prev.foundations;
    state.tableau = prev.tableau;
    state.moves = prev.moves;
    movesEl.textContent = state.moves;
    render();
  }

  function incMoves() {
    state.moves++;
    movesEl.textContent = state.moves;
  }

  // ---------- Layout Berechnung ----------
  let cardW = 60, cardH = 84, gap = 6, fanOffset = 26;

  function computeLayout() {
    const boardRect = board.getBoundingClientRect();
    const availW = boardRect.width - 16; // padding
    const cols = 7;
    const gapPx = Math.max(4, Math.min(8, availW * 0.012));
    let w = (availW - gapPx * (cols - 1)) / cols;
    w = Math.max(38, Math.min(78, w));
    const h = w * 1.4;
    cardW = w;
    cardH = h;
    gap = gapPx;
    document.documentElement.style.setProperty('--cw', w + 'px');
    document.documentElement.style.setProperty('--ch', h + 'px');
    document.documentElement.style.setProperty('--gap', gapPx + 'px');

    const tableauRect = tableauRow.getBoundingClientRect();
    const availH = tableauRect.height - h - 10;
    const maxCardsEstimate = 13;
    fanOffset = Math.max(16, Math.min(h * 0.32, availH / maxCardsEstimate));
  }

  // ---------- Rendering ----------
  function cardEl(card, extraClass) {
    const el = document.createElement('div');
    el.className = 'card ' + (card.faceUp ? card.color : 'facedown') + (extraClass ? ' ' + extraClass : '');
    el.dataset.id = card.id;
    if (card.faceUp) {
      el.innerHTML = `
        <div class="corner top">${card.rankLabel}<span>${card.suit}</span></div>
        <div class="center-suit">${card.suit}</div>
        <div class="corner bottom">${card.rankLabel}<span>${card.suit}</span></div>
      `;
    }
    return el;
  }

  function render() {
    computeLayout();
    topRow.innerHTML = '';
    tableauRow.innerHTML = '';

    // --- Stock ---
    const stockPile = document.createElement('div');
    stockPile.className = 'pile stock';
    stockPile.id = 'stockPile';
    if (state.stock.length > 0) {
      const top = state.stock[state.stock.length - 1];
      const c = cardEl({ ...top, faceUp: false }, null);
      c.style.position = 'absolute';
      stockPile.appendChild(c);
    } else {
      stockPile.innerHTML = '<div class="suit-hint">↺</div>';
    }
    stockPile.addEventListener('click', onStockClick);
    topRow.appendChild(stockPile);

    // --- Waste ---
    const wastePile = document.createElement('div');
    wastePile.className = 'pile waste';
    wastePile.id = 'wastePile';
    const wLen = state.waste.length;
    for (let i = Math.max(0, wLen - 3); i < wLen; i++) {
      const card = state.waste[i];
      const c = cardEl({ ...card, faceUp: true });
      const offsetIndex = i - Math.max(0, wLen - 3);
      c.style.left = (offsetIndex * (cardW * 0.28)) + 'px';
      c.style.zIndex = i;
      if (i === wLen - 1) {
        c.dataset.pile = 'waste';
        c.dataset.index = i;
        attachDrag(c, 'waste', i);
      }
      wastePile.appendChild(c);
    }
    topRow.appendChild(wastePile);

    // spacer
    const spacer = document.createElement('div');
    spacer.style.flex = '1';
    topRow.appendChild(spacer);

    // --- Foundations ---
    for (let f = 0; f < 4; f++) {
      const pile = document.createElement('div');
      pile.className = 'pile foundation';
      pile.dataset.foundation = f;
      const suit = ['♠','♥','♦','♣'][f];
      if (state.foundations[f].length === 0) {
        pile.innerHTML = `<div class="suit-hint" style="color:${RED_SUITS.includes(suit)?'#ffb3b3':'rgba(255,255,255,0.25)'}">${suit}</div>`;
      } else {
        const top = state.foundations[f][state.foundations[f].length - 1];
        const c = cardEl({ ...top, faceUp: true });
        c.style.position = 'absolute';
        c.dataset.pile = 'foundation';
        c.dataset.findex = f;
        attachDrag(c, 'foundation', state.foundations[f].length - 1, f);
        pile.appendChild(c);
      }
      addDropZone(pile, 'foundation', f);
      topRow.appendChild(pile);
    }

    // --- Tableau ---
    for (let col = 0; col < 7; col++) {
      const colEl = document.createElement('div');
      colEl.className = 'tableau-col';
      colEl.dataset.col = col;
      const pile = state.tableau[col];
      pile.forEach((card, idx) => {
        const c = cardEl(card);
        c.style.top = (idx * fanOffset) + 'px';
        c.style.zIndex = idx;
        if (card.faceUp) {
          c.dataset.pile = 'tableau';
          c.dataset.col = col;
          c.dataset.index = idx;
          attachDrag(c, 'tableau', idx, col);
        }
        colEl.appendChild(c);
      });
      addDropZone(colEl, 'tableau', col);
      tableauRow.appendChild(colEl);
    }

    checkWin();
  }

  // ---------- Stock Klick ----------
  function onStockClick() {
    startTimerIfNeeded();
    pushHistory();
    if (state.stock.length === 0) {
      if (state.waste.length === 0) { state.history.pop(); return; }
      state.stock = state.waste.reverse().map(c => ({ ...c, faceUp: false }));
      state.waste = [];
    } else {
      const card = state.stock.pop();
      card.faceUp = true;
      state.waste.push(card);
    }
    incMoves();
    render();
  }

  // ---------- Regeln ----------
  function canPlaceOnFoundation(card, foundationIndex) {
    const suitOrder = ['♠','♥','♦','♣'];
    if (card.suitIndex !== foundationIndex && suitOrder[foundationIndex] !== card.suit) return false;
    const pile = state.foundations[foundationIndex];
    if (pile.length === 0) return card.rank === 1;
    return pile[pile.length - 1].rank === card.rank - 1;
  }

  function canPlaceOnTableau(card, col) {
    const pile = state.tableau[col];
    if (pile.length === 0) return card.rank === 13;
    const top = pile[pile.length - 1];
    if (!top.faceUp) return false;
    return top.color !== card.color && top.rank === card.rank + 1;
  }

  function autoFoundationIndexForCard(card) {
    return card.suitIndex;
  }

  // ---------- Drag & Drop (Pointer Events + Touch Support) ----------
  let dragData = null;

  function attachDrag(el, source, index, col) {
    el.addEventListener('pointerdown', (e) => startDrag(e, el, source, index, col));
    el.addEventListener('dblclick', () => tryAutoMove(source, index, col));
  }

  function tryAutoMove(source, index, col) {
    let card;
    if (source === 'waste') card = state.waste[state.waste.length - 1];
    else if (source === 'tableau') card = state.tableau[col][state.tableau[col].length - 1];
    else return;
    if (!card || !card.faceUp) return;
    const fIdx = autoFoundationIndexForCard(card);
    if (canPlaceOnFoundation(card, fIdx)) {
      startTimerIfNeeded();
      pushHistory();
      if (source === 'waste') state.waste.pop();
      else state.tableau[col].pop();
      state.foundations[fIdx].push(card);
      flipNewTopIfNeeded(source, col);
      incMoves();
      render();
    }
  }

  function flipNewTopIfNeeded(source, col) {
    if (source === 'tableau') {
      const pile = state.tableau[col];
      if (pile.length > 0 && !pile[pile.length - 1].faceUp) {
        pile[pile.length - 1].faceUp = true;
      }
    }
  }

  function startDrag(e, el, source, index, col) {
    e.preventDefault();

    if (el.setPointerCapture) {
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
    }

    let cards;
    if (source === 'tableau') {
      cards = state.tableau[col].slice(index);
    } else if (source === 'waste') {
      cards = [state.waste[state.waste.length - 1]];
    } else if (source === 'foundation') {
      cards = [state.foundations[col].length ? state.foundations[col][state.foundations[col].length - 1] : null];
    }
    if (!cards || cards.length === 0 || !cards[0]) return;

    const rect = el.getBoundingClientRect();

    // Für Touch und Mouse - works auf allen Geräten
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const ghostWrap = document.createElement('div');
    ghostWrap.style.position = 'fixed';
    ghostWrap.style.left = rect.left + 'px';
    ghostWrap.style.top = rect.top + 'px';
    ghostWrap.style.zIndex = 5000;
    ghostWrap.style.pointerEvents = 'none';

    cards.forEach((c, i) => {
      const ghost = cardEl(c, 'dragging');
      ghost.style.position = 'absolute';
      ghost.style.top = (i * fanOffset) + 'px';
      ghost.style.left = '0px';
      ghostWrap.appendChild(ghost);
    });
    document.body.appendChild(ghostWrap);

    dragData = {
      cards, source, index, col,
      startX: clientX, startY: clientY,
      originLeft: rect.left, originTop: rect.top,
      ghostWrap,
      pointerId: e.pointerId,
      sourceEl: el,
      moved: false
    };

    hideOriginals(source, col, index);

    document.addEventListener('pointermove', onDragMove);
    document.addEventListener('pointerup', onDragEnd);
    document.addEventListener('pointercancel', onDragEnd);
  }

  function hideOriginals(source, col, index) {
    let container;
    if (source === 'tableau') {
      container = tableauRow.querySelector(`.tableau-col[data-col="${col}"]`);
      const kids = container.querySelectorAll('.card');
      for (let i = index; i < kids.length; i++) kids[i].style.visibility = 'hidden';
    } else if (source === 'waste') {
      const el = document.querySelector('#wastePile .card:last-child');
      if (el) el.style.visibility = 'hidden';
    } else if (source === 'foundation') {
      const el = document.querySelector(`.foundation[data-foundation="${col}"] .card`);
      if (el) el.style.visibility = 'hidden';
    }
  }

  function onDragMove(e) {
    if (!dragData) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const dx = clientX - dragData.startX;
    const dy = clientY - dragData.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragData.moved = true;
    dragData.ghostWrap.style.left = (dragData.originLeft + dx) + 'px';
    dragData.ghostWrap.style.top = (dragData.originTop + dy) + 'px';
  }

  function onDragEnd(e) {
    document.removeEventListener('pointermove', onDragMove);
    document.removeEventListener('pointerup', onDragEnd);
    document.removeEventListener('pointercancel', onDragEnd);
    if (!dragData) return;

    if (dragData.sourceEl && dragData.sourceEl.releasePointerCapture) {
      try { dragData.sourceEl.releasePointerCapture(dragData.pointerId); } catch (err) {}
    }

    const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
    dragData.ghostWrap.style.pointerEvents = 'none';
    dragData.ghostWrap.style.display = 'none';
    const target = document.elementFromPoint(clientX, clientY);
    dragData.ghostWrap.remove();

    let handled = false;
    if (dragData.moved && target) {
      handled = tryDrop(target, dragData);
    }

    if (!handled) {
      if (!dragData.moved) {
        tryAutoMove(dragData.source, dragData.index, dragData.col);
      }
    }
    dragData = null;
    render();
  }

  function findDropZone(el) {
    while (el && el !== document.body) {
      if (el.dataset && el.dataset.dropType) return el;
      el = el.parentElement;
    }
    return null;
  }

  function addDropZone(el, type, index) {
    el.dataset.dropType = type;
    el.dataset.dropIndex = index;
  }

  function tryDrop(target, drag) {
    const zone = findDropZone(target);
    if (!zone) return false;
    const type = zone.dataset.dropType;
    const idx = parseInt(zone.dataset.dropIndex, 10);
    const movingCard = drag.cards[0];

    if (type === 'foundation') {
      if (drag.cards.length !== 1) return false;
      if (!canPlaceOnFoundation(movingCard, idx)) return false;
      startTimerIfNeeded();
      pushHistory();
      removeFromSource(drag);
      state.foundations[idx].push(movingCard);
      flipNewTopIfNeeded(drag.source, drag.col);
      incMoves();
      return true;
    }

    if (type === 'tableau') {
      if (!canPlaceOnTableau(movingCard, idx)) return false;
      if (drag.source === 'tableau' && drag.col === idx) return false;
      startTimerIfNeeded();
      pushHistory();
      removeFromSource(drag);
      drag.cards.forEach(c => state.tableau[idx].push(c));
      flipNewTopIfNeeded(drag.source, drag.col);
      incMoves();
      return true;
    }

    return false;
  }

  function removeFromSource(drag) {
    if (drag.source === 'tableau') {
      state.tableau[drag.col].splice(drag.index, drag.cards.length);
    } else if (drag.source === 'waste') {
      state.waste.pop();
    } else if (drag.source === 'foundation') {
      state.foundations[drag.col].pop();
    }
  }

  // ---------- Win Check ----------
  function checkWin() {
    const total = state.foundations.reduce((s, f) => s + f.length, 0);
    if (total === 52) {
      stopTimer();
      winStats.textContent = `Zeit: ${timerEl.textContent} — Züge: ${state.moves}`;
      winOverlay.classList.add('show');
    }
  }

  // ---------- Events ----------
  document.getElementById('newGameBtn').addEventListener('click', newGame);
  document.getElementById('winNewGame').addEventListener('click', newGame);
  document.getElementById('undoBtn').addEventListener('click', undo);
  window.addEventListener('resize', () => render());

  // ---------- Init ----------
  newGame();

  // ---------- Service Worker ----------
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch(() => {});
    });
  }
})();
