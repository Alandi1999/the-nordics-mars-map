export type Tier = 1 | 2 | 3;
export type Confidence = 'high' | 'medium' | 'low' | 'estimated';
export type ShelfLife = 'slow' | 'medium' | 'fast';

/** Mandatory metadata for every datum shown in the UI (spec F10). */
export interface DataMeta {
  source: string;
  sourceUrl?: string;
  /** ISO-8601, "sol:N", or free text when the source does not date the product. */
  acquiredAt: string;
  retrievedAt: string;
  tier: Tier;
  confidence: Confidence;
  shelfLife: ShelfLife;
  notes?: string;
}

export const TIER_LABEL: Record<Tier, string> = {
  1: 'Dato científico previo',
  2: 'Observación local',
  3: 'Información de la Tierra',
};

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: 'alta',
  medium: 'media',
  low: 'baja',
  estimated: 'ESTIMADO / ilustrativo',
};

export const SHELF_LABEL: Record<ShelfLife, string> = {
  slow: 'envejece despacio',
  medium: 'envejece a ritmo medio',
  fast: 'envejece rápido',
};

export const PROBE_DATE = '2026-11-15';
