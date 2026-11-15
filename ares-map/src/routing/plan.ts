import type { MobilityConfig } from '../config/mobility';
import type { Derived } from '../terrain/derive';
import { cellCenter, type TerrainGrid } from '../terrain/grid';
import type { Shelter } from '../safety/shelters';
import { aStar, reachable } from './astar';
import type { CostGrid } from './cost';

export type RouteProfile = 'shortest' | 'safe' | 'shelter';

export const PROFILE_INFO: Record<RouteProfile, { label: string; color: string; hint: string }> = {
  shortest: { label: 'Más corta', color: '#38bdf8', hint: 'Solo evita lo prohibido; ignora el esfuerzo.' },
  safe: { label: 'Más segura', color: '#4ade80', hint: 'Penaliza fuerte pendientes y rugosidad.' },
  shelter: { label: 'Con refugio cercano', color: '#fbbf24', hint: 'Prefiere terreno blindado (menor dosis relativa) y pasa cerca de refugios.' },
};

export interface RouteStats {
  distanceM: number;
  /** Walking time with the team's speed assumption, slowed by the cell cost. */
  timeMin: number;
  maxSlopeDeg: number;
  ascentM: number;
  descentM: number;
  /** 0 (benign) .. 100 (high). ESTIMATED: see docs/ROUTING.md. */
  risk: number;
  /** Mean dose relative to open terrain along the route (1 = open ground). ESTIMATED. */
  meanDose: number;
  /** Farthest straight-line distance from the route to the nearest shelter site. */
  maxShelterDistM: number | null;
  /** Share of the route length per cell class (0..3). */
  classShare: [number, number, number, number];
}

export interface ProfilePoint {
  /** Meters from the start. */
  d: number;
  elevationM: number;
  slopeDeg: number;
  cls: number;
}

export interface Route {
  profile: RouteProfile;
  cells: number[];
  coords: [number, number][];
  stats: RouteStats;
  profilePoints: ProfilePoint[];
  /** Set when this route is cell-for-cell identical to an earlier profile. */
  sameAs?: RouteProfile;
}

const CLASS_RISK = [0, 0.25, 0.6, 1];

/** Plain mobility weights (used for travel-time estimates, e.g. time to shelter). */
export function travelWeights(cost: CostGrid): Float32Array {
  return Float32Array.from(cost.cost);
}

export function weightsFor(profile: RouteProfile, cost: CostGrid, dose: Float32Array): Float32Array {
  const w = new Float32Array(cost.cost.length);
  for (let i = 0; i < w.length; i++) {
    if (cost.cls[i] === 3) w[i] = Infinity;
    else if (profile === 'shortest') w[i] = 1;
    else if (profile === 'safe') w[i] = cost.cost[i] * cost.cost[i] * (1 + 0.5 * cost.cls[i]);
    else w[i] = cost.cost[i] * (1 + 2 * dose[i]);
  }
  return w;
}

