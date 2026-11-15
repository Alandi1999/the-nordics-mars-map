import { describe, expect, it } from 'vitest';
import { SITES, type SiteId } from '../src/config/sites';
import { GUIDES, HEALTH_ITEMS, circadianOffsetHours, healthItem, missionPhase, radiationBudget } from '../src/crew/health';
import { buildPois, solToDate } from '../src/data/pois';
import { bearingDeg, distanceM, moveBy } from '../src/lib/geo';

const near = (site: SiteId, lon: number, lat: number) => {
  const [cLon, cLat] = SITES[site].center;
  return Math.abs(lon - cLon) < 0.5 && Math.abs(lat - cLat) < 0.5;
};

describe('POIs (F4)', () => {
  for (const site of ['gale', 'jezero'] as const) {
    it(`${site}: at least 10 POIs, all with complete metadata, all from this site's own data (D7)`, () => {
      const pois = buildPois(site, []);
      expect(pois.length).toBeGreaterThanOrEqual(10);
      for (const p of pois) {
        expect(p.meta.source, p.id).toBeTruthy();
        expect(p.meta.acquiredAt, p.id).toBeTruthy();
        expect(p.meta.retrievedAt, p.id).toBeTruthy();
        expect(['high', 'medium', 'low', 'estimated']).toContain(p.meta.confidence);
        expect(p.description_es.length).toBeGreaterThan(10);
        expect(near(site, p.lonlat[0], p.lonlat[1]), `${p.id} stays near ${site}`).toBe(true);
      }
      expect(new Set(pois.map((p) => p.id)).size).toBe(pois.length);
    });
  }

  it('the inferred boxwork POI is flagged low confidence and only exists at Gale', () => {
    const gale = buildPois('gale', []).find((p) => p.id === 'gale-boxwork-inferred')!;
    expect(gale.meta.confidence).toBe('low');
    expect(buildPois('jezero', []).some((p) => p.id.includes('boxwork'))).toBe(false);
  });

  it('sol to date: MSL sol 5073 falls in Nov 2026, Perseverance sol 0 is its landing day', () => {
    expect(solToDate('gale', 5073).startsWith('2026-11')).toBe(true);
    expect(solToDate('jezero', 0)).toBe('2021-02-18');
  });
});

describe('health content (F9)', () => {
  it('every item has source, confidence, last_reviewed and applies_to', () => {
    expect(HEALTH_ITEMS.length).toBeGreaterThanOrEqual(16);
    for (const i of HEALTH_ITEMS) {
      expect(i.source.trim(), i.id).not.toBe('');
      expect(['high', 'medium', 'low']).toContain(i.confidence);
      expect(i.last_reviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(['transit', 'surface', 'both']).toContain(i.applies_to);
    }
  });

  it('items still lacking a primary source are flagged and never rated high', () => {
    for (const i of HEALTH_ITEMS) if (i.pendingSource) expect(i.confidence, i.id).not.toBe('high');
    expect(healthItem('bone-loss')!.pendingSource).toBe(false);
  });

  it('every guide step that cites an item cites an existing one', () => {
    for (const g of GUIDES) for (const s of g.steps) if (s.itemId) expect(healthItem(s.itemId), `${g.id}: ${s.itemId}`).toBeDefined();
  });

  it('circadian drift is 39 min 35 s per sol', () => {
    expect(circadianOffsetHours(1) * 3600).toBeCloseTo(39 * 60 + 35, 6);
    expect(circadianOffsetHours(30)).toBeCloseTo(19.79, 1);
  });

  it('radiation budget: surface dose only at Gale (D7), transit from sourced figures', () => {
    expect(radiationBudget(30, 'gale').surfaceMsv).toBeCloseTo(20.1, 6);
    expect(radiationBudget(30, 'jezero').surfaceMsv).toBeNull();
    expect(radiationBudget(1, 'gale').transitMsv).toBeCloseTo(648, 6);
  });

  it('mission phase follows the stay length', () => {
    expect(missionPhase(1, 30)).toBe('llegada');
    expect(missionPhase(10, 30)).toBe('inicio');
    expect(missionPhase(15, 30)).toBe('medio');
    expect(missionPhase(28, 30)).toBe('final');
  });
});

describe('geo helpers', () => {
  it('bearing and distance agree with moveBy', () => {
    const a: [number, number] = [137.389, -4.826];
    for (const b of [0, 45, 90, 180, 270]) {
      const p = moveBy(a, 1000, b);
      expect(distanceM(a, p)).toBeCloseTo(1000, 0);
      expect(bearingDeg(a, p)).toBeCloseTo(b % 360, 0);
    }
  });
});
