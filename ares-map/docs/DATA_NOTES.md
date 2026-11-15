# DATA_NOTES — endpoint probes

Probed 2026-11-15 from the dev machine (WSL). Layer ids and parameters below are the ones that
actually responded; they differ from `ARES_MAP_SPEC.md` where noted.

| Source | Result | Notes |
|---|---|---|
| Trek WMTS `Mars_Viking_MDIM21_ClrMosaic_global_232m` | OK | Spec had no `Mars_` prefix and the un-prefixed URL returns 404. GetCapabilities 200, tile 200 `image/jpeg`, `Access-Control-Allow-Origin: *`. TileMatrixSet `default028mm`, declared 10 levels (0-9) but tiles exist ONLY up to level 7 (levels 8 and 9 return 404 everywhere probed), i.e. ≈ 325 m/px, not the 232 m of the layer name; 256 px, top-left (-180, 90), level 0 = 2x1 tiles, CRS `EPSG::104905`. URL pattern `.../1.0.0/default/default028mm/{z}/{row}/{col}.jpg`. |
| Trek catalog `api.nasa.gov/mars-wmts/catalog/` | 404 | Other Trek layer ids not discovered; not needed for the prototype. |
| USGS WMS `planetarymaps.usgs.gov/cgi-bin/mapserv?map=/maps/mars/mars_simp_cyl.map` | OK | https works, CORS `*`. SRS `EPSG:4326` and `IAU_2015:49900`. Layers used: `THEMIS`, `THEMIS_night`, `MDIM21`, `MOLA_color`, `HRSC_MOLA_Blend_Hillshade`. Spec names `THEMIS_IR_Day` / `THEMIS_IR_Night` do NOT exist. GetMap over Gale returned a PNG. |
| `wms.wr.usgs.gov` elevation map file | Not usable | Returned the same layer list as the rasters map; no separate `MOLA_elev` layer verified. |
| NASA DONKI `WSAEnlilSimulations` | OK, schema verified | `https://api.nasa.gov/DONKI/WSAEnlilSimulations?startDate=&endDate=&api_key=`; range limit 60 days (400 otherwise). Entries have `impactList: [{location, arrivalTime, isGlancingBlow, isMinorImpact}]`; Mars appears as `location: "Mars"` (126 entries seen across May–Sep 2025, many duplicated across simulations). `DEMO_KEY` allows 10 requests/hour and was exhausted, so NO real snapshot was saved. `scripts/snapshot_donki.mjs` (untested end to end) takes one with a real key. The app ships an illustrative sample with the same field names. |
| JPL Horizons API | OK | `COMMAND='499' CENTER='500@399' QUANTITIES='20'`. 2026-11-15 00:00 UT: delta 1.31585436923142 AU; 2026-11-16: 1.30732526492742 AU. astronomy-engine matches within 0.1 % (tests/safety.test.ts). |
| HiRISE DTM (AWS/STAC), PDS, REMS/MEDA, RAD, Curiosity waypoints | NOT probed | Prototype uses labelled illustrative data for these (see below). |

## Prototype data policy (option A, hybrid)

- Real: Trek Viking mosaic and USGS WMS layers (imagery, MOLA color, hillshade, THEMIS).
- Illustrative (labelled `estimated` in the UI): terrain grid (DEM, slope, roughness, cost), shielding,
  POIs, weather series, space-weather alerts, crew health text. Generated procedurally or hand-written,
  never presented as NASA data.
- Imagery resolution: Trek/MDIM21 is a ~232 m global mosaic, so a 10 km AOI is blurry. CTX (5 m) and
  HiRISE need tile downloads and are out of scope for the prototype.
