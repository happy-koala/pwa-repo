// generator.js
// -----------------------------------------------------------------------------
// Sudoku generator.
//
// Two responsibilities:
//   1. Fill an empty 9x9 board into a complete, valid solution using
//      randomised backtracking (Fisher-Yates shuffled candidate list per cell).
//   2. Remove cells one-by-one in random order, keeping the puzzle solvable
//      with a unique solution. After each removal we ask the solver whether
//      the puzzle still has exactly one solution; if not we put the digit
//      back and try the next cell.
//
// The generator only depends on SudokuSolver (solver.js) for the uniqueness
// check and exposes everything via a global `SudokuGenerator` namespace.
// -----------------------------------------------------------------------------

(function (global) {
  'use strict';

  const SIZE = 9;
  const BOX_SIZE = 3;

  /**
   * Fisher-Yates shuffle: returns a new array with elements in random order.
   * Used so each cell picks its candidate digits in a different order, which
   * gives much more varied full boards than a fixed 1..9 sequence.
   */
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /**
   * In-place validity check. Identical logic to the solver's isValid, kept
   * local so the generator has zero coupling beyond `SudokuSolver.SIZE`.
   */
  function canPlace(board, row, col, value) {
    for (let i = 0; i < SIZE; i++) {
      if (board[row][i] === value) return false;
      if (board[i][col] === value) return false;
    }
    const br = Math.floor(row / BOX_SIZE) * BOX_SIZE;
    const bc = Math.floor(col / BOX_SIZE) * BOX_SIZE;
    for (let r = br; r < br + BOX_SIZE; r++) {
      for (let c = bc; c < bc + BOX_SIZE; c++) {
        if (board[r][c] === value) return false;
      }
    }
    return true;
  }

  /**
   * Find the next empty cell in row-major order. Used by the fill routine.
   */
  function findEmpty(board) {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (board[r][c] === 0) return [r, c];
      }
    }
    return null;
  }

  /**
   * Fill the given board in-place into a complete valid solution, using
   * randomised candidate ordering. Returns true on success.
   */
  function fillBoard(board) {
    const empty = findEmpty(board);
    if (!empty) return true;
    const [row, col] = empty;
    const candidates = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (const v of candidates) {
      if (canPlace(board, row, col, v)) {
        board[row][col] = v;
        if (fillBoard(board)) return true;
        board[row][col] = 0;
      }
    }
    return false;
  }

  /**
   * Generate a fresh, fully filled, valid Sudoku board.
   */
  function generateFullBoard() {
    const board = Array.from({ length: SIZE }, () =>
      new Array(SIZE).fill(0)
    );
    if (!fillBoard(board)) {
      throw new Error('Failed to generate a complete Sudoku board');
    }
    return board;
  }

  /**
   * Build a list of all 81 cell indices in a random order.
   */
  function shuffledCellIndices() {
    const indices = [];
    for (let i = 0; i < SIZE * SIZE; i++) indices.push(i);
    return shuffle(indices);
  }

  /**
   * Generate a Sudoku puzzle with a unique solution.
   *
   * @param {number} clues  Target number of filled cells (the puzzle's givens).
   *                        Must be in the inclusive range [17, 81].
   * @returns {{ puzzle: number[][], solution: number[][] }}
   *          puzzle has 0s for blanks; solution is the unique completed board.
   */
  function generatePuzzle(clues) {
    if (clues < 17 || clues > 81) {
      throw new RangeError('clues must be between 17 and 81 inclusive');
    }

    const solution = generateFullBoard();
    const puzzle = solution.map((row) => row.slice());

    const cellsToTry = shuffledCellIndices();
    let removed = 0;
    const targetRemovals = SIZE * SIZE - clues; // 81 - clues

    for (const idx of cellsToTry) {
      if (removed >= targetRemovals) break;
      const row = Math.floor(idx / SIZE);
      const col = idx % SIZE;
      if (puzzle[row][col] === 0) continue; // Already removed.

      const backup = puzzle[row][col];
      puzzle[row][col] = 0;

      // Ask the solver: is the resulting board still uniquely solvable?
      // countSolutions stops after 2 finds, so this stays cheap.
      if (!global.SudokuSolver.hasUniqueSolution(puzzle)) {
        // Not unique -> restore this clue and try another cell.
        puzzle[row][col] = backup;
        continue;
      }
      removed++;
    }

    // Hard floor: if we couldn't reach the target while preserving uniqueness
    // (rare for very low clues on adversarial seeds), we return what we got.
    return { puzzle, solution };
  }

  global.SudokuGenerator = {
    generatePuzzle,
    generateFullBoard,
    shuffle,
    SIZE,
    BOX_SIZE,
  };
})(typeof window !== 'undefined' ? window : globalThis);
