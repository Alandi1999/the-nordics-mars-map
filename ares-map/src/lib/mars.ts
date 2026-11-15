/** Mean radius of Mars in meters (sphere used by the Mars 2000 system in the spec). */
export const MARS_RADIUS_M = 3_396_190;
export const METERS_PER_DEGREE = (MARS_RADIUS_M * Math.PI) / 180;
export const SOL_SECONDS = 24 * 3600 + 39 * 60 + 35;

/** Ground meters covered by one degree of longitude at `latDeg`. */
export const metersPerDegreeLon = (latDeg: number) =>
  METERS_PER_DEGREE * Math.cos((latDeg * Math.PI) / 180);
