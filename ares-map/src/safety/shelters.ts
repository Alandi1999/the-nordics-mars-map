import type { CostGrid } from '../routing/cost';
import { cellCenter, type TerrainGrid } from '../terrain/grid';
import { SHELTER_DOSE_MAX } from '../terrain/shielding';

export interface Shelter {
  id: string;
  cell: number;
  coord: [number, number];
  doseRelative: number;
}

/**
 * Picks up to `max` shelter sites: the best-shielded passable cells (comfort/caution classes),
 * at least `minSepCells` apart. Candidate sites for the concept, not surveyed locations.
 */
export function pickShelters(g: TerrainGrid, dose: Float32Array, cost: CostGrid, max = 6, minSepCells = 60): Shelter[] {
  const n = g.size;
  const cand: number[] = [];
  for (let i = 0; i < dose.length; i++) if (cost.cls[i] <= 1 && dose[i] <= SHELTER_DOSE_MAX) cand.push(i);
  cand.sort((a, b) => dose[a] - dose[b]);
  const picked: Shelter[] = [];
  for (const i of cand) {
    const r = Math.floor(i / n);
    const c = i % n;
    if (picked.some((s) => Math.hypot(Math.floor(s.cell / n) - r, (s.cell % n) - c) < minSepCells)) continue;
    picked.push({ id: `R${picked.length + 1}`, cell: i, coord: cellCenter(g, r, c), doseRelative: dose[i] });
    if (picked.length >= max) break;
  }
  return picked;
}
