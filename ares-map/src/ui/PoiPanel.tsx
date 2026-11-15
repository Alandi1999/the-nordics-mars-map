import { KIND_LABEL, ROVER, type Poi } from '../data/pois';
import type { SiteId } from '../config/sites';
import { PROBE_DATE, type DataMeta } from '../lib/dataMeta';
import { DataBadge } from './DataBadge';

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
  const rover = ROVER[siteId];
  const traverseMeta: DataMeta = {
    source: `NASA MMGIS · trayectoria de ${rover.rover}`,
    sourceUrl: rover.source,
    acquiredAt: `sol ${rover.traverse[0][2]} a sol ${rover.lastSol}`,
    retrievedAt: rover.retrievedAt,
    tier: 1,
    confidence: 'high',
    shelfLife: 'medium',
    notes: 'Datos reales. Se dibujan sobre un terreno ilustrativo: la trayectoria es real, el relieve de fondo del AOI no.',
  };
  return (
    <>
      <section>
        <h2>Capas de puntos</h2>
        <label className="check">
          <input type="checkbox" checked={showTraverse} onChange={(e) => onToggleTraverse(e.target.checked)} />
          Trayectoria real de {rover.rover} (hasta sol {rover.lastSol})
        </label>
        <DataBadge meta={traverseMeta} />
        <label className="check">
          <input type="checkbox" checked={showPois} onChange={(e) => onTogglePois(e.target.checked)} />
          Puntos de interés ({pois.length})
        </label>
      </section>
      <section>
        <h2>Puntos de interés</h2>
        {selected && (
          <article className="poi" aria-live="polite" style={{ marginTop: 0, marginBottom: 12 }}>
            <h3>{selected.name}</h3>
            <p>{selected.description_es}</p>
            {selected.whyItMatters_es && <p><strong>Por qué importa:</strong> {selected.whyItMatters_es}</p>}
            <dl className="probe">
              <dt>Posición</dt><dd>{selected.lonlat[1].toFixed(4)}°, {selected.lonlat[0].toFixed(4)}°E</dd>
              {selected.elevation_m !== undefined && (<><dt>Elevación</dt><dd>{selected.elevation_m} m</dd></>)}
            </dl>
            <div className="seg">
              <button className="plain" onClick={() => onCenter(selected)}>Centrar</button>
              <button className="plain" onClick={() => onUseAs(selected, 'start')}>Usar como A</button>
              <button className="plain" onClick={() => onUseAs(selected, 'end')}>Usar como B</button>
            </div>
            {message && <p className="warnbox" role="status">{message}</p>}
            <DataBadge meta={selected.meta} />
          </article>
        )}
        <ul className="plain-list stack">
          {pois.map((p) => (
            <li key={p.id}>
              <button className="ghost left" aria-pressed={selected?.id === p.id} onClick={() => onSelect(p.id)}>
                <span aria-hidden="true">{KIND_SHAPE[p.kind]}</span> {p.name} <em>· {KIND_LABEL[p.kind]}</em>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

export const POI_LEGEND_META: DataMeta = {
  source: 'Leyenda del prototipo',
  acquiredAt: 'n/a',
  retrievedAt: PROBE_DATE,
  tier: 1,
  confidence: 'high',
  shelfLife: 'slow',
};
