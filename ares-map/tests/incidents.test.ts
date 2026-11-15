import { describe, expect, it } from 'vitest';
import { parseIncidents } from '../src/routing/incidents';

const good = {
  id: 'a', siteId: 'gale', createdAt: '2026-11-15T00:00:00Z', lonlat: [137.4, -4.8], radiusM: 200,
  type: 'blocked', note: 'x', tier: 2, syncedToEarth: false,
};

describe('parseIncidents (stored data is untrusted)', () => {
  it('keeps a well-formed incident', () => {
    expect(parseIncidents([good])).toEqual([good]);
  });

  it('drops null, wrong shapes and bad values instead of crashing', () => {
    const bad = [
      null, 7, 'x', [], {},
      { ...good, siteId: 'mars' },
      { ...good, lonlat: [1] },
      { ...good, lonlat: [NaN, 2] },
      { ...good, radiusM: -5 },
      { ...good, radiusM: 1e9 },
      { ...good, type: 'unknown' },
      // Inherited Object.prototype names must not pass as an incident type.
      { ...good, type: 'constructor' },
      { ...good, type: 'toString' },
      { ...good, type: '__proto__' },
      { ...good, type: 'hasOwnProperty' },
      { ...good, syncedToEarth: 'no' },
      { ...good, id: 3 },
    ];
    expect(parseIncidents(bad)).toEqual([]);
    expect(parseIncidents([null, good, {}])).toEqual([good]);
  });

  it('returns [] for non-arrays', () => {
    expect(parseIncidents({ a: 1 })).toEqual([]);
    expect(parseIncidents(null)).toEqual([]);
  });
});
