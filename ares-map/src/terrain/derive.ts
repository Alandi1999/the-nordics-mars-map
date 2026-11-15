import type { TerrainGrid } from './grid';

export interface Derived {
  /** Degrees. */
  slope: Float32Array;
  /** Downslope compass bearing in degrees (0 = N, 90 = E). Meaningless where slope is ~0. */
  aspect: Float32Array;
  /** Std. deviation of slope in a 3x3 window, degrees. Proxy for sub-cell roughness (see spec §12). */
  roughness: Float32Array;
  /** 0..1, sun azimuth 315°, altitude 45°. */
  hillshade: Float32Array;
}

const RAD = Math.PI / 180;

export function derive(g: TerrainGrid): Derived {
  const n = g.size;
  const h = g.cellM;
  const z = g.dem;
  const at = (r: number, c: number) => z[Math.min(n - 1, Math.max(0, r)) * n + Math.min(n - 1, Math.max(0, c))];
  const slope = new Float32Array(n * n);
  const aspect = new Float32Array(n * n);
  const hillshade = new Float32Array(n * n);
  const zenith = (90 - 45) * RAD;
  const azimuth = 315 * RAD;

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const gE =
        (at(r - 1, c + 1) + 2 * at(r, c + 1) + at(r + 1, c + 1) - (at(r - 1, c - 1) + 2 * at(r, c - 1) + at(r + 1, c - 1))) /
        (8 * h);
      const dRow =
        (at(r + 1, c - 1) + 2 * at(r + 1, c) + at(r + 1, c + 1) - (at(r - 1, c - 1) + 2 * at(r - 1, c) + at(r - 1, c + 1))) /
        (8 * h);
      const gN = -dRow; // rows grow southwards
      const i = r * n + c;
      const s = Math.atan(Math.hypot(gE, gN));
      slope[i] = s / RAD;
      aspect[i] = ((Math.atan2(-gE, -gN) / RAD) % 360 + 360) % 360;
      hillshade[i] = Math.max(
        0,
        Math.cos(zenith) * Math.cos(s) + Math.sin(zenith) * Math.sin(s) * Math.cos(azimuth - aspect[i] * RAD),
      );
    }
  }

  const roughness = new Float32Array(n * n);
  const sl = (r: number, c: number) => slope[Math.min(n - 1, Math.max(0, r)) * n + Math.min(n - 1, Math.max(0, c))];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      let sum = 0;
      let sum2 = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const v = sl(r + dr, c + dc);
          sum += v;
          sum2 += v * v;
        }
      }
      const mean = sum / 9;
      roughness[r * n + c] = Math.sqrt(Math.max(0, sum2 / 9 - mean * mean));
    }
  }
  return { slope, aspect, roughness, hillshade };
}