export function routeStats(
  cells: number[],
  g: TerrainGrid,
  d: Derived,
  cost: CostGrid,
  cfg: MobilityConfig,
  dose: Float32Array,
  shelters: Shelter[],
): { stats: RouteStats; profilePoints: ProfilePoint[] } {
  const n = g.size;
  const points: ProfilePoint[] = [];
  let dist = 0;
  let weighted = 0;
  let ascent = 0;
  let descent = 0;
  let maxSlope = 0;
  const share: [number, number, number, number] = [0, 0, 0, 0];
  let doseSum = 0;
  let maxShelter: number | null = shelters.length ? 0 : null;
  cells.forEach((cell, k) => {
    let seg = 0;
    if (k > 0) {
      const prev = cells[k - 1];
      const diag = Math.floor(prev / n) !== Math.floor(cell / n) && prev % n !== cell % n;
      seg = (diag ? Math.SQRT2 : 1) * g.cellM;
      const dz = g.dem[cell] - g.dem[prev];
      if (dz > 0) ascent += dz;
      else descent -= dz;
      const factor = (cost.cost[prev] + cost.cost[cell]) / 2;
      weighted += seg * factor;
      share[cost.cls[cell]] += seg;
      doseSum += seg * dose[cell];
    }
    if (maxShelter !== null) {
      const r = Math.floor(cell / n);
      const c = cell % n;
      const near = Math.min(...shelters.map((sh) => Math.hypot(Math.floor(sh.cell / n) - r, (sh.cell % n) - c))) * g.cellM;
      maxShelter = Math.max(maxShelter, near);
    }
    dist += seg;
    maxSlope = Math.max(maxSlope, d.slope[cell]);
    points.push({ d: dist, elevationM: g.dem[cell], slopeDeg: d.slope[cell], cls: cost.cls[cell] });
  });
  const total = dist || 1;
  const classShare = share.map((s) => s / total) as [number, number, number, number];
  const meanRisk = classShare.reduce((a, s, k) => a + s * CLASS_RISK[k], 0);
  const risk = Math.round(100 * Math.min(1, 0.7 * meanRisk + 0.3 * (maxSlope / cfg.slopeNoGoDeg)));
  return {
    stats: {
      distanceM: dist,
      timeMin: (weighted / 1000 / cfg.walkSpeedKmh) * 60,
      maxSlopeDeg: maxSlope,
      ascentM: ascent,
      descentM: descent,
      risk,
      meanDose: doseSum / total,
      maxShelterDistM: maxShelter,
      classShare,
    },
    profilePoints: points,
  };
}

/** Plans the three route profiles. Returns [] when start/end are impassable or disconnected. */
export function planRoutes(
  g: TerrainGrid,
  d: Derived,
  cost: CostGrid,
  cfg: MobilityConfig,
  start: number,
  end: number,
  dose: Float32Array,
  shelters: Shelter[],
): Route[] {
  const routes: Route[] = [];
  for (const profile of ['shortest', 'safe', 'shelter'] as RouteProfile[]) {
    const cells = aStar(weightsFor(profile, cost, dose), g.size, g.cellM, start, end);
    if (!cells) return [];
    const { stats, profilePoints } = routeStats(cells, g, d, cost, cfg, dose, shelters);
    const coords = cells.map((c) => cellCenter(g, Math.floor(c / g.size), c % g.size));
    const route: Route = { profile, cells, coords, stats, profilePoints };
    const twin = routes.find((r) => r.cells.length === cells.length && r.cells.every((v, i) => v === cells[i]));
    if (twin) route.sameAs = twin.profile;
    routes.push(route);
  }
  return routes;
}

/** Nearest passable cell to (r0, c0), searching outwards in square rings. */
export function nearestPassable(w: Float32Array, n: number, r0: number, c0: number): number | null {
  for (let radius = 0; radius < n; radius++) {
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== radius) continue;
        const r = r0 + dr;
        const c = c0 + dc;
        if (r < 0 || c < 0 || r >= n || c >= n) continue;
        if (Number.isFinite(w[r * n + c])) return r * n + c;
      }
    }
  }
  return null;
}

/** A deterministic, always-connected demo pair: SW corner area to the farthest reachable cell. */
export function examplePair(g: TerrainGrid, cost: CostGrid): { start: number; end: number } | null {
  const n = g.size;
  const w = travelWeights(cost);
  const start = nearestPassable(w, n, Math.floor(0.86 * n), Math.floor(0.14 * n));
  if (start === null) return null;
  const seen = reachable(w, n, start);
  const sr = Math.floor(start / n);
  const sc = start % n;
  let best = -1;
  let bestD = -1;
  for (let i = 0; i < seen.length; i++) {
    if (!seen[i]) continue;
    const dd = (Math.floor(i / n) - sr) ** 2 + ((i % n) - sc) ** 2;
    if (dd > bestD) {
      bestD = dd;
      best = i;
    }
  }
  return best >= 0 && best !== start ? { start, end: best } : null;
}
