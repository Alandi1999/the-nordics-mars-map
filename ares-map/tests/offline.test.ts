import { describe, expect, it } from 'vitest';
import { SITES } from '../src/config/sites';
import { tileUrlsFor } from '../src/lib/offline';

describe('offline tile list', () => {
  for (const site of Object.values(SITES)) {
    it(`${site.id}: lists unique, bounded tile URLs from the two verified servers`, () => {
      const urls = tileUrlsFor(site);
      expect(urls.length).toBeGreaterThan(20);
      expect(urls.length).toBeLessThanOrEqual(5 * 30);
      expect(new Set(urls).size).toBe(urls.length);
      for (const u of urls) expect(u).toMatch(/^https:\/\/(trek\.nasa\.gov\/tiles\/Mars\/EQ\/Mars_Viking|planetarymaps\.usgs\.gov\/cgi-bin\/mapserv)/);
      const trek = urls.filter((u) => u.includes('trek.nasa.gov'));
      expect(trek.length).toBeGreaterThan(0);
      // Trek only has tiles up to level 7; asking for more returns 404.
      for (const u of trek) expect(Number(u.split('default028mm/')[1].split('/')[0])).toBeLessThanOrEqual(7);
      expect(urls.some((u) => u.includes('LAYERS=THEMIS_night'))).toBe(true);
    });
  }
});
