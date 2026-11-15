import type { MobilityConfig } from '../config/mobility';
import type { Derived } from '../terrain/derive';

/** 0 comfortable (≤ comfort), 1 caution (≤ caution), 2 hard (≤ no-go), 3 no-go. */
export type CellClass = 0 | 1 | 2 | 3;

export interface CostGrid {
  /** Multiplier on distance; Infinity where no-go. */
  cost: Float32Array;
  cls: Uint8Array;
}

/** cost = 1 + a·slope² + b·roughness, no-go if slope > slopeNoGo (docs/ROUTING.md). */
export function buildCost(d: Derived, cfg: MobilityConfig): CostGrid {
  const n = d.slope.length;
  const cost = new Float32Array(n);
  const cls = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const s = d.slope[i];
    if (s > cfg.slopeNoGoDeg) {
      cls[i] = 3;
      cost[i] = Infinity;
    } else {
      cls[i] = s > cfg.slopeCautionDeg ? 2 : s > cfg.slopeComfortDeg ? 1 : 0;
      cost[i] = 1 + cfg.a * s * s + cfg.b * d.roughness[i];
    }
  }
  return { cost, cls };
}
