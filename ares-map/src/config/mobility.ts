/** Team ASSUMPTIONS, not NASA data (spec §12). Editable in the UI. */
export interface MobilityConfig {
  walkSpeedKmh: number;
  slopeComfortDeg: number;
  slopeCautionDeg: number;
  slopeNoGoDeg: number;
  /** Slope penalty: cost *= 1 + a·slope² (slope in degrees). */
  a: number;
  /** Roughness penalty: cost *= 1 + b·roughness (degrees). */
  b: number;
  /** True only after calibration against Jezero hazards (not done yet). */
  calibrated: boolean;
}

export const DEFAULT_MOBILITY: MobilityConfig = {
  walkSpeedKmh: 2.5,
  slopeComfortDeg: 10,
  slopeCautionDeg: 20,
  slopeNoGoDeg: 25,
  a: 0.01,
  b: 0.5,
  calibrated: false,
};
