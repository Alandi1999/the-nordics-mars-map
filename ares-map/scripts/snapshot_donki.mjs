// Saves the Mars-impact entries of DONKI WSA-ENLIL simulations as a real snapshot.
// Usage: NASA_API_KEY=<your free key from api.nasa.gov> node scripts/snapshot_donki.mjs 2026-09-17 2026-11-15
// DONKI limits the range to 60 days. UNTESTED end to end: the endpoint and response shape were
// probed by hand on 2026-11-15, but DEMO_KEY hit its rate limit before this script could run.
import { writeFile } from 'node:fs/promises';

const [start, end] = process.argv.slice(2);
const key = process.env.NASA_API_KEY;
if (!start || !end || !key) {
  console.error('Usage: NASA_API_KEY=... node scripts/snapshot_donki.mjs <startDate> <endDate>');
  process.exit(1);
}
const url = `https://api.nasa.gov/DONKI/WSAEnlilSimulations?startDate=${start}&endDate=${end}&api_key=${key}`;
const res = await fetch(url);
if (!res.ok) throw new Error(`DONKI ${res.status}: ${await res.text()}`);
const sims = await res.json();
const events = sims.flatMap((s) =>
  (s.impactList ?? [])
    .filter((i) => i.location === 'Mars')
    .map((i) => ({
      simulationID: s.simulationID,
      modelCompletionTime: s.modelCompletionTime,
      impact: i,
      cme: (s.cmeInputs ?? []).map((c) => ({ speed: c.speed, halfAngle: c.halfAngle, CMEID: c.CMEID })),
      link: s.link,
    })),
);
const out = { retrievedAt: new Date().toISOString(), source: 'NASA DONKI WSAEnlilSimulations', start, end, events };
await writeFile(new URL('../data/samples/donki_mars_snapshot.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(`Saved ${events.length} Mars-impact entries from ${sims.length} simulations.`);
