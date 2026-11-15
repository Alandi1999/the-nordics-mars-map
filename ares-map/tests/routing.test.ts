import { describe, expect, it } from 'vitest';
import { SITES } from '../src/config/sites';
import { DEFAULT_MOBILITY } from '../src/config/mobility';
import { aStar } from '../src/routing/astar';
import { buildCost } from '../src/routing/cost';
import { examplePair, planRoutes, weightsFor } from '../src/routing/plan';
import { pickShelters } from '../src/safety/shelters';
import { doseRelative, skyViewFactor } from '../src/terrain/shielding';
import { derive } from '../src/terrain/derive';
import { generateTerrain } from '../src/terrain/grid';

const N = 40;
const flat = () => new Float32Array(N * N).fill(1);
const idx = (r: number, c: number) => r * N + c;

describe('aStar', () => {
  it('finds a near-straight path on open ground (octile length)', () => {
    const p = aStar(flat(), N, 10, idx(5, 5), idx(5, 35))!;
    expect(p.length).toBe(31);
    expect(p[0]).toBe(idx(5, 5));
    expect(p.at(-1)).toBe(idx(5, 35));
  });

  it('goes around a wall through its gap and never touches impassable cells', () => {
    const w = flat();
    for (let r = 0; r < N; r++) if (r !== 30) w[idx(r, 20)] = Infinity;
    const p = aStar(w, N, 10, idx(5, 5), idx(5, 35))!;
    expect(p.some((i) => !Number.isFinite(w[i]))).toBe(false);
    expect(p).toContain(idx(30, 20));
  });

  it('returns null when fully blocked or when an endpoint is impassable', () => {
    const w = flat();
    for (let r = 0; r < N; r++) w[idx(r, 20)] = Infinity;
    expect(aStar(w, N, 10, idx(5, 5), idx(5, 35))).toBeNull();
    expect(aStar(flat().fill(Infinity, idx(5, 35), idx(5, 35) + 1), N, 10, idx(5, 5), idx(5, 35))).toBeNull();
  });

  it('does not cut corners between two diagonal obstacles', () => {
    const w = flat();
    w[idx(10, 11)] = Infinity;
    w[idx(11, 10)] = Infinity;
    const p = aStar(w, N, 10, idx(10, 10), idx(11, 11))!;
    expect(p.length).toBeGreaterThan(2); // a direct diagonal step would be length 2
    expect(p).not.toContain(idx(10, 11));
    expect(p).not.toContain(idx(11, 10));
  });

  it('prefers a longer low-weight detour over a short high-weight one', () => {
    const w = flat();
    for (let c = 10; c < 30; c++) for (let r = 18; r < 22; r++) w[idx(r, c)] = 9;
    const p = aStar(w, N, 10, idx(20, 5), idx(20, 35))!;
    expect(p.some((i) => w[i] === 9)).toBe(false);
  });
});

describe('route planning on illustrative terrain', () => {
  for (const site of Object.values(SITES)) {
    it(`${site.id}: example pair is connected, routes avoid no-go cells, and finish in < 2 s`, () => {
      const g = generateTerrain(site);
      const d = derive(g);
      const cost = buildCost(d, DEFAULT_MOBILITY);
      const dose = doseRelative(skyViewFactor(g));
      const shelters = pickShelters(g, dose, cost);
      const pair = examplePair(g, cost)!;
      expect(pair).not.toBeNull();
      const t0 = performance.now();
      const routes = planRoutes(g, d, cost, DEFAULT_MOBILITY, pair.start, pair.end, dose, shelters);
      const ms = performance.now() - t0;
      expect(routes).toHaveLength(3);
      expect(ms).toBeLessThan(2000);
      for (const r of routes) {
        expect(r.cells.some((c) => cost.cls[c] === 3)).toBe(false);
        expect(r.cells[0]).toBe(pair.start);
        expect(r.cells.at(-1)).toBe(pair.end);
        expect(r.stats.maxSlopeDeg).toBeLessThanOrEqual(DEFAULT_MOBILITY.slopeNoGoDeg);
        expect(r.stats.risk).toBeGreaterThanOrEqual(0);
        expect(r.stats.risk).toBeLessThanOrEqual(100);
      }
      const by = Object.fromEntries(routes.map((r) => [r.profile, r]));
      expect(routes.map((r) => r.profile)).toEqual(['shortest', 'safe', 'shelter']);
      expect(by.shortest.stats.distanceM).toBeLessThanOrEqual(by.safe.stats.distanceM + 1e-6);
      expect(by.safe.stats.risk).toBeLessThanOrEqual(by.shortest.stats.risk);
      // Each route must be optimal for its own objective (A* with an admissible heuristic).
      const objective = (profile: 'shortest' | 'safe' | 'shelter', cells: number[]) => {
        const w = weightsFor(profile, cost, dose);
        let sum = 0;
        for (let k = 1; k < cells.length; k++) {
          const a = cells[k - 1];
          const b = cells[k];
          const diag = Math.floor(a / g.size) !== Math.floor(b / g.size) && a % g.size !== b % g.size;
          sum += (diag ? Math.SQRT2 : 1) * g.cellM * ((w[a] + w[b]) / 2);
        }
        return sum;
      };
      for (const p of ['shortest', 'safe', 'shelter'] as const)
        for (const other of routes) expect(objective(p, by[p].cells)).toBeLessThanOrEqual(objective(p, other.cells) * (1 + 1e-6));
    });
  }

  it('route distance equals the sum of its steps', () => {
    const g = generateTerrain(SITES.gale);
    const d = derive(g);
    const cost = buildCost(d, DEFAULT_MOBILITY);
    const { start, end } = examplePair(g, cost)!;
    const dose = doseRelative(skyViewFactor(g));
    const [r] = planRoutes(g, d, cost, DEFAULT_MOBILITY, start, end, dose, pickShelters(g, dose, cost));
    let sum = 0;
    for (let k = 1; k < r.cells.length; k++) {
      const a = r.cells[k - 1];
      const b = r.cells[k];
      const diag = Math.floor(a / g.size) !== Math.floor(b / g.size) && a % g.size !== b % g.size;
      sum += (diag ? Math.SQRT2 : 1) * g.cellM;
    }
    expect(r.stats.distanceM).toBeCloseTo(sum, 6);
    expect(r.profilePoints.at(-1)!.d).toBeCloseTo(sum, 6);
  });

  it('weights are impassable exactly where cells are no-go', () => {
    const g = generateTerrain(SITES.gale);
    const cost = buildCost(derive(g), DEFAULT_MOBILITY);
    const dose = doseRelative(skyViewFactor(g));
    for (const p of ['shortest', 'safe', 'shelter'] as const) {
      const w = weightsFor(p, cost, dose);
      for (let i = 0; i < w.length; i += 97) expect(!Number.isFinite(w[i])).toBe(cost.cls[i] === 3);
    }
  });
});
