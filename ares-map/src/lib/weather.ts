import type { SiteId } from '../config/sites';
import { ROVER, solToDate } from '../data/pois';
import { valueNoise } from '../terrain/noise';

/** Half-hour samples across one sol. */
export const SAMPLES_PER_SOL = 48;
export const WEATHER_SOLS = 7;

export interface WeatherSample {
  /** Local mean solar time in hours, 0..24 (a sol is divided in 24 "Mars hours"). */
  lmstH: number;
  tempC: number;
  pressurePa: number;
}

export interface SolWeather {
  sol: number;
  /** Approximate calendar date of that sol (sol length from the landing date). */
  date: string;
  samples: WeatherSample[];
  tMinC: number;
  tMaxC: number;
  pMinPa: number;
  pMaxPa: number;
}

export interface WeatherSeries {
  siteId: SiteId;
  /** Instrument the real data would come from (spec §5.4). */
  instrument: string;
  sols: SolWeather[];
}

/**
 * INVENTED parameters, loosely in the range of surface weather stations (cold, thin atmosphere).
 * These are NOT REMS or MEDA measurements. Each site has its own values (spec D7).
 */
const PARAMS: Record<SiteId, { instrument: string; tMeanC: number; tAmpC: number; pMeanPa: number; seed: number }> = {
  gale: { instrument: 'REMS (Curiosity)', tMeanC: -43, tAmpC: 33, pMeanPa: 800, seed: 11 },
  jezero: { instrument: 'MEDA (Perseverance)', tMeanC: -46, tAmpC: 35, pMeanPa: 735, seed: 23 },
};

const TWO_PI = Math.PI * 2;

/** Deterministic, mocked weather for the last `WEATHER_SOLS` sols the rover traverse covers. */
export function generateWeather(site: SiteId): WeatherSeries {
  const { instrument, tMeanC, tAmpC, pMeanPa, seed } = PARAMS[site];
  const lastSol = ROVER[site].lastSol;
  const sols: SolWeather[] = [];
  for (let k = WEATHER_SOLS - 1; k >= 0; k--) {
    const sol = lastSol - k;
    // Slow sol-to-sol drift of the weather (a few degrees, about 1 % of pressure).
    const drift = (valueNoise(sol * 0.45, 0, seed) - 0.5) * 2;
    const samples: WeatherSample[] = [];
    for (let i = 0; i < SAMPLES_PER_SOL; i++) {
      const h = (i * 24) / SAMPLES_PER_SOL;
      const jitter = (valueNoise(sol * 3.1 + i * 0.5, 7, seed) - 0.5) * 2;
      // Afternoon peak, cold pre-dawn minimum, plus a weaker second harmonic.
      const tempC =
        tMeanC + tAmpC * Math.cos((TWO_PI * (h - 13.5)) / 24) + 0.15 * tAmpC * Math.cos((TWO_PI * 2 * (h - 11)) / 24) + 3 * drift + 1.2 * jitter;
      const pressurePa = pMeanPa * (1 + 0.04 * Math.cos((TWO_PI * (h - 3)) / 12) + 0.015 * drift + 0.002 * jitter);
      samples.push({ lmstH: h, tempC, pressurePa });
    }
    const temps = samples.map((s) => s.tempC);
    const press = samples.map((s) => s.pressurePa);
    sols.push({
      sol,
      date: solToDate(site, sol),
      samples,
      tMinC: Math.min(...temps),
      tMaxC: Math.max(...temps),
      pMinPa: Math.min(...press),
      pMaxPa: Math.max(...press),
    });
  }
  return { siteId: site, instrument, sols };
}
