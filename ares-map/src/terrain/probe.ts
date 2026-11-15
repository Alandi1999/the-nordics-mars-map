import type { Bi } from '../i18n';
import type { CostGrid } from '../routing/cost';
import type { Derived } from './derive';
import { cellAt, type TerrainGrid } from './grid';
import { RAD_GALE_MSV_PER_DAY } from './shielding';

const NAMES: Bi[] = [
  { en: 'N', es: 'N' },
  { en: 'NE', es: 'NE' },
  { en: 'E', es: 'E' },
  { en: 'SE', es: 'SE' },
  { en: 'S', es: 'S' },
  { en: 'SW', es: 'SO' },
  { en: 'W', es: 'O' },
  { en: 'NW', es: 'NO' },
];
export const compass = (deg: number): Bi => NAMES[Math.round(deg / 45) % 8];

export interface Probe {
  lon: number;
  lat: number;
  elevationM: number;
  slopeDeg: number;
  aspectDeg: number;
  roughnessDeg: number;
  cls: number;
  costMultiplier: number;
  /** Dose relative to open terrain (1 = open). ESTIMATED. */
  doseRelative: number;
  /** Gale only: relative dose x RAD baseline. Null elsewhere (no RAD measurement, spec D7). */
  doseMsvDay: number | null;
}

/** Values are read straight from the rasters, so the popup always matches the layers. */
export function probeAt(g: TerrainGrid, d: Derived, cost: CostGrid, dose: Float32Array, lon: number, lat: number): Probe | null {
  const cell = cellAt(g, lon, lat);
  if (!cell) return null;
  const i = cell.r * g.size + cell.c;
  return {
    lon,
    lat,
    elevationM: g.dem[i],
    slopeDeg: d.slope[i],
    aspectDeg: d.aspect[i],
    roughnessDeg: d.roughness[i],
    cls: cost.cls[i],
    costMultiplier: cost.cost[i],
    doseRelative: dose[i],
    doseMsvDay: g.siteId === 'gale' ? dose[i] * RAD_GALE_MSV_PER_DAY : null,
  };
}
