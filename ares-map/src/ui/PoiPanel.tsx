import { KIND_LABEL, ROVER, type Poi } from '../data/pois';
import type { SiteId } from '../config/sites';
import { PROBE_DATE, type DataMeta } from '../lib/dataMeta';
import { DataBadge } from './DataBadge';
import { useI18n } from '../i18n';

const KIND_SHAPE: Record<Poi['kind'], string> = {
  waypoint: '●', science: '◆', hazard: '▲', habitat: '■', shelter: '■', landmark: '★',
};

export function PoiSection({ siteId, pois, selected, showTraverse, showPois, onToggleTraverse, onTogglePois, onSelect, onCenter, onUseAs, message }: {
  siteId: SiteId;
  pois: Poi[];
  selected: Poi | null;
  showTraverse: boolean;
  showPois: boolean;
  onToggleTraverse: (v: boolean) => void;
  onTogglePois: (v: boolean) => void;
  onSelect: (id: string) => void;
  onCenter: (p: Poi) => void;
  onUseAs: (p: Poi, as: 'start' | 'end') => void;
  message: string | null;
}) {
  const { t, l } = useI18n();
  const rover = ROVER[siteId];
  const traverseMeta: DataMeta = {
    source: { en: `NASA MMGIS · ${rover.rover} traverse`, es: `NASA MMGIS · trayectoria de ${rover.rover}` },
    sourceUrl: rover.source,
    acquiredAt: { en: `sol ${rover.traverse[0][2]} to sol ${rover.lastSol}`, es: `sol ${rover.traverse[0][2]} a sol ${rover.lastSol}` },
    retrievedAt: rover.retrievedAt,
    tier: 1,
    confidence: 'high',
    shelfLife: 'medium',
    notes: {
      en: 'Real data. Drawn over illustrative terrain: the traverse is real, the AOI background relief is not.',
      es: 'Datos reales. Se dibujan sobre un terreno ilustrativo: la trayectoria es real, el relieve de fondo del AOI no.',
    },
  };
  return (
    <>
      <section>
        <h2>{t('Point layers', 'Capas de puntos')}</h2>
        <label className="check">
          <input type="checkbox" checked={showTraverse} onChange={(e) => onToggleTraverse(e.target.checked)} />
          {t(`Real ${rover.rover} traverse (up to sol ${rover.lastSol})`, `Trayectoria real de ${rover.rover} (hasta sol ${rover.lastSol})`)}
        </label>
        <DataBadge meta={traverseMeta} />
        <label className="check">
          <input type="checkbox" checked={showPois} onChange={(e) => onTogglePois(e.target.checked)} />
          {t('Points of interest', 'Puntos de interés')} ({pois.length})
        </label>
      </section>
      <section>
        <h2>{t('Points of interest', 'Puntos de interés')}</h2>
        {selected && (
          <article className="poi" aria-live="polite" style={{ marginTop: 0, marginBottom: 12 }}>
            <h3>{l(selected.name)}</h3>
            <p>{l(selected.description)}</p>
            {selected.whyItMatters && <p><strong>{t('Why it matters:', 'Por qué importa:')}</strong> {l(selected.whyItMatters)}</p>}
            <dl className="probe">
              <dt>{t('Position', 'Posición')}</dt><dd>{selected.lonlat[1].toFixed(4)}°, {selected.lonlat[0].toFixed(4)}°E</dd>
              {selected.elevation_m !== undefined && (<><dt>{t('Elevation', 'Elevación')}</dt><dd>{selected.elevation_m} m</dd></>)}
            </dl>
            <div className="seg">
              <button className="plain" onClick={() => onCenter(selected)}>{t('Center', 'Centrar')}</button>
              <button className="plain" onClick={() => onUseAs(selected, 'start')}>{t('Use as A', 'Usar como A')}</button>
              <button className="plain" onClick={() => onUseAs(selected, 'end')}>{t('Use as B', 'Usar como B')}</button>
            </div>
            {message && <p className="warnbox" role="status">{message}</p>}
            <DataBadge meta={selected.meta} />
          </article>
        )}
        <ul className="plain-list stack">
          {pois.map((p) => (
            <li key={p.id}>
              <button className="ghost left" aria-pressed={selected?.id === p.id} onClick={() => onSelect(p.id)}>
                <span aria-hidden="true">{KIND_SHAPE[p.kind]}</span> {l(p.name)} <em>· {l(KIND_LABEL[p.kind])}</em>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

export const POI_LEGEND_META: DataMeta = {
  source: { en: 'Prototype legend', es: 'Leyenda del prototipo' },
  acquiredAt: 'n/a',
  retrievedAt: PROBE_DATE,
  tier: 1,
  confidence: 'high',
  shelfLife: 'slow',
};
