// main.js
// =================================================================
// Sudoku PWA – main controller.
//
// Responsibilities:
//   - Manage screen transitions (start <-> game).
//   - Build the 9x9 grid and the 1-9 keypad.
//   - Handle cell selection, digit input and the 3x3 box highlighting.
//   - Track a simple timer for the active game.
//   - Detect a fully and correctly solved puzzle and show a success
//     dialog. (Bug fix: previously no win check was performed after
//     a digit was entered, so the game never signalled victory.)
//
// Globals supplied by other scripts (window.*):
//   - solver.js    -> window.SudokuSolver
//   - generator.js -> window.SudokuGenerator
// =================================================================

(function (global) {
  'use strict';

  // ----------------------------------------------------------------
  // Difficulty configuration.
  // Lower "clues" values = harder puzzles (more cells removed).
  // The start screen buttons set data-difficulty to one of these keys.
  // ----------------------------------------------------------------
  const DIFFICULTY_SETTINGS = {
    easy:   { clues: 45, label: 'Leicht'   },
    medium: { clues: 35, label: 'Mittel'   },
    hard:   { clues: 27, label: 'Schwer'   }
    // Future example:
    // expert: { clues: 22, label: 'Experte' },
  };

  // ----------------------------------------------------------------
  // DOM references (resolved once at load time).
  // ----------------------------------------------------------------
  const boardEl     = document.getElementById('board');
  const keypadEl    = document.getElementById('keypad');
  const timerEl     = document.getElementById('timer');
  const diffLabel   = document.getElementById('difficulty-display');
  const loadingEl   = document.getElementById('loading');
  const backBtn     = document.getElementById('back-btn');
  const startScreen = document.getElementById('start-screen');
  const gameScreen  = document.getElementById('game-screen');

  // ----------------------------------------------------------------
  // Mutable game state.
  // ----------------------------------------------------------------
  const state = {
    puzzle: null,        // 9x9 starting grid (the "givens")
    solution: null,      // 9x9 unique solution
    user: null,          // 9x9 grid with the player's current entries
    initial: null,       // 9x9 grid of booleans, true where the value is a given
    selected: null,      // {row, col} or null
    difficulty: null,    // 'easy' | 'medium' | 'hard'
    timerId: null,
    startedAt: 0,
    solved: false,       // true once a win was detected (prevents repeated dialogs)
  };

  // ----------------------------------------------------------------
  // Screen management
  // ----------------------------------------------------------------
  function showScreen(name) {
    startScreen.classList.toggle('active', name === 'start');
    gameScreen.classList.toggle('active', name === 'game');
    backBtn.hidden = (name === 'start');
  }

  // ----------------------------------------------------------------
  // Grid + Keypad rendering
  // ----------------------------------------------------------------
  function buildBoard() {
    boardEl.innerHTML = '';
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.row = String(r);
        cell.dataset.col = String(c);
        // Mark cells that sit on the right / bottom edge of a 3x3 box
        // so the existing CSS can paint the thick separators via
        // box-shadow. We never modify those rules.
        if (c % 3 === 2 && c !== 8) cell.classList.add('box-right');
        if (r % 3 === 2 && r !== 8) cell.classList.add('box-bottom');
        cell.setAttribute('role', 'gridcell');
        cell.addEventListener('click', () => selectCell(r, c));
        boardEl.appendChild(cell);
      }
    }
  }

  function buildKeypad() {
    keypadEl.innerHTML = '';
    for (let n = 1; n <= 9; n++) {
      const btn = document.createElement('button');
      btn.className = 'key';
      btn.textContent = String(n);
      btn.setAttribute('aria-label', `Zahl ${n}`);
      btn.addEventListener('click', () => enterNumber(n));
      keypadEl.appendChild(btn);
    }
    const erase = document.createElement('button');
    erase.className = 'key erase';
    erase.textContent = '✕';
    erase.setAttribute('aria-label', 'Eingabe löschen');
    erase.addEventListener('click', () => enterNumber(0));
    keypadEl.appendChild(erase);
  }

  function renderBoard() {
    const cells = boardEl.children;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const idx = r * 9 + c;
        const cell = cells[idx];
        const v = state.user[r][c];
        cell.textContent = v === 0 ? '' : String(v);
        cell.classList.toggle('given', state.initial[r][c]);
      }
    }
    highlightPeers();
  }

  // ----------------------------------------------------------------
  // Selection + highlighting
  // ----------------------------------------------------------------
  function clearHighlights() {
    const cells = boardEl.children;
    for (let i = 0; i < cells.length; i++) {
      cells[i].classList.remove('selected', 'peer', 'same-number');
    }
  }

  function highlightPeers() {
    if (!state.selected) return;
    const { row, col } = state.selected;
    const selectedValue = state.user[row][col];
    const cells = boardEl.children;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const idx = r * 9 + c;
        const sameRow = r === row;
        const sameCol = c === col;
        const sameBox =
          Math.floor(r / 3) === Math.floor(row / 3) &&
          Math.floor(c / 3) === Math.floor(col / 3);
        if (sameRow || sameCol || sameBox) {
          cells[idx].classList.add('peer');
        }
        if (selectedValue !== 0 && state.user[r][c] === selectedValue) {
          cells[idx].classList.add('same-number');
        }
      }
    }
  }

  function selectCell(row, col) {
    // Selection itself is just a render detail (needed by main.js
    // for the peer/same-number effect).
    clearHighlights();
    state.selected = { row, col };
    const idx = row * 9 + col;
    boardEl.children[idx].classList.add('selected');
    highlightPeers();
  }

  // ----------------------------------------------------------------
  // Input handling + win detection
  // ----------------------------------------------------------------
  function enterNumber(n) {
    if (!state.selected || !state.user) return;
    const { row, col } = state.selected;
    // Don't allow overwriting a "given" cell.
    if (state.initial[row][col]) return;
    state.user[row][col] = n;
    renderBoard();
    // Re-apply selection styles after re-render.
    selectCell(row, col);

    // After every entry, check whether the puzzle is now solved.
    // (Bug fix: this check was previously missing entirely.)
    if (!state.solved && n !== 0 && isBoardSolved()) {
      state.solved = true;
      onPuzzleSolved();
    }
  }

  /**
   * Returns true iff every cell is filled AND every row, column and
   * 3x3 box contains the digits 1-9 exactly once.
   *
   * We deliberately do NOT rely on state.solution here – a player
   * can produce a valid full board via a different path; what matters
   * for "won the game" is that the rules of Sudoku are satisfied.
   */
  function isBoardSolved() {
    const g = state.user;
    // 1) Every cell must be filled.
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (g[r][c] < 1 || g[r][c] > 9) return false;
      }
    }
    // 2) Helper: check that a 9-element line is a permutation of 1..9.
    const isPermutation = (line) => {
      let bits = 0;
      for (const v of line) {
        if (v < 1 || v > 9) return false;
        const mask = 1 << (v - 1);
        if (bits & mask) return false; // duplicate
        bits |= mask;
      }
      return bits === 0x1FF; // 9 lowest bits set
    };
    // 3) Rows and columns.
    for (let i = 0; i < 9; i++) {
      const row = [];
      const col = [];
      for (let j = 0; j < 9; j++) {
        row.push(g[i][j]);
        col.push(g[j][i]);
      }
      if (!isPermutation(row)) return false;
      if (!isPermutation(col)) return false;
    }
    // 4) 3x3 boxes.
    for (let br = 0; br < 3; br++) {
      for (let bc = 0; bc < 3; bc++) {
        const box = [];
        for (let r = br * 3; r < br * 3 + 3; r++) {
          for (let c = bc * 3; c < bc * 3 + 3; c++) {
            box.push(g[r][c]);
          }
        }
        if (!isPermutation(box)) return false;
      }
    }
    return true;
  }

  /**
   * Show a clear but unobtrusive "you solved it" dialog. We build
   * the markup in JS and use inline styles so we don't have to
   * touch style.css for this bug fix. The dialog can be dismissed
   * via the button or by clicking the backdrop. The success state
   * flag prevents it from firing again on subsequent edits.
   */
  function onPuzzleSolved() {
    // Stop the timer so the final time freezes.
    stopTimer();

    // Build the overlay (idempotent: reuse if already in DOM).
    let overlay = document.getElementById('sudoku-win-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'sudoku-win-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-labelledby', 'sudoku-win-title');
      Object.assign(overlay.style, {
        position: 'fixed',
        inset: '0',
        background: 'rgba(0, 0, 0, 0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: '1000',
      });

      const dialog = document.createElement('div');
      Object.assign(dialog.style, {
        background: 'var(--board-bg, #ffffff)',
        color: 'var(--text-given, #2c2110)',
        border: '2px solid var(--board-line-thick, #4a3a20)',
        borderRadius: '0.75rem',
        padding: '1.5rem 1.75rem',
        maxWidth: '360px',
        width: '90%',
        textAlign: 'center',
        boxShadow: '0 8px 28px rgba(0,0,0,0.30)',
      });

      const title = document.createElement('h2');
      title.id = 'sudoku-win-title';
      title.textContent = 'Gelöst!';
      Object.assign(title.style, {
        margin: '0 0 0.5rem 0',
        fontSize: '1.4rem',
        color: '#4a3a20',
      });

      const msg = document.createElement('p');
      msg.textContent = 'Herzlichen Glückwunsch – das Sudoku ist vollständig und korrekt gelöst.';
      Object.assign(msg.style, {
        margin: '0 0 1rem 0',
        color: '#6a5530',
      });

      const time = document.createElement('p');
      time.id = 'sudoku-win-time';
      time.textContent = 'Zeit: ' + (timerEl.textContent || '00:00');
      Object.assign(time.style, {
        margin: '0 0 1.25rem 0',
        fontVariantNumeric: 'tabular-nums',
        fontWeight: '600',
        color: '#4a3a20',
      });

      const closeBtn = document.createElement('button');
      closeBtn.textContent = 'Schließen';
      Object.assign(closeBtn.style, {
        background: 'var(--header-bg, #b6925a)',
        color: 'var(--header-text, #fff8e6)',
        border: 'none',
        borderRadius: '0.5rem',
        padding: '0.6rem 1.2rem',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: 'pointer',
      });

      dialog.appendChild(title);
      dialog.appendChild(msg);
      dialog.appendChild(time);
      dialog.appendChild(closeBtn);
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);

      const dismiss = () => { overlay.style.display = 'none'; };
      closeBtn.addEventListener('click', dismiss);
      overlay.addEventListener('click', (ev) => {
        if (ev.target === overlay) dismiss();
      });
    } else {
      // Refresh the recorded time when re-shown.
      const t = document.getElementById('sudoku-win-time');
      if (t) t.textContent = 'Zeit: ' + (timerEl.textContent || '00:00');
      overlay.style.display = 'flex';
    }
  }

  // ----------------------------------------------------------------
  // Timer
  // ----------------------------------------------------------------
  function startTimer() {
    stopTimer();
    state.startedAt = Date.now();
    state.timerId = setInterval(() => {
      const elapsed = Math.floor((Date.now() - state.startedAt) / 1000);
      const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const ss = String(elapsed % 60).padStart(2, '0');
      timerEl.textContent = `${mm}:${ss}`;
    }, 1000);
  }
  function stopTimer() {
    if (state.timerId) clearInterval(state.timerId);
    state.timerId = null;
  }

  // ----------------------------------------------------------------
  // New game flow
  // ----------------------------------------------------------------
  function startGame(difficulty) {
    const cfg = DIFFICULTY_SETTINGS[difficulty];
    if (!cfg) return;

    state.difficulty = difficulty;
    diffLabel.textContent = cfg.label;
    state.solved = false;

    loadingEl.hidden = false;
    // Defer to next frame so the loading text can paint before the
    // (potentially expensive) generator runs.
    requestAnimationFrame(() => {
      const t0 = performance.now();
      const { puzzle, solution } =
        SudokuGenerator.generatePuzzle(cfg.clues);
      const dt = performance.now() - t0;
      // Uncomment to log generator timing:
      // console.log('Generated in', dt.toFixed(1), 'ms');
      loadingEl.hidden = true;

      state.puzzle = puzzle;
      state.solution = solution;
      state.user = puzzle.map((row) => row.slice());
      state.initial = puzzle.map((row) =>
        row.map((v) => v !== 0)
      );
      state.selected = null;

      buildBoard();
      renderBoard();
      showScreen('game');
      startTimer();
    });
  }

  function backToStart() {
    stopTimer();
    state.selected = null;
    state.solved = false;
    // Hide any lingering win dialog.
    const ov = document.getElementById('sudoku-win-overlay');
    if (ov) ov.style.display = 'none';
    showScreen('start');
  }

  // ----------------------------------------------------------------
  // Wire up events
  // ----------------------------------------------------------------
  function init() {
    buildKeypad();
    buildBoard();

    document.querySelectorAll('.btn-difficulty').forEach((btn) => {
      btn.addEventListener('click', () =>
        startGame(btn.dataset.difficulty)
      );
    });
    backBtn.addEventListener('click', backToStart);

    // Keyboard support: digits 1-9 set a value, 0/Backspace/Delete
    // erases, arrow keys to move selection.
    document.addEventListener('keydown', (e) => {
      if (!gameScreen.classList.contains('active')) return;
      if (!state.selected) return;

      if (e.key >= '1' && e.key <= '9') {
        enterNumber(parseInt(e.key, 10));
        e.preventDefault();
      } else if (e.key === '0' || e.key === 'Backspace' || e.key === 'Delete') {
        enterNumber(0);
        e.preventDefault();
      } else if (e.key.startsWith('Arrow')) {
        moveSelection(e.key);
        e.preventDefault();
      }
    });
  }

  function moveSelection(key) {
    const sel = state.selected || { row: 0, col: 0 };
    let { row, col } = sel;
    if (key === 'ArrowUp')    row = (row + 8) % 9;
    if (key === 'ArrowDown')  row = (row + 1) % 9;
    if (key === 'ArrowLeft')  col = (col + 8) % 9;
    if (key === 'ArrowRight') col = (col + 1) % 9;
    selectCell(row, col);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
