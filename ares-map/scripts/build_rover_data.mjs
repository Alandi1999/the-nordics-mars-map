// Downloads the public rover waypoint GeoJSON (NASA MMGIS) and writes a compact per-site file
// for the app: full traverse as [lon, lat, sol] plus a selection of waypoints used as POIs.
// Idempotent. Usage: node scripts/build_rover_data.mjs
import { writeFile } from 'node:fs/promises';

const SOURCES = {
  gale: {
    rover: 'Curiosity (MSL)',
    url: 'https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json',
  },
  jezero: {
    rover: 'Perseverance (Mars 2020)',
    url: 'https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json',
  },
};

const round = (v, d) => Number(v.toFixed(d));

for (const [site, { rover, url }] of Object.entries(SOURCES)) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  const fc = await res.json();
  const pts = fc.features
    .map((f) => f.properties)
    .filter((p) => Number.isFinite(p.lon) && Number.isFinite(p.lat) && Number.isFinite(p.sol))
    .sort((a, b) => a.sol - b.sol || (a.drive ?? 0) - (b.drive ?? 0));
  // Drop consecutive duplicates (many waypoints share a position).
  const traverse = [];
  for (const p of pts) {
    const last = traverse.at(-1);
    if (!last || last[0] !== round(p.lon, 6) || last[1] !== round(p.lat, 6)) traverse.push([round(p.lon, 6), round(p.lat, 6), p.sol]);
  }
  const elev = new Map(pts.map((p) => [`${round(p.lon, 6)},${round(p.lat, 6)}`, p.elev_geoid]));
  // POI selection: first, last and evenly spaced by index in between.
  const K = 12;
  const picked = new Set([0, traverse.length - 1]);
  for (let k = 1; k < K - 1; k++) picked.add(Math.round((k * (traverse.length - 1)) / (K - 1)));
  const waypoints = [...picked].sort((a, b) => a - b).map((i) => {
    const [lon, lat, sol] = traverse[i];
    return { lon, lat, sol, elevation_m: round(elev.get(`${lon},${lat}`) ?? NaN, 1) };
  });
  const out = {
    site,
    rover,
    source: url,
    retrievedAt: new Date().toISOString().slice(0, 10),
    firstSol: traverse[0][2],
    lastSol: traverse.at(-1)[2],
    traverse,
    waypoints,
  };
  await writeFile(new URL(`../src/data/${site}.rover.json`, import.meta.url), JSON.stringify(out));
  console.log(`${site}: ${pts.length} waypoints -> ${traverse.length} unique, sol ${out.firstSol}..${out.lastSol}, POIs ${waypoints.length} (${rover}, ${url})`);
}
