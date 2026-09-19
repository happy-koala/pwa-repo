// ============================================================
// SOLVER (Futoshiki)
// Constraint propagation + backtracking.
// Used both at runtime (to validate user input / count solutions)
// and during generation (to verify uniqueness of the puzzle).
// ============================================================

// Count the number of solutions up to `limit` (default 2).
// Returns the count (capped at `limit`).
// grid: array of size N*N, 0 means empty
// givens: Set of indices that are fixed (cannot be changed)
// constraints: array of {a, b, op} where op is '<' meaning grid[a] < grid[b]
// N: grid size
export function countSolutions(grid, givens, constraints, N, limit = 2) {
  // Deep-copy because we mutate during search
  const g = grid.slice();
  return solveRec(g, givens, constraints, N, limit);
}

function solveRec(g, givens, constraints, N, limit) {
  // Find cell with smallest domain > 1 (MRV heuristic) for efficiency
  let bestIdx = -1;
  let bestDomain = null;
  for (let i = 0; i < g.length; i++) {
    if (givens.has(i)) continue;
    if (g[i] !== 0) continue;
    const dom = domainOf(i, g, givens, constraints, N);
    if (dom.length === 0) return 0; // dead end
    if (bestDomain === null || dom.length < bestDomain.length) {
      bestDomain = dom;
      bestIdx = i;
      if (dom.length === 1) break; // cannot do better
    }
  }

  if (bestIdx === -1) {
    // No empty cell -> all filled -> one solution
    return 1;
  }

  let count = 0;
  for (const v of bestDomain) {
    g[bestIdx] = v;
    const sub = solveRec(g, givens, constraints, N, limit - count);
    count += sub;
    g[bestIdx] = 0;
    if (count >= limit) return count;
  }
  return count;
}

// Compute the domain (allowed values) of cell `idx` given current grid `g`.
// Considers: row uniqueness, column uniqueness, inequality constraints, givens.
function domainOf(idx, g, givens, constraints, N) {
  const row = Math.floor(idx / N);
  const col = idx % N;
  const used = new Set();
  for (let c = 0; c < N; c++) {
    const ri = row * N + c;
    if (ri !== idx && g[ri] !== 0) used.add(g[ri]);
    const ci = c * N + col;
    if (ci !== idx && g[ci] !== 0) used.add(g[ci]);
  }

  // Inequality constraints touching this cell
  // For each constraint involving idx: the neighbour must be either set (then bound)
  // or unknown (we'll filter after picking value)
  const neighbourBounds = [];
  for (const c of constraints) {
    if (c.a === idx) neighbourBounds.push({ other: c.b, op: c.op, selfIsA: true });
    else if (c.b === idx) neighbourBounds.push({ other: c.a, op: c.op, selfIsA: false });
  }

  const domain = [];
  for (let v = 1; v <= N; v++) {
    if (used.has(v)) continue;
    let ok = true;
    for (const nb of neighbourBounds) {
      const ov = g[nb.other];
      if (ov === 0) continue; // neighbour not yet set, will be enforced later
      if (nb.selfIsA) {
        // self < other means v < ov
        if (nb.op === '<' && !(v < ov)) { ok = false; break; }
        if (nb.op === '>' && !(v > ov)) { ok = false; break; }
      } else {
        // other < self means ov < v
        if (nb.op === '<' && !(ov < v)) { ok = false; break; }
        if (nb.op === '>' && !(ov > v)) { ok = false; break; }
      }
    }
    if (ok) domain.push(v);
  }
  return domain;
}

// Solve to completion (returns one solution grid or null).
// Internally uses solveRec to count, but snapshots the grid when the first
// solution is found so we can return it.
export function solveOne(grid, givens, constraints, N) {
  const g = grid.slice();
  let captured = null;
  search(g, givens, constraints, N, () => {
    if (!captured) captured = g.slice();
  });
  return captured;
}

// Recursive helper that calls `onSolution` once when it finds a complete fill.
function search(g, givens, constraints, N, onSolution) {
  // Find cell with smallest domain > 1 (MRV heuristic)
  let bestIdx = -1;
  let bestDomain = null;
  for (let i = 0; i < g.length; i++) {
    if (givens.has(i)) continue;
    if (g[i] !== 0) continue;
    const dom = domainOf(i, g, givens, constraints, N);
    if (dom.length === 0) return false;
    if (bestDomain === null || dom.length < bestDomain.length) {
      bestDomain = dom;
      bestIdx = i;
      if (dom.length === 1) break;
    }
  }
  if (bestIdx === -1) {
    onSolution();
    return true;
  }
  for (const v of bestDomain) {
    g[bestIdx] = v;
    if (search(g, givens, constraints, N, onSolution)) {
      g[bestIdx] = 0;
      return true;
    }
    g[bestIdx] = 0;
  }
  return false;
}