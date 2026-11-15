import type { SiteId } from '../config/sites';
import type { Confidence, DataMeta } from '../lib/dataMeta';
import type { Bi, Text } from '../i18n';
import { SOL_SECONDS } from '../lib/mars';
import { RAD_GALE_MSV_PER_DAY } from '../terrain/shielding';
import raw from './health.json';

export interface HealthItem {
  id: string;
  category: Bi;
  title: Bi;
  text: Bi;
  countermeasure?: Bi;
  source: Text;
  confidence: Exclude<Confidence, 'estimated'>;
  last_reviewed: string;
  applies_to: 'transit' | 'surface' | 'both';
  pendingSource: boolean;
}

export const HEALTH_ITEMS = raw.items as HealthItem[];
export const healthItem = (id: string) => HEALTH_ITEMS.find((i) => i.id === id);

export function healthMeta(i: HealthItem): DataMeta {
  return {
    source: i.source,
    acquiredAt: { en: `reviewed ${i.last_reviewed}`, es: `revisado ${i.last_reviewed}` },
    retrievedAt: i.last_reviewed,
    tier: 1,
    confidence: i.confidence,
    shelfLife: 'medium',
    tierNote: i.pendingSource ? { en: 'Pending a primary source (unverified)', es: 'Pendiente de fuente primaria (no verificado)' } : undefined,
    notes: i.pendingSource
      ? {
          en: 'PENDING A SOURCE: the content comes from the team board and a primary source still needs to be cited. Not medical advice.',
          es: 'PENDIENTE DE FUENTE: el contenido viene del board del equipo y falta citar una fuente primaria. No es consejo médico.',
        }
      : { en: 'Not medical advice.', es: 'No es consejo médico.' },
  };
}

/** Radiation reference from MSL/RAD (Hassler et al., 2014). */
export const RAD_CRUISE_MSV_PER_DAY = 1.8;
/** One-way transit for low-energy trajectories (NASA NTRS, spec §3). */
export const TRANSIT_DAYS_ONE_WAY = 180;

export interface RadiationBudget {
  /** Null when the site has no RAD measurement (spec D7). */
  surfaceMsv: number | null;
  transitMsv: number;
}

/** ESTIMATE: open-terrain baseline over `sol` sols (RAD reports per day; sol ≈ day) + a round trip in transit. */
export function radiationBudget(sol: number, site: SiteId): RadiationBudget {
  return {
    surfaceMsv: site === 'gale' ? RAD_GALE_MSV_PER_DAY * sol : null,
    transitMsv: 2 * TRANSIT_DAYS_ONE_WAY * RAD_CRUISE_MSV_PER_DAY,
  };
}

/** Hours a 24 h clock drifts from Mars local time after `sol` sols. */
export function circadianOffsetHours(sol: number): number {
  return (sol * (SOL_SECONDS - 86_400)) / 3600;
}

export type Phase = 'llegada' | 'inicio' | 'medio' | 'final';

/** Rough phase of a surface stay of `lengthSols` (arrival = first 3 sols). */
export function missionPhase(sol: number, lengthSols: number): Phase {
  if (sol <= 3) return 'llegada';
  const f = sol / lengthSols;
  return f < 0.34 ? 'inicio' : f < 0.67 ? 'medio' : 'final';
}

export interface GuideStep {
  text: Bi;
  /** Health item the step comes from; absent = team step. */
  itemId?: string;
}

export interface EventGuide {
  id: string;
  title: Bi;
  steps: GuideStep[];
  /** If set, triggering this event also starts the matching space-weather simulation. */
  solar?: boolean;
}

/** Step-by-step guides assembled only from Appendix A entries; steps without itemId are team steps. */
export const GUIDES: EventGuide[] = [
  {
    id: 'airlock-leak',
    title: { en: 'Airlock leak', es: 'Fuga en la esclusa' },
    steps: [
      { text: { en: 'Seal the affected module.', es: 'Sellar el módulo afectado.' }, itemId: 'pressure-breach' },
      { text: { en: 'Keep the pressurized emergency suit within reach.', es: 'Tener accesible el traje de emergencia presurizado.' }, itemId: 'pressure-breach' },
      { text: { en: 'Confirm the crew head count and alert the habitat.', es: 'Confirmar el recuento de la tripulación y avisar al hábitat.' } },
    ],
  },
  {
    id: 'dust-inhalation',
    title: { en: 'Perchlorate dust inhalation', es: 'Inhalación de polvo con percloratos' },
    steps: [
      { text: { en: 'Keep regolith out of the airlock: it contains perchlorates.', es: 'Evitar que el regolito ingrese por la esclusa: contiene percloratos.' }, itemId: 'perchlorates' },
      { text: { en: 'Control dust at the airlock: it is abrasive and degrades suits and seals.', es: 'Controlar el polvo en la esclusa: es abrasivo y degrada trajes y sellos.' }, itemId: 'dust-abrasion' },
      { text: { en: 'Log the exposure and the time.', es: 'Registrar la exposición y la hora.' } },
      { text: { en: 'Use assisted guidance or an interactive manual: real-time consultation with Earth is not possible.', es: 'Usar guía asistida o manual interactivo: la consulta en tiempo real con la Tierra no es posible.' }, itemId: 'medical-ai' },
    ],
  },
  {
    id: 'confinement-anxiety',
    title: { en: 'Confinement anxiety', es: 'Ansiedad por confinamiento' },
    steps: [
      { text: { en: 'Relieve the affected person from EVA.', es: 'Relevar de la EVA a la persona afectada.' }, itemId: 'crisis-psych' },
      { text: { en: 'Activate the line of succession.', es: 'Activar la línea de sucesión.' }, itemId: 'crisis-psych' },
      { text: { en: 'Enforced rest.', es: 'Descanso forzado.' }, itemId: 'crisis-psych' },
    ],
  },
  {
    id: 'isru-failure',
    title: { en: 'ISRU failure: cancel EVA', es: 'Falla de ISRU: cancelar EVA' },
    steps: [
      { text: { en: 'Switch to emergency life support.', es: 'Pasar a soporte vital de emergencia.' }, itemId: 'isru-failure' },
      { text: { en: 'Cancel the EVA and return to the habitat.', es: 'Cancelar la EVA y volver al hábitat.' }, itemId: 'isru-failure' },
      { text: { en: 'Ration consumables.', es: 'Racionar consumibles.' }, itemId: 'isru-failure' },
    ],
  },
  {
    id: 'solar-event',
    title: { en: 'Solar event: go to the shelter', es: 'Evento solar: ir al refugio' },
    solar: true,
    steps: [
      { text: { en: 'Shelter in a shielded area, with water and supplies, until the flux drops.', es: 'Confinarse en una zona blindada, con agua y provisiones, hasta que baje el flujo.' }, itemId: 'safe-haven' },
      { text: { en: 'See the nearest shelter and the time margin in the Safety tab.', es: 'Ver el refugio más cercano y el margen de tiempo en la pestaña Seguridad.' } },
    ],
  },
];
