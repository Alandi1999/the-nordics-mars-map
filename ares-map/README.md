# ARES MAP · concept prototype

Versión en español: [README.es.md](README.es.md)

A Mars surface-exploration map for a walk outside the habitat, made for **NASA Space Apps 2026**.
It is a **demonstration of the idea**, not a product: it mixes real NASA data with illustrative data,
and every datum shows its source, date and confidence level (badge "T1 · ..." / "ESTIMATED").

The app starts in **English** and has an **EN / ES** button to switch the interface language.

```
npm install
npm run dev        # development
npm test           # 61 tests (terrain, routes, shielding, ephemeris, data, simulated weather)
npm run build && npm run preview   # build with service worker (offline mode)
```

## What is real and what is illustrative

| Real | Illustrative / conceptual |
|---|---|
| Viking image (Trek), MOLA, HRSC+MOLA relief, THEMIS (USGS) | AOI relief (generated), slope, cost, shielding, shelters |
| Curiosity (sol 5073) and Perseverance (sol 2022) traverses and waypoints | Space-weather alerts (DONKI schema, invented values) |
| Earth-Mars distance and latency (validated with JPL Horizons) | Protocol card, event simulator, gauntlet, medical AI |
| RAD radiation baseline at Gale | Mobility parameters (uncalibrated assumptions) |
| | Surface weather (temperature and pressure): invented series, not REMS or MEDA |

Data from one site is never shown on the other.

## Structure

- `src/terrain`, `src/routing`, `src/safety`, `src/crew`: pure logic, with tests in `tests/`.
- `src/ui`, `src/map`, `src/App.tsx`: interface.
- `src/data`: real traverses (`scripts/build_rover_data.mjs`) and the alert sample.
- `docs/`: `DATA_NOTES.md` (probed endpoints), `ROUTING.md` (formulas), `DEMO.md`, `CREDITS.md`.
- Specification: `../ARES_MAP_SPEC.md`.

## Known limits

- The AOI relief is synthetic; the real traverse is drawn on top of it (an on-screen notice says so).
- No calibration against Jezero: mobility thresholds are shown as "unvalidated assumptions".
- Trek only has tiles up to level 7 (about 325 m/px): the base image is blurry at walking scale.
- Health content: several entries are still "pending source" and are labelled as such.
- The weather panel (F3) uses an invented series, marked "ESTIMATED"; there is no REMS or MEDA data.
- The project uses npm (`package-lock.json`); a local `pnpm-lock.yaml` is git-ignored.
