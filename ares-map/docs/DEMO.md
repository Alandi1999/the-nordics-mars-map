# Three-minute demo

Versión en español: [DEMO.es.md](DEMO.es.md)

Setup (once, with a network):

```
npm run build && npm run preview     # the service worker only exists in the built version
```

Open the app (it starts in English; the **EN / ES** button in the interface switches to Spanish), go to the **Map** tab and use the
button to prepare offline mode (about 120 images per site). Check that it says "Service worker: active".
(Note: that button and status line may still show Spanish text: "Preparar modo offline", "activo".)

| Time | Tab | What to show | Key line |
|---|---|---|---|
| 0:00 | Link | Today's latency and the 2025-2030 chart. Move the "no response" slider. | "Between 3 and 22 min each way: Earth cannot guide a walk." |
| 0:25 | Map / Points | Gale with Curiosity's real traverse (up to sol 5073). Click a waypoint: card with source and date. | "Real NASA data; every datum says where it comes from and how reliable it is." |
| 0:50 | Terrain | Slope, cost map; move the thresholds and watch the map recompute. Click to probe. | "The AOI terrain is illustrative, and the app says so." |
| ~0:55 (optional, 10 s) | Weather | One sol's temperature and pressure cycle and the "View THEMIS nighttime" button. | "This series is invented and labelled; the THEMIS thermal layers are real." |
| 1:15 | Route | **Example route**: three routes (short, safe, with shelter) and their elevation profile. | "The best path is not always the shortest." |
| 1:40 | Safety | Turn on shielding; simulate an event. With A at the SW end, **moderate** gives RED CODE (no shelter is reachable in time, margin -28 min) and **minor** gives green. Card: code, countdown, shelter and margin. | "A solar alert becomes a concrete action." |
| 2:05 | Route | **Report hazard** on the route; the route recomputes by itself. | "If the terrain changes, the plan changes without waiting for Earth." |
| 2:25 | Crew | Sol 30; simulate "Airlock leak". Point out the "pending source" labels. | "We say what we know and what is still missing a citation." |
| 2:45 | Glove | Glove view: code, arrow, distance. Raise the position error. | "This is the concept the crew would carry: only the essentials." |
| 2:55 | — | Airplane mode and reload. | "Everything keeps working without a network." |

## Before presenting (checklist)

- [ ] `npm run build` without errors and `npm test` green.
- [ ] Built version open with `npm run preview`, not `npm run dev`.
- [ ] "Prepare offline mode" run on **both Gale and Jezero** (switch site and repeat).
- [ ] Test airplane mode with the tab already loaded, **before** going on stage.
- [ ] Say out loud: terrain, alerts, routes and health are **illustrative or conceptual**.
- [ ] Choose the interface language (EN / ES button) before starting.

## What NOT to claim

- The gauntlet, positioning without GPS and medical AI are **concepts**, not existing technology.
- The AOI relief is not real; the rover traverse, the waypoints, the ephemeris and the RAD baseline are.
- Space-weather alerts are a sample in the DONKI schema, not a forecast.
- Mobility thresholds are team assumptions, uncalibrated.
