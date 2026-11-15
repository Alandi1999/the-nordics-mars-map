import TileLayer from 'ol/layer/Tile';
import TileImage from 'ol/source/TileImage';
import TileWMS from 'ol/source/TileWMS';
import TileGrid from 'ol/tilegrid/TileGrid';
import type BaseLayer from 'ol/layer/Base';
import type { DataMeta } from '../lib/dataMeta';
import type { Text } from '../i18n';
import { PROBE_DATE } from '../lib/dataMeta';

export interface LayerDef {
  id: string;
  label: Text;
  group: 'base' | 'thermal';
  defaultVisible: boolean;
  defaultOpacity: number;
  meta: DataMeta;
  create: () => BaseLayer;
}

const TREK = 'https://trek.nasa.gov/tiles/Mars/EQ';
const USGS_WMS = 'https://planetarymaps.usgs.gov/cgi-bin/mapserv?map=/maps/mars/mars_simp_cyl.map';

/**
 * Trek WMTS grid (probed 2026-11-15): 256 px, origin (-180, 90), level 0 = 2x1 tiles.
 * The capabilities declare levels 0-9 but tiles only exist up to level 7 (levels 8-9 return 404),
 * so the grid stops at 7 and OpenLayers stretches level 7 when zooming in.
 */
const TREK_MAX_LEVEL = 7;
const trekGrid = new TileGrid({
  extent: [-180, -90, 180, 90],
  origin: [-180, 90],
  tileSize: 256,
  resolutions: Array.from({ length: TREK_MAX_LEVEL + 1 }, (_, z) => 360 / 512 / 2 ** z),
});

function trekLayer(layerId: string): TileLayer<TileImage> {
  return new TileLayer({
    source: new TileImage({
      projection: 'EPSG:4326',
      tileGrid: trekGrid,
      tileUrlFunction: ([z, x, y]) =>
        `${TREK}/${layerId}/1.0.0/default/default028mm/${z}/${y}/${x}.jpg`,
      crossOrigin: 'anonymous',
      attributions: 'NASA/JPL-Caltech · USGS Astrogeology · NASA Trek',
    }),
  });
}

function wmsLayer(layerName: string): TileLayer<TileWMS> {
  return new TileLayer({
    source: new TileWMS({
      url: USGS_WMS,
      params: { LAYERS: layerName, VERSION: '1.1.1', FORMAT: 'image/png', TRANSPARENT: false },
      projection: 'EPSG:4326',
      crossOrigin: 'anonymous',
      attributions: 'USGS Astrogeology Science Center',
    }),
  });
}

const usgsMeta = (name: string, notes: Text): DataMeta => ({
  source: `USGS Astrogeology WMS · ${name}`,
  sourceUrl: 'https://planetarymaps.usgs.gov/',
  acquiredAt: { en: 'Historical mosaic (the source does not date it)', es: 'Mosaico histórico (la fuente no lo fecha)' },
  retrievedAt: PROBE_DATE,
  tier: 1,
  confidence: 'high',
  shelfLife: 'slow',
  notes,
});

export const LAYER_DEFS: LayerDef[] = [
  {
    id: 'viking',
    label: { en: 'Viking imagery (color, ≈ 325 m/px)', es: 'Imagen Viking (color, ≈ 325 m/px)' },
    group: 'base',
    defaultVisible: true,
    defaultOpacity: 1,
    create: () => trekLayer('Mars_Viking_MDIM21_ClrMosaic_global_232m'),
    meta: {
      source: { en: 'NASA Trek · Viking MDIM 2.1 color (level 7, ≈ 325 m/px)', es: 'NASA Trek · Viking MDIM 2.1 color (nivel 7, ≈ 325 m/px)' },
      sourceUrl: 'https://trek.nasa.gov/mars/',
      acquiredAt: { en: 'Viking missions (1976–1980), MDIM 2.1 mosaic', es: 'Misiones Viking (1976–1980), mosaico MDIM 2.1' },
      retrievedAt: PROBE_DATE,
      tier: 1,
      confidence: 'high',
      shelfLife: 'slow',
      notes: {
        en: 'Coarse global resolution: it cannot resolve walking obstacles. Trek tiles only exist up to level 7; zooming in stretches them.',
        es: 'Resolución global gruesa: no distingue obstáculos de caminata. Los tiles de Trek solo existen hasta el nivel 7; al acercarse se estira.',
      },
    },
  },
  {
    id: 'mola',
    label: { en: 'MOLA elevation (color)', es: 'Elevación MOLA (color)' },
    group: 'base',
    defaultVisible: false,
    defaultOpacity: 0.7,
    create: () => wmsLayer('MOLA_color'),
    meta: usgsMeta('MOLA_color', { en: 'Mars Global Surveyor laser altimetry, colored by elevation.', es: 'Altimetría láser de Mars Global Surveyor, color por elevación.' }),
  },
  {
    id: 'hillshade',
    label: { en: 'HRSC+MOLA shaded relief', es: 'Relieve sombreado HRSC+MOLA' },
    group: 'base',
    defaultVisible: false,
    defaultOpacity: 0.7,
    create: () => wmsLayer('HRSC_MOLA_Blend_Hillshade'),
    meta: usgsMeta('HRSC_MOLA_Blend_Hillshade', { en: 'Shading derived from the blended HRSC/MOLA DEM (~200 m/px).', es: 'Sombreado derivado del DEM mezclado HRSC/MOLA (~200 m/px).' }),
  },
  {
    id: 'themis-day',
    label: { en: 'THEMIS thermal (day)', es: 'Térmico THEMIS (día)' },
    group: 'thermal',
    defaultVisible: false,
    defaultOpacity: 0.8,
    create: () => wmsLayer('THEMIS'),
    meta: usgsMeta('THEMIS', { en: 'Daytime infrared mosaic from Mars Odyssey. WMS layer `THEMIS`.', es: 'Mosaico infrarrojo diurno de Mars Odyssey. Capa `THEMIS` del WMS.' }),
  },
  {
    id: 'themis-night',
    label: { en: 'THEMIS thermal (night)', es: 'Térmico THEMIS (noche)' },
    group: 'thermal',
    defaultVisible: false,
    defaultOpacity: 0.8,
    create: () => wmsLayer('THEMIS_night'),
    meta: usgsMeta('THEMIS_night', { en: 'Nighttime infrared mosaic from Mars Odyssey.', es: 'Mosaico infrarrojo nocturno de Mars Odyssey.' }),
  },
];
