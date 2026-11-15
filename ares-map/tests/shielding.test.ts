import { describe, expect, it } from 'vitest';
import { SITES } from '../src/config/sites';
import { DEFAULT_MOBILITY } from '../src/config/mobility';
import { buildCost } from '../src/routing/cost';
import { pickShelters } from '../src/safety/shelters';
import { derive } from '../src/terrain/derive';
import { generateTerrain, type TerrainGrid } from '../src/terrain/grid';
import { DOSE_FLOOR, doseRelative, skyViewFactor } from '../src/terrain/shielding';

function grid(n: number, f: (r: number, c: number) => number): TerrainGrid {
  const dem = new Float32Array(n * n);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) dem[r * n + c] = f(r, c);
  return { siteId: 'gale', size: n, cellM: 20, extent: [0, 0, 1, 1], dem };
}

describe('sky-view factor', () => {
  it('is 1 on flat ground', () => {
    const svf = skyViewFactor(grid(64, () => 0));
    expect(svf[32 * 64 + 32]).toBeCloseTo(1, 6);
  });

  it('is lower at the bottom of a pit than on its rim, and never below 0', () => {
    const n = 96;
    const pit = grid(n, (r, c) => Math.min(200, 0.5 * Math.hypot(r - 48, c - 48) * 20)); // bowl
    const svf = skyViewFactor(pit);
    const bottom = svf[48 * n + 48];
    const rim = svf[5 * n + 5];
    expect(bottom).toBeLessThan(rim);
    expect(bottom).toBeGreaterThanOrEqual(0);
    expect(doseRelative(svf)[48 * n + 48]).toBeGreaterThanOrEqual(DOSE_FLOOR);
  });
});

describe('shelters', () => {
  for (const site of Object.values(SITES)) {
    it(`${site.id}: picks separated, passable, well-shielded sites; dose varies across the AOI`, () => {
      const g = generateTerrain(site);
      const cost = buildCost(derive(g), DEFAULT_MOBILITY);
      const dose = doseRelative(skyViewFactor(g));
      const min = dose.reduce((a, v) => Math.min(a, v), 1);
      expect(min).toBeLessThan(0.8); // some terrain actually shields
      expect(dose.filter((v) => v > 0.97).length / dose.length).toBeGreaterThan(0.1); // and open ground exists
      const shelters = pickShelters(g, dose, cost);
      expect(shelters.length).toBeGreaterThanOrEqual(2);
      for (const s of shelters) {
        expect(cost.cls[s.cell]).toBeLessThanOrEqual(1);
        expect(s.doseRelative).toBeLessThanOrEqual(0.8);
      }
      for (let i = 0; i < shelters.length; i++)
        for (let j = i + 1; j < shelters.length; j++) {
          const a = shelters[i].cell, b = shelters[j].cell;
          expect(Math.hypot(Math.floor(a / g.size) - Math.floor(b / g.size), (a % g.size) - (b % g.size))).toBeGreaterThanOrEqual(60);
        }
    });
  }
});
