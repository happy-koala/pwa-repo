// ============================================================
// DIFFICULTY & SIZE CONFIGURATION
// Central place to tune puzzle generation. Adjust these values
// if a difficulty level turns out to be too easy/hard in practice.
// ============================================================

// clueRatio: target fraction of cells that remain filled as starting clues (0-1).
//   The actual final clue density may end up slightly higher if the iterative
//   algorithm cannot safely remove down to the target without breaking uniqueness.
// constraintRatio: fraction of eligible adjacent cell-pairs (both horizontal and
//   vertical, total = 2*N*(N-1)) that become visible inequality constraints.
//   Typical Futoshiki density: ~15-25% of all possible edges.
//   Note: with many constraints the solver needs fewer numeric clues to make
//   the puzzle uniquely solvable, which is reflected in the values below.
const DIFFICULTY_SETTINGS = {
  easy:   { clueRatio: 0.50, constraintRatio: 0.22 },
  medium: { clueRatio: 0.32, constraintRatio: 0.16 },
  hard:   { clueRatio: 0.20, constraintRatio: 0.11 },
};

// Optional per-size adjustment multipliers (size affects perceived difficulty
// even with same ratios). Multiplier applied to clueRatio only.
const SIZE_CLUE_MULTIPLIER = {
  4: 1.10,
  5: 1.0,
  6: 0.85,
};

import { countSolutions, solveOne } from './solver.js';

// Generate a complete puzzle object:
//   { N, solution: number[N*N], clues: number[N*N] | null, givens: Set<number>, constraints: [{a,b,op}] }
// size: 4 | 5 | 6, difficulty: 'easy' | 'medium' | 'hard'
export function generatePuzzle(size, difficulty) {
  const t0 = performance.now();
  const N = size;
  const settings = DIFFICULTY_SETTINGS[difficulty];
  const clueMult = SIZE_CLUE_MULTIPLIER[N] ?? 1.0;

  // 1) Generate a valid latin square via randomized backtracking
  const solution = generateLatinSquare(N);

  // 2) Pick inequality constraints on adjacent pairs
  const totalAdjPairs = 2 * N * (N - 1); // horizontal + vertical adjacent pairs
  const targetConstraints = Math.max(1, Math.round(settings.constraintRatio * totalAdjPairs));
  const constraints = pickConstraints(solution, N, targetConstraints);

  // 3) Iteratively remove clues while preserving uniqueness
  const clueCountTarget = Math.max(
    Math.round(N), // at least N clues (one per row minimum-ish)
    Math.round(settings.clueRatio * clueMult * N * N)
  );

  const clues = solution.slice(); // start fully filled
  const indices = shuffle(Array.from({ length: N * N }, (_, i) => i));

  let removed = 0;
  for (const idx of indices) {
    if (clues.filter(v => v !== 0).length <= clueCountTarget) break;
    if (clues[idx] === 0) continue;
    const backup = clues[idx];
    clues[idx] = 0;
    const givens = new Set();
    for (let i = 0; i < N * N; i++) if (clues[i] !== 0) givens.add(i);
    // Check uniqueness
    const c = countSolutions(clues, givens, constraints, N, 2);
    if (c !== 1) {
      clues[idx] = backup; // revert
    } else {
      removed++;
    }
  }

  // Build givens set
  const givens = new Set();
  for (let i = 0; i < N * N; i++) if (clues[i] !== 0) givens.add(i);

  const t1 = performance.now();
  return {
    N,
    solution,
    clues,
    givens,
    constraints,
    clueCount: givens.size,
    durationMs: Math.round(t1 - t0),
  };
}

// ---------- Latin square generator (randomized backtracking) ----------
function generateLatinSquare(N) {
  const grid = new Array(N * N).fill(0);
  // Fill row by row
  const ok = (idx, v) => {
    const row = Math.floor(idx / N);
    const col = idx % N;
    for (let i = 0; i < N; i++) {
      if (grid[row * N + i] === v) return false;
      if (grid[i * N + col] === v) return false;
    }
    return true;
  };
  const fill = (idx) => {
    if (idx === N * N) return true;
    const candidates = shuffle([...Array(N).keys()].map(x => x + 1));
    for (const v of candidates) {
      if (ok(idx, v)) {
        grid[idx] = v;
        if (fill(idx + 1)) return true;
        grid[idx] = 0;
      }
    }
    return false;
  };
  fill(0);
  return grid;
}

// ---------- Constraint selection ----------
function pickConstraints(solution, N, target) {
  // All eligible adjacent pairs (horizontal and vertical)
  const pairs = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (c < N - 1) pairs.push({ a: r * N + c, b: r * N + (c + 1) });
      if (r < N - 1) pairs.push({ a: r * N + c, b: (r + 1) * N + c });
    }
  }
  shuffle(pairs);

  const constraints = [];
  // Track adjacency to avoid placing two constraints on the same pair side (visual clutter)
  // We DO allow parallel constraints on the same side of a cell (e.g. cell could be bounded both
  // by left and right neighbour) – that is visually fine.
  for (const p of pairs) {
    if (constraints.length >= target) break;
    const va = solution[p.a];
    const vb = solution[p.b];
    if (va === vb) continue; // impossible
    const op = va < vb ? '<' : '>';
    constraints.push({ a: p.a, b: p.b, op });
  }
  return constraints;
}

// ---------- Fisher–Yates shuffle ----------
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Re-export helpers for testing
export { DIFFICULTY_SETTINGS, SIZE_CLUE_MULTIPLIER };