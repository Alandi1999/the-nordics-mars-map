import { describe, expect, it } from 'vitest';
import { SITES } from '../src/config/sites';
import { DEFAULT_MOBILITY } from '../src/config/mobility';
import { buildCost } from '../src/routing/cost';
import { derive } from '../src/terrain/derive';
import { cellAt, cellCenter, generateTerrain, type TerrainGrid } from '../src/terrain/grid';

function plane(size: number, cellM: number, dzdE: number, dzdN: number): TerrainGrid {
  const dem = new Float32Array(size * size);
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++) dem[r * size + c] = dzdE * c * cellM + dzdN * (size - 1 - r) * cellM;
  return { siteId: 'gale', size, cellM, extent: [0, 0, 1, 1], dem };
}

describe('derive', () => {
  it('slope of a 10% grade plane is atan(0.1)', () => {
    const d = derive(plane(16, 20, 0.1, 0));
    expect(d.slope[8 * 16 + 8]).toBeCloseTo((Math.atan(0.1) * 180) / Math.PI, 4);
  });

  it('aspect is the downslope bearing: plane rising east faces west (270°)', () => {
    const d = derive(plane(16, 20, 0.1, 0));
    expect(d.aspect[8 * 16 + 8]).toBeCloseTo(270, 3);
  });

  it('aspect: plane rising north faces south (180°)', () => {
    const d = derive(plane(16, 20, 0, 0.1));
    expect(d.aspect[8 * 16 + 8]).toBeCloseTo(180, 3);
  });

  it('flat plane has zero slope, zero roughness and hillshade cos(zenith)', () => {
    const d = derive(plane(16, 20, 0, 0));
    expect(d.slope[8 * 16 + 8]).toBe(0);
    expect(d.roughness[8 * 16 + 8]).toBe(0);
    expect(d.hillshade[8 * 16 + 8]).toBeCloseTo(Math.cos((45 * Math.PI) / 180), 5);
  });
});

describe('cost grid', () => {
  it('classifies by thresholds and makes steep cells impassable', () => {
    const d = derive(plane(8, 20, 0, 0));
    d.slope.set([5, 15, 22, 30]);
    const { cost, cls } = buildCost(d, DEFAULT_MOBILITY);
    expect(Array.from(cls.slice(0, 4))).toEqual([0, 1, 2, 3]);
    expect(cost[3]).toBe(Infinity);
    expect(cost[0]).toBeCloseTo(1 + 0.01 * 25, 5);
  });

  it('thresholds are editable and change the result', () => {
    const d = derive(plane(8, 20, 0, 0));
    d.slope.set([12]);
    expect(buildCost(d, DEFAULT_MOBILITY).cls[0]).toBe(1);
    expect(buildCost(d, { ...DEFAULT_MOBILITY, slopeNoGoDeg: 11 }).cls[0]).toBe(3);
  });
});

describe('illustrative terrain', () => {
  it('is deterministic per site and differs between sites', () => {
    const a = generateTerrain(SITES.gale);
    const b = generateTerrain(SITES.gale);
    const j = generateTerrain(SITES.jezero);
    expect(Array.from(a.dem.slice(0, 50))).toEqual(Array.from(b.dem.slice(0, 50)));
    expect(a.dem[1000]).not.toBe(j.dem[1000]);
  });

  it('has a usable mix of terrain: mostly passable, some no-go, some comfortable', () => {
    for (const site of Object.values(SITES)) {
      const g = generateTerrain(site);
      const { cls } = buildCost(derive(g), DEFAULT_MOBILITY);
      const frac = (k: number) => cls.filter((v) => v === k).length / cls.length;
      expect(frac(3), `${site.id} no-go`).toBeGreaterThan(0.01);
      expect(frac(3), `${site.id} no-go`).toBeLessThan(0.35);
      expect(frac(0), `${site.id} comfortable`).toBeGreaterThan(0.3);
    }
  });

  it('cellAt and cellCenter are inverse', () => {
    const g = generateTerrain(SITES.gale);
    const [lon, lat] = cellCenter(g, 100, 200);
    expect(cellAt(g, lon, lat)).toEqual({ r: 100, c: 200 });
    expect(cellAt(g, g.extent[2] + 1, lat)).toBeNull();
  });
});

import { probeAt } from '../src/terrain/probe';
import { doseRelative, skyViewFactor } from '../src/terrain/shielding';

describe('probe', () => {
  it('returns exactly the raster values for a cell and null outside the AOI', () => {
    const g = generateTerrain(SITES.gale);
    const d = derive(g);
    const cost = buildCost(d, DEFAULT_MOBILITY);
    const [lon, lat] = cellCenter(g, 250, 300);
    const dose = doseRelative(skyViewFactor(g));
    const p = probeAt(g, d, cost, dose, lon, lat)!;
    const i = 250 * g.size + 300;
    expect(p.elevationM).toBe(g.dem[i]);
    expect(p.slopeDeg).toBe(d.slope[i]);
    expect(p.roughnessDeg).toBe(d.roughness[i]);
    expect(p.cls).toBe(cost.cls[i]);
    expect(p.doseRelative).toBe(dose[i]);
    expect(p.doseMsvDay).toBeCloseTo(dose[i] * 0.67, 9);
    expect(probeAt(g, d, cost, dose, 0, 0)).toBeNull();
  });
});

describe('probe dose is site-aware (D7)', () => {
  it('reports mSv/day only at Gale, where RAD measured the baseline', () => {
    for (const [id, expectNull] of [['gale', false], ['jezero', true]] as const) {
      const g = generateTerrain(SITES[id]);
      const d = derive(g);
      const cost = buildCost(d, DEFAULT_MOBILITY);
      const dose = doseRelative(skyViewFactor(g));
      const [lon, lat] = cellCenter(g, 10, 10);
      const p = probeAt(g, d, cost, dose, lon, lat)!;
      expect(p.doseMsvDay === null).toBe(expectNull);
    }
  });
});
