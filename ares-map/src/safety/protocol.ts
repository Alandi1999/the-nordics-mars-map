import type { Bi } from '../i18n';

export type Severity = 'minor' | 'moderate' | 'severe';

/** Space-weather event in the shape of a DONKI WSA-ENLIL impact entry (location "Mars"). */
export interface SpaceWeatherEvent {
  simulationID: string;
  modelCompletionTime: string;
  impact: { location: 'Mars'; arrivalTime: string; isGlancingBlow: boolean; isMinorImpact: boolean };
  cme: { speed: number; halfAngle: number };
  /** Team assumption: how much the surface dose rate rises during the event, x baseline. */
  doseMultiplier: number;
  /** Minutes from "now" to arrival when the event is triggered in the demo. */
  etaMin: number;
  severity: Severity;
  title: Bi;
}

export type Status = 'ok' | 'tight' | 'late' | 'no-shelter';

export interface Assessment {
  status: Status;
  /** Minutes to spare between reaching the shelter (plus buffer) and the arrival. */
  marginMin: number | null;
}

/** Buffer the crew keeps before arrival (team assumption). */
export const SAFETY_BUFFER_MIN = 15;

export function assess(minutesToArrival: number, walkMinToShelter: number | null, bufferMin = SAFETY_BUFFER_MIN): Assessment {
  if (walkMinToShelter === null) return { status: 'no-shelter', marginMin: null };
  const margin = minutesToArrival - walkMinToShelter;
  if (margin < 0) return { status: 'late', marginMin: margin };
  return { status: margin < bufferMin ? 'tight' : 'ok', marginMin: margin };
}

export const STATUS_TEXT: Record<Status, { code: Bi; action: Bi }> = {
  ok: {
    code: { en: 'GREEN CODE', es: 'CÓDIGO VERDE' },
    action: { en: 'Stop the activity and head to the shelter now; there is enough margin.', es: 'Interrumpir la actividad y dirigirse al refugio ahora; hay margen suficiente.' },
  },
  tight: {
    code: { en: 'AMBER CODE', es: 'CÓDIGO ÁMBAR' },
    action: { en: 'Go to the shelter immediately and without detours; the margin is short.', es: 'Ir al refugio de inmediato y sin desvíos; el margen es corto.' },
  },
  late: {
    code: { en: 'RED CODE', es: 'CÓDIGO ROJO' },
    action: {
      en: 'The shelter cannot be reached before arrival: go to the nearest best-shielded terrain and call the habitat for help.',
      es: 'No se llega al refugio antes de la llegada: ir al terreno más blindado cercano y pedir ayuda al hábitat.',
    },
  },
  'no-shelter': {
    code: { en: 'NO SHELTER', es: 'SIN REFUGIO' },
    action: { en: 'No candidate shelter in the AOI: return to the habitat by the known route.', es: 'No hay refugio candidato en el AOI: volver al hábitat por la ruta conocida.' },
  },
};
