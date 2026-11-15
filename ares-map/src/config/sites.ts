import type { DataMeta } from '../lib/dataMeta';
import galeRover from '../data/gale.rover.json';
import jezeroRover from '../data/jezero.rover.json';

export type SiteId = 'gale' | 'jezero';

export interface SiteConfig {
  id: SiteId;
  name: string;
  objective_es: string;
  /** [lon east-positive, lat planetocentric] */
  center: [number, number];
  /** Initial view width in km. */
  viewKm: number;
  meta: DataMeta;
}

export const SITES: Record<SiteId, SiteConfig> = {
  gale: {
    id: 'gale',
    name: 'Cráter Gale / Mount Sharp',
    objective_es: 'Accesibilidad y seguridad de una caminata hacia la unidad con boxwork.',
    center: [137.389, -4.826],
    viewKm: 40,
    meta: {
      source: 'NASA MMGIS · waypoints de Curiosity (MSL)',
      sourceUrl: 'https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json',
      acquiredAt: `hasta sol ${galeRover.lastSol}`,
      retrievedAt: galeRover.retrievedAt,
      tier: 1,
      confidence: 'high',
      shelfLife: 'medium',
      notes: 'AOI centrado en la última posición conocida de Curiosity (subiendo por Mount Sharp), en la zona donde se estudió el boxwork.',
    },
  },
  jezero: {
    id: 'jezero',
    name: 'Cráter Jezero',
    objective_es: 'Banco de pruebas: validar umbrales de peligro con terreno ya cartografiado.',
    center: [77.3, 18.465],
    viewKm: 40,
    meta: {
      source: 'NASA MMGIS · waypoints de Perseverance (Mars 2020)',
      sourceUrl: 'https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json',
      acquiredAt: `hasta sol ${jezeroRover.lastSol}`,
      retrievedAt: jezeroRover.retrievedAt,
      tier: 1,
      confidence: 'high',
      shelfLife: 'medium',
      notes: 'Centro tomado de la trayectoria real. Las coordenadas de aterrizaje de la spec (18,36° N / 77,59° E) no coinciden con los waypoints: se usó el dato medido.',
    },
  },
};
