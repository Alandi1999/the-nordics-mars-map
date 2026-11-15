/** A* on an 8-connected grid. `w` is a per-cell weight (>= 1, Infinity = impassable). */

class MinHeap {
  private keys: number[] = [];
  private ids: number[] = [];
  get size() {
    return this.ids.length;
  }
  push(key: number, id: number) {
    let i = this.ids.length;
    this.keys.push(key);
    this.ids.push(id);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.keys[p] <= key) break;
      this.keys[i] = this.keys[p];
      this.ids[i] = this.ids[p];
      i = p;
    }
    this.keys[i] = key;
    this.ids[i] = id;
  }
  pop(): number {
    const top = this.ids[0];
    const key = this.keys.pop()!;
    const id = this.ids.pop()!;
    const n = this.ids.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && this.keys[c + 1] < this.keys[c]) c++;
        if (this.keys[c] >= key) break;
        this.keys[i] = this.keys[c];
        this.ids[i] = this.ids[c];
        i = c;
      }
      this.keys[i] = key;
      this.ids[i] = id;
    }
    return top;
  }
}

const SQRT2 = Math.SQRT2;
const DIRS: [number, number][] = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
  [-1, -1], [-1, 1], [1, -1], [1, 1],
];

/** Exact shortest length on an 8-connected grid, in cells (admissible heuristic when weights >= 1). */
const octile = (dr: number, dc: number) => {
  const a = Math.abs(dr);
  const b = Math.abs(dc);
  return a + b + (SQRT2 - 2) * Math.min(a, b);
};

/** Returns the cell indices from start to goal (inclusive), or null when unreachable. */
export function aStar(w: Float32Array, n: number, cellM: number, start: number, goal: number): number[] | null {
  if (!Number.isFinite(w[start]) || !Number.isFinite(w[goal])) return null;
  const g = new Float64Array(n * n).fill(Infinity);
  const from = new Int32Array(n * n).fill(-1);
  const closed = new Uint8Array(n * n);
  const gr = Math.floor(goal / n);
  const gc = goal % n;
  const heap = new MinHeap();
  g[start] = 0;
  heap.push(octile(Math.floor(start / n) - gr, (start % n) - gc) * cellM, start);

  while (heap.size > 0) {
    const cur = heap.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (cur === goal) {
      const path: number[] = [];
      for (let i = goal; i !== -1; i = from[i]) path.push(i);
      return path.reverse();
    }
    const r = Math.floor(cur / n);
    const c = cur % n;
    for (const [dr, dc] of DIRS) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= n || nc >= n) continue;
      const ni = nr * n + nc;
      if (closed[ni] || !Number.isFinite(w[ni])) continue;
      const diagonal = dr !== 0 && dc !== 0;
      // No cutting corners through impassable cells.
      if (diagonal && (!Number.isFinite(w[r * n + nc]) || !Number.isFinite(w[nr * n + c]))) continue;
      const step = (diagonal ? SQRT2 : 1) * cellM * ((w[cur] + w[ni]) / 2);
      const ng = g[cur] + step;
      if (ng < g[ni]) {
        g[ni] = ng;
        from[ni] = cur;
        heap.push(ng + octile(nr - gr, nc - gc) * cellM, ni);
      }
    }
  }
  return null;
}

/** Cells reachable from `start` with the same movement rules (flood fill). */
export function reachable(w: Float32Array, n: number, start: number): Uint8Array {
  const seen = new Uint8Array(n * n);
  if (!Number.isFinite(w[start])) return seen;
  const stack = [start];
  seen[start] = 1;
  while (stack.length) {
    const cur = stack.pop()!;
    const r = Math.floor(cur / n);
    const c = cur % n;
    for (const [dr, dc] of DIRS) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= n || nc >= n) continue;
      const ni = nr * n + nc;
      if (seen[ni] || !Number.isFinite(w[ni])) continue;
      if (dr !== 0 && dc !== 0 && (!Number.isFinite(w[r * n + nc]) || !Number.isFinite(w[nr * n + c]))) continue;
      seen[ni] = 1;
      stack.push(ni);
    }
  }
  return seen;
}
