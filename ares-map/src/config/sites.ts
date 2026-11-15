import type { DataMeta } from '../lib/dataMeta';
import type { Bi } from '../i18n';
import galeRover from '../data/gale.rover.json';
import jezeroRover from '../data/jezero.rover.json';

export type SiteId = 'gale' | 'jezero';

export interface SiteConfig {
  id: SiteId;
  name: Bi;
  objective: Bi;
  /** [lon east-positive, lat planetocentric] */
  center: [number, number];
  /** Initial view width in km. */
  viewKm: number;
  meta: DataMeta;
}

export const SITES: Record<SiteId, SiteConfig> = {
  gale: {
    id: 'gale',
    name: { en: 'Gale Crater / Mount Sharp', es: 'Cráter Gale / Mount Sharp' },
    objective: {
      en: 'Accessibility and safety of a traverse toward the boxwork unit.',
      es: 'Accesibilidad y seguridad de una caminata hacia la unidad con boxwork.',
    },
    center: [137.389, -4.826],
    viewKm: 40,
    meta: {
      source: { en: 'NASA MMGIS · Curiosity (MSL) waypoints', es: 'NASA MMGIS · waypoints de Curiosity (MSL)' },
      sourceUrl: 'https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json',
      acquiredAt: { en: `up to sol ${galeRover.lastSol}`, es: `hasta sol ${galeRover.lastSol}` },
      retrievedAt: galeRover.retrievedAt,
      tier: 1,
      confidence: 'high',
      shelfLife: 'medium',
      notes: {
        en: "AOI centred on Curiosity's last known position (climbing Mount Sharp), in the area where the boxwork was studied.",
        es: 'AOI centrado en la última posición conocida de Curiosity (subiendo por Mount Sharp), en la zona donde se estudió el boxwork.',
      },
    },
  },
  jezero: {
    id: 'jezero',
    name: { en: 'Jezero Crater', es: 'Cráter Jezero' },
    objective: {
      en: 'Test bed: validate hazard thresholds against terrain that is already mapped.',
      es: 'Banco de pruebas: validar umbrales de peligro con terreno ya cartografiado.',
    },
    center: [77.3, 18.465],
    viewKm: 40,
    meta: {
      source: { en: 'NASA MMGIS · Perseverance (Mars 2020) waypoints', es: 'NASA MMGIS · waypoints de Perseverance (Mars 2020)' },
      sourceUrl: 'https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json',
      acquiredAt: { en: `up to sol ${jezeroRover.lastSol}`, es: `hasta sol ${jezeroRover.lastSol}` },
      retrievedAt: jezeroRover.retrievedAt,
      tier: 1,
      confidence: 'high',
      shelfLife: 'medium',
      notes: {
        en: 'Centre taken from the real traverse. The spec landing coordinates (18.36° N / 77.59° E) do not match the waypoints: the measured data was used.',
        es: 'Centro tomado de la trayectoria real. Las coordenadas de aterrizaje de la spec (18,36° N / 77,59° E) no coinciden con los waypoints: se usó el dato medido.',
      },
    },
  },
};
