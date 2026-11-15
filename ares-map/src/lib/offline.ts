import { get as getProjection } from 'ol/proj';
import type TileImage from 'ol/source/TileImage';
import type TileLayer from 'ol/layer/Tile';
import { METERS_PER_DEGREE, metersPerDegreeLon } from './mars';
import { LAYER_DEFS } from '../map/layers';
import type { SiteConfig } from '../config/sites';

export const TILE_CACHE = 'ares-tiles';
const MAX_TILES_PER_LEVEL = 40;

export interface PrefetchResult {
  total: number;
  done: number;
  failed: number;
}

/** Tile URLs covering the site's initial view (at the view's zoom and one coarser) for every map layer. */
export function tileUrlsFor(site: SiteConfig): string[] {
  const [lon, lat] = site.center;
  const halfM = (site.viewKm * 1000) / 2;
  const dLon = halfM / metersPerDegreeLon(lat);
  const dLat = halfM / METERS_PER_DEGREE;
  const extent: [number, number, number, number] = [lon - dLon, lat - dLat, lon + dLon, lat + dLat];
  const proj = getProjection('EPSG:4326')!;
  const viewRes = (site.viewKm * 1000) / METERS_PER_DEGREE / 1000;
  const urls: string[] = [];
  for (const def of LAYER_DEFS) {
    const source = (def.create() as TileLayer<TileImage>).getSource()!;
    const grid = source.getTileGridForProjection(proj);
    const urlFn = source.getTileUrlFunction();
    const z0 = grid.getZForResolution(viewRes);
    for (const z of [z0 - 1, z0]) {
      let count = 0; // the cap applies per level so the finer level is never starved by the coarser one
      if (z < grid.getMinZoom() || z > grid.getMaxZoom()) continue;
      const range = grid.getTileRangeForExtentAndZ(extent, z);
      for (let x = range.minX; x <= range.maxX; x++) {
        for (let y = range.minY; y <= range.maxY; y++) {
          if (count >= MAX_TILES_PER_LEVEL) break;
          const u = urlFn([z, x, y], 1, proj);
          if (u) {
            urls.push(u);
            count++;
          }
        }
      }
    }
  }
  return [...new Set(urls)];
}

/** Downloads the tiles into the same cache the service worker serves from. */
export async function prefetchTiles(
  urls: string[],
  onProgress: (r: PrefetchResult) => void,
  concurrency = 4,
): Promise<PrefetchResult> {
  const result: PrefetchResult = { total: urls.length, done: 0, failed: 0 };
  if (typeof caches === 'undefined') throw new Error('Este navegador no permite caché sin conexión.');
  const cache = await caches.open(TILE_CACHE);
  let next = 0;
  const worker = async () => {
    while (next < urls.length) {
      const url = urls[next++];
      try {
        const res = await fetch(url, { mode: 'cors' });
        if (!res.ok) throw new Error(String(res.status));
        // A WMS error comes back as HTTP 200 XML: never cache that as a tile.
        if (!(res.headers.get('content-type') ?? '').startsWith('image/')) throw new Error('not an image');
        await cache.put(url, res);
        result.done++;
      } catch {
        result.failed++;
      }
      onProgress({ ...result });
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return result;
}
