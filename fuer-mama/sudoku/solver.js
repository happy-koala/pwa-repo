// solver.js
// -----------------------------------------------------------------------------
// Sudoku solver and uniqueness checker.
//
// Provides a backtracking solver that counts how many valid solutions a given
// 9x9 board has. The search stops as soon as `limit` solutions are found so we
// can use it for cheap uniqueness checks while generating puzzles.
//
// Board representation:
//   - 9x9 array of integers in the range 0..9
//   - 0 means "empty cell"
//
// Exports (as a global `SudokuSolver` namespace so this file works both as a
// plain <script> and as an ES module fallback):
//   - countSolutions(board, limit = 2)
//   - hasUniqueSolution(board)
// -----------------------------------------------------------------------------

(function (global) {
  'use strict';

  const SIZE = 9;
  const BOX_SIZE = 3;

  /**
   * Find the next empty cell (row-major order).
   * Returns [row, col] or null if the board is full.
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
   * Check whether `value` can be placed at (row, col) without violating the
   * row, column or 3x3 box constraints.
   */
  function isValid(board, row, col, value) {
    for (let i = 0; i < SIZE; i++) {
      // Row
      if (board[row][i] === value) return false;
      // Column
      if (board[i][col] === value) return false;
    }
    const boxRow = Math.floor(row / BOX_SIZE) * BOX_SIZE;
    const boxCol = Math.floor(col / BOX_SIZE) * BOX_SIZE;
    for (let br = 0; br < BOX_SIZE; br++) {
      for (let bc = 0; bc < BOX_SIZE; bc++) {
        if (board[boxRow + br][boxCol + bc] === value) return false;
      }
    }
    return true;
  }

  /**
   * Count the number of solutions for `board`, stopping once `limit` solutions
   * have been found. Uses an iterative-ish backtracking via recursion with
   * early termination to stay cheap on uniqueness checks.
   *
   * @param {number[][]} board 9x9 grid, 0 = empty
   * @param {number} limit    Stop after this many solutions (default 2)
   * @returns {number} count of solutions discovered (capped at `limit`)
   */
  function countSolutions(board, limit = 2) {
    // Deep copy so we never mutate the caller's board.
    const grid = board.map((row) => row.slice());
    let count = 0;

    function backtrack() {
      if (count >= limit) return; // Early exit.

      const empty = findEmpty(grid);
      if (!empty) {
        count++;
        return;
      }
      const [row, col] = empty;

      // Candidates 1..9 in natural order. Generator randomises the candidate
      // order for puzzle creation; here determinism keeps the count stable.
      for (let v = 1; v <= SIZE; v++) {
        if (isValid(grid, row, col, v)) {
          grid[row][col] = v;
          backtrack();
          if (count >= limit) {
            grid[row][col] = 0;
            return;
          }
          grid[row][col] = 0;
        }
      }
    }

    backtrack();
    return count;
  }

  /**
   * Convenience helper: returns true iff `board` has exactly one solution.
   */
  function hasUniqueSolution(board) {
    return countSolutions(board, 2) === 1;
  }

  global.SudokuSolver = {
    countSolutions,
    hasUniqueSolution,
    SIZE,
    BOX_SIZE,
  };
})(typeof window !== 'undefined' ? window : globalThis);
