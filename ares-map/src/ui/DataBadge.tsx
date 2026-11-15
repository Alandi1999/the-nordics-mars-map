import { CONFIDENCE_LABEL, SHELF_LABEL, TIER_LABEL, type DataMeta } from '../lib/dataMeta';

/** Compact provenance badge. Every datum shown in a panel must carry one. */
export function DataBadge({ meta }: { meta: DataMeta }) {
  return (
    <details className="badge">
      <summary>
        <span className={`dot ${meta.confidence}`} aria-hidden="true" />
        {meta.confidence === 'estimated' ? 'ESTIMADO' : `T${meta.tier}`} · {meta.source}
      </summary>
      <dl>
        <dt>Fuente</dt>
        <dd>
          {meta.sourceUrl ? (
            <a href={meta.sourceUrl} target="_blank" rel="noreferrer">
              {meta.source}
            </a>
          ) : (
            meta.source
          )}
        </dd>
        <dt>Adquisición</dt>
        <dd>{meta.acquiredAt}</dd>
        <dt>Descargado</dt>
        <dd>{meta.retrievedAt}</dd>
        <dt>Nivel</dt>
        <dd>
          {meta.tierNote ??
            (meta.confidence !== 'estimated'
              ? TIER_LABEL[meta.tier]
              : meta.tier === 3
                ? `${TIER_LABEL[3]} (muestra ilustrativa, valores inventados)`
                : 'Estimación del equipo (no es dato científico previo)')}
        </dd>
        <dt>Confianza</dt>
        <dd>{CONFIDENCE_LABEL[meta.confidence]}</dd>
        <dt>Vigencia</dt>
        <dd>{SHELF_LABEL[meta.shelfLife]}</dd>
        {meta.notes && (
          <>
            <dt>Notas</dt>
            <dd>{meta.notes}</dd>
          </>
        )}
      </dl>
    </details>
  );
}
