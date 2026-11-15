import { METERS_PER_DEGREE, metersPerDegreeLon } from './mars';

/** Local flat-earth offset in meters (east, north) from `a` to `b`; fine for distances of a few km. */
export function offsetM(a: [number, number], b: [number, number]): [number, number] {
  const midLat = (a[1] + b[1]) / 2;
  return [(b[0] - a[0]) * metersPerDegreeLon(midLat), (b[1] - a[1]) * METERS_PER_DEGREE];
}

export function distanceM(a: [number, number], b: [number, number]): number {
  const [e, n] = offsetM(a, b);
  return Math.hypot(e, n);
}

/** Compass bearing from `a` to `b` in degrees (0 = N, 90 = E). */
export function bearingDeg(a: [number, number], b: [number, number]): number {
  const [e, n] = offsetM(a, b);
  return ((Math.atan2(e, n) * 180) / Math.PI + 360) % 360;
}

/** Moves `p` by `meters` towards compass `bearing`. */
export function moveBy(p: [number, number], meters: number, bearing: number): [number, number] {
  const r = (bearing * Math.PI) / 180;
  return [p[0] + (meters * Math.sin(r)) / metersPerDegreeLon(p[1]), p[1] + (meters * Math.cos(r)) / METERS_PER_DEGREE];
}
