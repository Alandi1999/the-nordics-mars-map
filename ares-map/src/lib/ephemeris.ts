import * as Astronomy from 'astronomy-engine';

export const AU_KM = 149_597_870.7;
export const C_KM_S = 299_792.458;

/** Earth–Mars distance in AU, computed offline with astronomy-engine. */
export function marsDistanceAu(date: Date): number {
  return Astronomy.GeoVector(Astronomy.Body.Mars, date, false).Length();
}

export interface LinkState {
  distanceAu: number;
  distanceMkm: number;
  oneWayMin: number;
  roundTripMin: number;
}

export function linkAt(date: Date): LinkState {
  const distanceAu = marsDistanceAu(date);
  const km = distanceAu * AU_KM;
  const oneWayMin = km / C_KM_S / 60;
  return { distanceAu, distanceMkm: km / 1e6, oneWayMin, roundTripMin: 2 * oneWayMin };
}

/** One-way latency samples between two dates, one per `stepDays`. */
export function latencySeries(from: Date, to: Date, stepDays: number): { t: number; oneWayMin: number }[] {
  const out: { t: number; oneWayMin: number }[] = [];
  const step = stepDays * 86_400_000;
  for (let t = from.getTime(); t <= to.getTime(); t += step) out.push({ t, oneWayMin: linkAt(new Date(t)).oneWayMin });
  return out;
}

export type WaitState = 'normal' | 'overdue';

/** After `waitedMin` without an answer: is it still within the expected round trip? */
export function waitState(waitedMin: number, roundTripMin: number): WaitState {
  return waitedMin >= roundTripMin ? 'overdue' : 'normal';
}
