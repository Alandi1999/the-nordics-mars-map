import type { DataMeta } from '../lib/dataMeta';
import { PROBE_DATE } from '../lib/dataMeta';
import type { SiteId } from '../config/sites';
import type { Shelter } from '../safety/shelters';
import galeRover from './gale.rover.json';
import jezeroRover from './jezero.rover.json';

export type PoiKind = 'waypoint' | 'science' | 'hazard' | 'habitat' | 'shelter' | 'landmark';

export interface Poi {
  id: string;
  name: string;
  kind: PoiKind;
  lonlat: [number, number];
  elevation_m?: number;
  description_es: string;
  whyItMatters_es?: string;
  meta: DataMeta;
}

export const KIND_LABEL: Record<PoiKind, string> = {
  waypoint: 'Waypoint',
  science: 'Ciencia',
  hazard: 'Peligro',
  habitat: 'Hábitat',
  shelter: 'Refugio',
  landmark: 'Hito',
};

interface RoverFile {
  rover: string;
  source: string;
  retrievedAt: string;
  lastSol: number;
  traverse: number[][];
  waypoints: { lon: number; lat: number; sol: number; elevation_m: number }[];
}

export const ROVER: Record<SiteId, RoverFile> = { gale: galeRover as RoverFile, jezero: jezeroRover as RoverFile };

/** Landing dates (UTC) used to convert a sol number to an approximate calendar date. */
const LANDING_MS: Record<SiteId, number> = {
  gale: Date.UTC(2012, 7, 6, 5, 17), // MSL, 2012-08-06
  jezero: Date.UTC(2021, 1, 18, 20, 55), // Mars 2020, 2021-02-18
};
const SOL_DAYS = 1.0274912;

export function solToDate(site: SiteId, sol: number): string {
  return new Date(LANDING_MS[site] + sol * SOL_DAYS * 86_400_000).toISOString().slice(0, 10);
}

const NOTE_APPROX = 'La fecha se calcula con la duración del sol desde el aterrizaje (≈ ±1 día).';

export function roverPois(site: SiteId): Poi[] {
  const r = ROVER[site];
  const last = r.waypoints.length - 1;
  const base = (sol: number): DataMeta => ({
    source: `NASA MMGIS · waypoints de ${r.rover}`,
    sourceUrl: r.source,
    acquiredAt: `sol ${sol} (≈ ${solToDate(site, sol)})`,
    retrievedAt: r.retrievedAt,
    tier: 1,
    confidence: 'high',
    shelfLife: 'slow',
    notes: NOTE_APPROX,
  });
  return r.waypoints.map((w, i) => {
    const first = i === 0;
    const current = i === last;
    return {
      id: `${site}-wp-${w.sol}`,
      name: first ? `Primer waypoint (sol ${w.sol})` : current ? `Última posición conocida (sol ${w.sol})` : `Waypoint sol ${w.sol}`,
      kind: 'waypoint',
      lonlat: [w.lon, w.lat],
      elevation_m: Number.isFinite(w.elevation_m) ? w.elevation_m : undefined,
      description_es: `Posición de ${r.rover} registrada en el sol ${w.sol}${Number.isFinite(w.elevation_m) ? `, a ${w.elevation_m} m de elevación` : ''}.`,
      whyItMatters_es: first
        ? 'Punto de partida de la trayectoria real; ancla de toda la ruta.'
        : current
          ? site === 'gale'
            ? 'Define la zona de trabajo actual y el centro del AOI de este prototipo.'
            : 'Última posición registrada del rover: hasta aquí llega la trayectoria real.'
          : 'Punto de la ruta real del rover: muestra por dónde ya se pudo transitar.',
      meta: base(w.sol),
    };
  });
}

/** Gale only: the 2025 boxwork campaign, inferred from the traverse (not a surveyed location). */
function boxworkPoi(): Poi {
  const r = ROVER.gale;
  const target = 4600; // sols 4410–4765 correspond to calendar 2025
  const p = r.traverse.reduce((a, b) => (Math.abs(b[2] - target) < Math.abs(a[2] - target) ? b : a));
  return {
    id: 'gale-boxwork-inferred',
    name: 'Campaña boxwork 2025 (ubicación inferida)',
    kind: 'science',
    lonlat: [p[0], p[1]],
    description_es: 'Zona de la trayectoria de Curiosity que corresponde al año 2025, cuando la spec indica que se estudió el boxwork.',
    whyItMatters_es: 'Objetivo científico del sitio (D2): formaciones boxwork de Mount Sharp, vinculadas a agua subterránea antigua.',
    meta: {
      source: 'Inferencia del equipo a partir de MMGIS + spec §D2',
      acquiredAt: `sol ${p[2]} (≈ ${solToDate('gale', p[2])})`,
      retrievedAt: r.retrievedAt,
      tier: 1,
      confidence: 'low',
      shelfLife: 'slow',
      notes: 'No es una coordenada publicada del boxwork: se tomó el waypoint más cercano al sol 4600 (calendario 2025). Confirmar con publicaciones de MSL.',
    },
  };
}

export function shelterPois(shelters: Shelter[]): Poi[] {
  return shelters.map((s) => ({
    id: `shelter-${s.id}`,
    name: `Refugio candidato ${s.id}`,
    kind: 'shelter',
    lonlat: s.coord,
    description_es: `Terreno bien blindado y transitable (dosis relativa ${s.doseRelative.toFixed(2)}).`,
    whyItMatters_es: 'Destino ante un evento de radiación solar (ver pestaña Seguridad).',
    meta: {
      source: 'Cálculo del equipo (blindaje estimado sobre terreno ilustrativo)',
      acquiredAt: 'Calculado en el navegador',
      retrievedAt: PROBE_DATE,
      tier: 1,
      confidence: 'estimated',
      shelfLife: 'slow',
      notes: 'Sitio candidato del modelo, no un lugar relevado.',
    },
  }));
}

export function buildPois(site: SiteId, shelters: Shelter[]): Poi[] {
  return [...roverPois(site), ...(site === 'gale' ? [boxworkPoi()] : []), ...shelterPois(shelters)];
}
