import type { Bi } from '../i18n';
import type { CostGrid } from '../routing/cost';
import type { Derived } from './derive';
import type { TerrainGrid } from './grid';

export type OverlayId = 'hillshade' | 'slope' | 'roughness' | 'cost' | 'contours' | 'shielding';

export const CONTOUR_INTERVAL_M = 50;

type RGBA = [number, number, number, number];

/** Slope/roughness ramp stops: [t, r, g, b]. Also used by the legend. */
export const RAMP: [number, number, number, number][] = [
  [0, 68, 1, 84],
  [0.25, 59, 82, 139],
  [0.5, 33, 145, 140],
  [0.75, 94, 201, 98],
  [1, 253, 231, 37],
];

export function ramp(t: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, t));
  for (let i = 1; i < RAMP.length; i++) {
    const [t1, r1, g1, b1] = RAMP[i];
    if (x <= t1) {
      const [t0, r0, g0, b0] = RAMP[i - 1];
      const u = (x - t0) / (t1 - t0);
      return [r0 + (r1 - r0) * u, g0 + (g1 - g0) * u, b0 + (b1 - b0) * u];
    }
  }
  return [253, 231, 37];
}

export const COST_COLORS: Record<number, RGBA> = {
  0: [74, 222, 128, 110],
  1: [251, 191, 36, 140],
  2: [249, 115, 22, 170],
  3: [239, 68, 68, 200],
};

export const SLOPE_MAX_DEG = 35;
export const ROUGHNESS_MAX_DEG = 6;

function toDataUrl(size: number, paint: (i: number, r: number, c: number) => RGBA): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const i = r * size + c;
      const [R, G, B, A] = paint(i, r, c);
      img.data.set([R, G, B, A], i * 4);
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

export function renderOverlay(id: OverlayId, g: TerrainGrid, d: Derived, cost: CostGrid, dose?: Float32Array): string {
  const n = g.size;
  switch (id) {
    case 'hillshade':
      return toDataUrl(n, (i) => {
        const v = Math.round(d.hillshade[i] * 255);
        return [v, v, v, 255];
      });
    case 'slope':
      return toDataUrl(n, (i) => [...ramp(d.slope[i] / SLOPE_MAX_DEG), 200] as RGBA);
    case 'roughness':
      return toDataUrl(n, (i) => [...ramp(d.roughness[i] / ROUGHNESS_MAX_DEG), 200] as RGBA);
    case 'cost':
      return toDataUrl(n, (i) => COST_COLORS[cost.cls[i]]);
    case 'shielding':
      // Open ground (dose 1) stays transparent; the better shielded, the stronger the color.
      return toDataUrl(n, (i) => {
        const shield = dose ? 1 - dose[i] : 0;
        return [...ramp(shield / 0.75), Math.min(220, Math.round(shield * 500))] as RGBA;
      });
    case 'contours': {
      const band = (r: number, c: number) => Math.floor(g.dem[r * n + c] / CONTOUR_INTERVAL_M);
      return toDataUrl(n, (_i, r, c) => {
        const b = band(r, c);
        const edge = (c + 1 < n && band(r, c + 1) !== b) || (r + 1 < n && band(r + 1, c) !== b);
        if (!edge) return [0, 0, 0, 0];
        const major = b % 4 === 0; // every 200 m
        return major ? [255, 255, 255, 230] : [255, 255, 255, 120];
      });
    }
  }
}

export const OVERLAY_LABELS: Record<OverlayId, Bi> = {
  hillshade: { en: 'Shaded relief (illustrative)', es: 'Relieve sombreado (ilustrativo)' },
  slope: { en: 'Slope (°)', es: 'Pendiente (°)' },
  roughness: { en: 'Roughness (proxy)', es: 'Rugosidad (proxy)' },
  cost: { en: 'Cost / hazard map', es: 'Mapa de costo / peligro' },
  contours: { en: `Contour lines (${CONTOUR_INTERVAL_M} m)`, es: `Curvas de nivel (${CONTOUR_INTERVAL_M} m)` },
  shielding: { en: 'Terrain shielding (relative dose, estimated)', es: 'Blindaje del terreno (dosis relativa, estimada)' },
};
