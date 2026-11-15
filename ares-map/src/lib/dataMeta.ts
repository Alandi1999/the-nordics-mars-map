import type { Bi, Text } from '../i18n';

export type Tier = 1 | 2 | 3;
export type Confidence = 'high' | 'medium' | 'low' | 'estimated';
export type ShelfLife = 'slow' | 'medium' | 'fast';

/** Mandatory metadata for every datum shown in the UI (spec F10). Text fields may be bilingual. */
export interface DataMeta {
  source: Text;
  sourceUrl?: string;
  /** ISO-8601, "sol:N", or free text when the source does not date the product. */
  acquiredAt: Text;
  retrievedAt: Text;
  tier: Tier;
  confidence: Confidence;
  shelfLife: ShelfLife;
  /** Overrides the tier label when the data is not "previous scientific data" (e.g. pending a source). */
  tierNote?: Text;
  notes?: Text;
}

export const TIER_LABEL: Record<Tier, Bi> = {
  1: { en: 'Prior scientific data', es: 'Dato científico previo' },
  2: { en: 'Local observation', es: 'Observación local' },
  3: { en: 'Information from Earth', es: 'Información de la Tierra' },
};

export const CONFIDENCE_LABEL: Record<Confidence, Bi> = {
  high: { en: 'high', es: 'alta' },
  medium: { en: 'medium', es: 'media' },
  low: { en: 'low', es: 'baja' },
  estimated: { en: 'ESTIMATED / illustrative', es: 'ESTIMADO / ilustrativo' },
};

export const SHELF_LABEL: Record<ShelfLife, Bi> = {
  slow: { en: 'ages slowly', es: 'envejece despacio' },
  medium: { en: 'ages at a medium pace', es: 'envejece a ritmo medio' },
  fast: { en: 'ages quickly', es: 'envejece rápido' },
};

export const PROBE_DATE = '2026-11-15';
