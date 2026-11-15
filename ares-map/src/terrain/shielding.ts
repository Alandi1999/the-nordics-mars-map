import type { TerrainGrid } from './grid';

/** Illustrative assumption: terrain never shields everything (secondaries, scattering). */
export const DOSE_FLOOR = 0.25;
/** Cells at or below this relative dose count as "high shielding" shelter terrain (assumption). */
export const SHELTER_DOSE_MAX = 0.8;
/** RAD surface baseline, Gale only (Hassler et al., Science 2014; Aug 2012 - Jun 2013). */
export const RAD_GALE_MSV_PER_DAY = 0.67;

const DIRS = 16;
/** Sample distances in cells (about 1 km reach at 20 m cells). */
const SAMPLES = [1, 2, 3, 5, 8, 12, 18, 26, 36, 50];

/**
 * Sky-view factor from horizon angles: SVF = 1 - mean(sin(horizon)) over 16 azimuths.
 * 1 on open ground, lower in pits and at the foot of escarpments.
 */
export function skyViewFactor(g: TerrainGrid): Float32Array {
  const n = g.size;
  const out = new Float32Array(n * n);
  const dirs = Array.from({ length: DIRS }, (_, k) => {
    const a = (2 * Math.PI * k) / DIRS;
    return [Math.sin(a), -Math.cos(a)] as const; // [dCol, dRow]; row 0 is north
  });
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const z0 = g.dem[r * n + c];
      let sum = 0;
      for (const [dx, dy] of dirs) {
        let best = 0;
        for (const s of SAMPLES) {
          const rr = Math.round(r + dy * s);
          const cc = Math.round(c + dx * s);
          if (rr < 0 || cc < 0 || rr >= n || cc >= n) break;
          const angle = Math.atan2(g.dem[rr * n + cc] - z0, s * g.cellM);
          if (angle > best) best = angle;
        }
        sum += Math.sin(best);
      }
      out[r * n + c] = 1 - sum / DIRS;
    }
  }
  return out;
}

/** Dose relative to open terrain (1 = open ground). ESTIMATED, see docs/ROUTING.md. */
export function doseRelative(svf: Float32Array): Float32Array {
  const d = new Float32Array(svf.length);
  for (let i = 0; i < d.length; i++) d[i] = Math.max(DOSE_FLOOR, svf[i]);
  return d;
}
