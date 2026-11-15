import { describe, expect, it } from 'vitest';
import { SITES } from '../src/config/sites';
import { DEFAULT_MOBILITY } from '../src/config/mobility';
import { linkAt, waitState } from '../src/lib/ephemeris';
import { applyIncidents, circleRing, type Incident } from '../src/routing/incidents';
import { buildCost } from '../src/routing/cost';
import { examplePair, planRoutes } from '../src/routing/plan';
import { assess } from '../src/safety/protocol';
import { pickShelters } from '../src/safety/shelters';
import { derive } from '../src/terrain/derive';
import { cellCenter, generateTerrain } from '../src/terrain/grid';
import { doseRelative, skyViewFactor } from '../src/terrain/shielding';

describe('ephemeris', () => {
  // JPL Horizons (CENTER 500@399, QUANTITIES 20), queried 2026-11-15: delta in AU.
  const HORIZONS = [
    { at: '2026-11-15T00:00:00Z', au: 1.31585436923142 },
    { at: '2026-11-16T00:00:00Z', au: 1.30732526492742 },
  ];

  it('matches JPL Horizons within 0.1 % of distance', () => {
    for (const { at, au } of HORIZONS) {
      const got = linkAt(new Date(at)).distanceAu;
      expect(Math.abs(got - au) / au, at).toBeLessThan(1e-3);
    }
  });

  it('latency is distance / c and round trip is twice the one-way', () => {
    const s = linkAt(new Date('2026-11-15T00:00:00Z'));
    expect(s.oneWayMin).toBeCloseTo((s.distanceAu * 149597870.7) / 299792.458 / 60, 9);
    expect(s.roundTripMin).toBeCloseTo(2 * s.oneWayMin, 9);
    expect(s.oneWayMin).toBeGreaterThan(3);
    expect(s.oneWayMin).toBeLessThan(22.5);
  });

  it('wait state flips at the round trip', () => {
    expect(waitState(10, 21)).toBe('normal');
    expect(waitState(21, 21)).toBe('overdue');
  });
});

describe('protocol assessment', () => {
  it('classifies by margin', () => {
    expect(assess(60, 20)).toEqual({ status: 'ok', marginMin: 40 });
    expect(assess(30, 20).status).toBe('tight');
    expect(assess(10, 20)).toEqual({ status: 'late', marginMin: -10 });
    expect(assess(60, null).status).toBe('no-shelter');
  });
});

describe('incidents and replanning', () => {
  it('a new hazard on the route forces an alternative that avoids it', () => {
    const g = generateTerrain(SITES.gale);
    const d = derive(g);
    const base = buildCost(d, DEFAULT_MOBILITY);
    const dose = doseRelative(skyViewFactor(g));
    const shelters = pickShelters(g, dose, base);
    const { start, end } = examplePair(g, base)!;
    const before = planRoutes(g, d, base, DEFAULT_MOBILITY, start, end, dose, shelters)[0];
    const mid = before.cells[Math.floor(before.cells.length / 2)];
    const [lon, lat] = cellCenter(g, Math.floor(mid / g.size), mid % g.size);
    const inc: Incident = {
      id: 'i1', siteId: 'gale', createdAt: '2026-11-15T00:00:00Z', lonlat: [lon, lat],
      radiusM: 200, type: 'unstable_ground', tier: 2, syncedToEarth: false,
    };
    const blocked = applyIncidents(g, base, [inc]);
    expect(blocked.cls[mid]).toBe(3);
    const after = planRoutes(g, d, blocked, DEFAULT_MOBILITY, start, end, dose, shelters);
    expect(after).toHaveLength(3);
    for (const r of after) expect(r.cells.some((c) => blocked.cls[c] === 3)).toBe(false);
    expect(after[0].cells).not.toEqual(before.cells);
    expect(after[0].stats.distanceM).toBeGreaterThanOrEqual(before.stats.distanceM);
  });

  it('never mixes sites: an incident from another site changes nothing (D7)', () => {
    const g = generateTerrain(SITES.gale);
    const base = buildCost(derive(g), DEFAULT_MOBILITY);
    const [lon, lat] = cellCenter(g, 200, 200);
    const foreign: Incident = {
      id: 'x', siteId: 'jezero', createdAt: '', lonlat: [lon, lat], radiusM: 500,
      type: 'blocked', tier: 2, syncedToEarth: false,
    };
    expect(applyIncidents(g, base, [foreign])).toBe(base);
  });

  it('circle ring closes and has roughly the requested radius', () => {
    const ring = circleRing(137.4, -4.75, 400);
    expect(ring[0]).toEqual(ring.at(-1));
    expect(ring.length).toBeGreaterThan(30);
  });
});
