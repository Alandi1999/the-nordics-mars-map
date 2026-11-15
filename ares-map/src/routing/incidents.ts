import type { SiteId } from '../config/sites';
import type { Bi } from '../i18n';
import { METERS_PER_DEGREE, metersPerDegreeLon } from '../lib/mars';
import { cellAt, type TerrainGrid } from '../terrain/grid';
import type { CostGrid } from './cost';

export type IncidentType = 'unstable_ground' | 'blocked' | 'dust' | 'other';

export const INCIDENT_LABEL: Record<IncidentType, Bi> = {
  unstable_ground: { en: 'Unstable ground', es: 'Terreno inestable' },
  blocked: { en: 'Blocked passage', es: 'Paso bloqueado' },
  dust: { en: 'Dust / low visibility', es: 'Polvo / baja visibilidad' },
  other: { en: 'Other', es: 'Otro' },
};

/** Local observation (tier 2) queued to sync with Earth when there is a link. */
export interface Incident {
  id: string;
  siteId: SiteId;
  createdAt: string;
  lonlat: [number, number];
  radiusM: number;
  type: IncidentType;
  note?: string;
  tier: 2;
  syncedToEarth: boolean;
}

/** Marks every cell whose center lies within the incident radius as impassable. */
export function applyIncidents(g: TerrainGrid, cost: CostGrid, incidents: Incident[]): CostGrid {
  const mine = incidents.filter((i) => i.siteId === g.siteId);
  if (mine.length === 0) return cost;
  const out: CostGrid = { cost: Float32Array.from(cost.cost), cls: Uint8Array.from(cost.cls) };
  const n = g.size;
  for (const inc of mine) {
    const c0 = cellAt(g, inc.lonlat[0], inc.lonlat[1]);
    if (!c0) continue;
    const reach = Math.ceil(inc.radiusM / g.cellM);
    for (let r = Math.max(0, c0.r - reach); r <= Math.min(n - 1, c0.r + reach); r++) {
      for (let c = Math.max(0, c0.c - reach); c <= Math.min(n - 1, c0.c + reach); c++) {
        if (Math.hypot(r - c0.r, c - c0.c) * g.cellM <= inc.radiusM) {
          out.cls[r * n + c] = 3;
          out.cost[r * n + c] = Infinity;
        }
      }
    }
  }
  return out;
}

/** Polygon ring (lon/lat) approximating a circle of `radiusM` meters. */
export function circleRing(lon: number, lat: number, radiusM: number, steps = 40): [number, number][] {
  const ring: [number, number][] = [];
  for (let k = 0; k <= steps; k++) {
    const a = (2 * Math.PI * k) / steps;
    ring.push([lon + (radiusM * Math.cos(a)) / metersPerDegreeLon(lat), lat + (radiusM * Math.sin(a)) / METERS_PER_DEGREE]);
  }
  return ring;
}

const KEY = 'ares-map.incidents.v1';

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Keeps only well-formed incidents: stored data is untrusted and a bad entry must not crash the app. */
export function parseIncidents(raw: unknown): Incident[] {
  if (!Array.isArray(raw)) return [];
  const out: Incident[] = [];
  for (const e of raw as unknown[]) {
    if (typeof e !== 'object' || e === null) continue;
    const o = e as Record<string, unknown>;
    const ll = o.lonlat;
    if (
      typeof o.id !== 'string' ||
      (o.siteId !== 'gale' && o.siteId !== 'jezero') ||
      typeof o.createdAt !== 'string' ||
      !Array.isArray(ll) || ll.length !== 2 || !isNum(ll[0]) || !isNum(ll[1]) ||
      !isNum(o.radiusM) || o.radiusM <= 0 || o.radiusM > 5000 ||
      typeof o.type !== 'string' || !Object.prototype.hasOwnProperty.call(INCIDENT_LABEL, o.type) ||
      typeof o.syncedToEarth !== 'boolean'
    ) continue;
    out.push({
      id: o.id,
      siteId: o.siteId,
      createdAt: o.createdAt,
      lonlat: [ll[0], ll[1]],
      radiusM: o.radiusM,
      type: o.type as IncidentType,
      note: typeof o.note === 'string' ? o.note : undefined,
      tier: 2,
      syncedToEarth: o.syncedToEarth,
    });
  }
  return out;
}

export function loadIncidents(): Incident[] {
  try {
    const raw = localStorage.getItem(KEY);
    return parseIncidents(raw ? JSON.parse(raw) : []);
  } catch {
    return [];
  }
}

export function saveIncidents(list: Incident[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage can be unavailable (private mode); the queue then lives in memory only */
  }
}
