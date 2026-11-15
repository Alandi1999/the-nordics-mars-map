import type { SiteConfig, SiteId } from '../config/sites';
import { METERS_PER_DEGREE, metersPerDegreeLon } from '../lib/mars';
import { fbm, smoothstep } from './noise';

export const GRID_SIZE = 512;
export const CELL_M = 20;

/** Illustrative terrain parameters per site. Base elevations come from the spec (§3); relief is invented. */
const PARAMS: Record<SiteId, { seed: number; baseElevM: number; reliefM: number; cliff: number }> = {
  gale: { seed: 1337, baseElevM: -4400, reliefM: 650, cliff: 0.3 },
  jezero: { seed: 2021, baseElevM: -2656, reliefM: 380, cliff: 0.6 },
};

export interface TerrainGrid {
  siteId: SiteId;
  size: number;
  cellM: number;
  /** [minLon, minLat, maxLon, maxLat] */
  extent: [number, number, number, number];
  /** Row 0 is the northern edge. Meters. */
  dem: Float32Array;
}

export function terrainExtent(site: SiteConfig): [number, number, number, number] {
  const [lon, lat] = site.center;
  const half = (GRID_SIZE * CELL_M) / 2;
  const dLon = half / metersPerDegreeLon(lat);
  const dLat = half / METERS_PER_DEGREE;
  return [lon - dLon, lat - dLat, lon + dLon, lat + dLat];
}

export function generateTerrain(site: SiteConfig): TerrainGrid {
  const { seed, baseElevM, reliefM, cliff: cliffK } = PARAMS[site.id];
  const n = GRID_SIZE;
  const dem = new Float32Array(n * n);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const nx = c / n;
      const ny = r / n;
      const rough = fbm(nx * 4, ny * 4, 5, seed);
      const ridge = 1 - Math.abs(2 * fbm(nx * 2.5 + 10, ny * 2.5 + 10, 4, seed + 7) - 1);
      const mount = smoothstep(0.35, 1.0, ny * 0.7 + (1 - nx) * 0.3);
      // Escarpment whose height varies along its length, leaving natural passes.
      const cliffH = smoothstep(0.35, 0.55, fbm(nx * 3 + 50, ny * 3 + 50, 3, seed + 31));
      const cliff = cliffH * smoothstep(-0.015, 0.015, nx + ny * 0.5 - 0.95);
      dem[r * n + c] = baseElevM + reliefM * (0.35 * rough + 0.25 * ridge + 0.7 * mount + cliffK * cliff);
    }
  }
  return { siteId: site.id, size: n, cellM: CELL_M, extent: terrainExtent(site), dem };
}

/** Maps lon/lat to a cell index, or null outside the grid. */
export function cellAt(g: TerrainGrid, lon: number, lat: number): { r: number; c: number } | null {
  const [minLon, minLat, maxLon, maxLat] = g.extent;
  if (lon < minLon || lon >= maxLon || lat <= minLat || lat > maxLat) return null;
  const c = Math.floor(((lon - minLon) / (maxLon - minLon)) * g.size);
  const r = Math.floor(((maxLat - lat) / (maxLat - minLat)) * g.size);
  return { r, c };
}

/** Center of cell (r, c) as lon/lat. */
export function cellCenter(g: TerrainGrid, r: number, c: number): [number, number] {
  const [minLon, minLat, maxLon, maxLat] = g.extent;
  return [
    minLon + ((c + 0.5) / g.size) * (maxLon - minLon),
    maxLat - ((r + 0.5) / g.size) * (maxLat - minLat),
  ];
}
