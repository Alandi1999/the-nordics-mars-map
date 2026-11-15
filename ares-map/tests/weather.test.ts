import { describe, expect, it } from 'vitest';
import { ROVER, solToDate } from '../src/data/pois';
import { SAMPLES_PER_SOL, WEATHER_SOLS, generateWeather } from '../src/lib/weather';

/** Bounds around the designed values (measured ranges over the 7 sols, with margin), per site. */
const BOUNDS = {
  gale: { tMax: [-13, -2], tMin: [-85, -70], pMin: 740, pMax: 860 },
  jezero: { tMax: [-15, -4], tMin: [-90, -75], pMin: 680, pMax: 790 },
} as const;

describe('mocked weather series (F3, ESTIMATED)', () => {
  for (const site of ['gale', 'jezero'] as const) {
    it(`${site}: ${WEATHER_SOLS} consecutive sols ending at the last traverse sol, dated with solToDate, ${SAMPLES_PER_SOL} samples each`, () => {
      const w = generateWeather(site);
      expect(w.sols).toHaveLength(WEATHER_SOLS);
      const last = ROVER[site].lastSol;
      expect(w.sols.map((s) => s.sol)).toEqual(Array.from({ length: WEATHER_SOLS }, (_, i) => last - (WEATHER_SOLS - 1) + i));
      for (const s of w.sols) {
        expect(s.samples).toHaveLength(SAMPLES_PER_SOL);
        expect(s.date).toBe(solToDate(site, s.sol));
        expect(s.samples[0].lmstH).toBe(0);
        expect(s.samples[SAMPLES_PER_SOL - 1].lmstH).toBe(24 - 24 / SAMPLES_PER_SOL);
      }
    });

    it(`${site}: per-sol min/max are exactly the extremes of the samples`, () => {
      for (const s of generateWeather(site).sols) {
        const t = s.samples.map((p) => p.tempC);
        const p = s.samples.map((q) => q.pressurePa);
        expect(s.tMinC).toBe(Math.min(...t));
        expect(s.tMaxC).toBe(Math.max(...t));
        expect(s.pMinPa).toBe(Math.min(...p));
        expect(s.pMaxPa).toBe(Math.max(...p));
      }
    });

    it(`${site}: values stay inside the designed range, with the daily temperature and pressure cycles in place`, () => {
      const b = BOUNDS[site];
      for (const s of generateWeather(site).sols) {
        expect(s.tMaxC).toBeGreaterThan(b.tMax[0]);
        expect(s.tMaxC).toBeLessThan(b.tMax[1]);
        expect(s.tMinC).toBeGreaterThan(b.tMin[0]);
        expect(s.tMinC).toBeLessThan(b.tMin[1]);
        expect(s.pMinPa).toBeGreaterThan(b.pMin);
        expect(s.pMaxPa).toBeLessThan(b.pMax);
        // Temperature: afternoon peak, cold pre-dawn minimum.
        const warm = s.samples.reduce((a, c) => (c.tempC > a.tempC ? c : a));
        const cold = s.samples.reduce((a, c) => (c.tempC < a.tempC ? c : a));
        expect(warm.lmstH).toBeGreaterThanOrEqual(11);
        expect(warm.lmstH).toBeLessThanOrEqual(14);
        expect(cold.lmstH).toBeGreaterThanOrEqual(1);
        expect(cold.lmstH).toBeLessThanOrEqual(4.5);
        // Pressure: 12 h period, so its maximum sits near 3 h or near 15 h.
        const high = s.samples.reduce((a, c) => (c.pressurePa > a.pressurePa ? c : a));
        const phase = Math.min(Math.abs(high.lmstH - 3), Math.abs(high.lmstH - 15));
        expect(phase).toBeLessThanOrEqual(0.5);
      }
    });
  }

  it('is deterministic', () => {
    expect(generateWeather('gale')).toEqual(generateWeather('gale'));
  });

  it('keeps each site on its own parameters (D7): different mean temperature and pressure', () => {
    const mean = (site: 'gale' | 'jezero', pick: (p: { tempC: number; pressurePa: number }) => number) => {
      const all = generateWeather(site).sols.flatMap((s) => s.samples.map(pick));
      return all.reduce((a, b) => a + b, 0) / all.length;
    };
    expect(Math.abs(mean('gale', (p) => p.tempC) - mean('jezero', (p) => p.tempC))).toBeGreaterThan(1);
    expect(mean('gale', (p) => p.pressurePa) - mean('jezero', (p) => p.pressurePa)).toBeGreaterThan(40);
  });

  it('names the instrument the real data would come from, per site', () => {
    expect(generateWeather('gale').instrument).toContain('REMS');
    expect(generateWeather('jezero').instrument).toContain('MEDA');
  });
});
