# ROUTING

All parameters are **team assumptions** (spec §12), not NASA data, and are editable in the UI.

## Cell cost

`cost = 1 + a·slope² + b·roughness` (slope and roughness in degrees; defaults a = 0.01, b = 0.5).
A cell is **no-go** (impassable) when `slope > slopeNoGoDeg` (default 25°).
Classes: comfortable ≤ 10°, caution ≤ 20°, hard ≤ 25°, no-go above.

`roughness` is the standard deviation of slope in a 3x3 window: a proxy, because a DTM cannot
resolve rocks smaller than a cell (spec §12).

## Planner

A* on an 8-connected grid (cell 20 m). Step cost = step length × mean weight of the two cells.
Heuristic = octile distance (exact on an open 8-connected grid, so admissible while weights >= 1).
Diagonal steps may not cut between two impassable cells. Everything runs in the browser, no network.

Three profiles differ only in the per-cell weight:

| Profile | Weight |
|---|---|
| Shortest | 1 (only no-go is avoided) |
| Safest | `cost² · (1 + 0.5·class)` |
| With nearby shelter | `cost · (1 + 2·doseRelative)` (prefers shielded terrain) |

Each profile is optimal for its own weight (tested). The shelter profile trades distance for lower
estimated dose; where terrain barely shields (e.g. Jezero) it can end up close to the others.

Reported hazards (F6b) set the cells within their radius to no-go and every route is recomputed.
Incidents are stored per site and never applied to another site (spec D7).

## Shielding (ESTIMATED)

Sky-view factor from horizon angles in 16 azimuths, sampled up to ~1 km: `SVF = 1 − mean(sin(horizon))`.
`doseRelative = max(0.25, SVF)`: 1 on open ground, floored at 0.25 because terrain never blocks everything
(assumption). Shelter sites: best-shielded passable cells (dose ≤ 0.8), at least 1.2 km apart, up to 6.
Absolute dose (mSv/day) is shown only at Gale: `doseRelative × 0.67` (MSL/RAD average, Hassler et al. 2014,
Aug 2012 – Jun 2013). Jezero has no RAD measurement, so only the relative value is shown.

## Route statistics

- Time = Σ step length × mean cell cost ÷ walking speed (default 2.5 km/h). Assumption, not a model of suited EVA.
- Risk (0–100, estimated) = 100 × min(1, 0.7·Σ(classShare × [0, 0.25, 0.6, 1]) + 0.3·maxSlope/noGo).
  A relative score to compare routes, not a calibrated probability.

## Status

Calibration against Jezero hazards (spec §9 step 8) has not been done; the UI shows
"SUPUESTOS SIN VALIDAR" until it is.
