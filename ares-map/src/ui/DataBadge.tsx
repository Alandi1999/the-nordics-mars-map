import { useI18n } from '../i18n';
import { CONFIDENCE_LABEL, SHELF_LABEL, TIER_LABEL, type DataMeta } from '../lib/dataMeta';

/** Compact provenance badge. Every datum shown in a panel must carry one. */
export function DataBadge({ meta }: { meta: DataMeta }) {
  const { t, l } = useI18n();
  const estimated = meta.confidence === 'estimated';
  const tierText =
    meta.tierNote !== undefined
      ? l(meta.tierNote)
      : !estimated
        ? l(TIER_LABEL[meta.tier])
        : meta.tier === 3
          ? `${l(TIER_LABEL[3])} ${t('(illustrative sample, invented values)', '(muestra ilustrativa, valores inventados)')}`
          : t('Team estimate (not prior scientific data)', 'Estimación del equipo (no es dato científico previo)');
  const source = l(meta.source);
  return (
    <details className="badge">
      <summary>
        <span className={`dot ${meta.confidence}`} aria-hidden="true" />
        {estimated ? t('ESTIMATED', 'ESTIMADO') : `T${meta.tier}`} · {source}
      </summary>
      <dl>
        <dt>{t('Source', 'Fuente')}</dt>
        <dd>
          {meta.sourceUrl ? (
            <a href={meta.sourceUrl} target="_blank" rel="noreferrer">
              {source}
            </a>
          ) : (
            source
          )}
        </dd>
        <dt>{t('Acquired', 'Adquisición')}</dt>
        <dd>{l(meta.acquiredAt)}</dd>
        <dt>{t('Retrieved', 'Descargado')}</dt>
        <dd>{l(meta.retrievedAt)}</dd>
        <dt>{t('Level', 'Nivel')}</dt>
        <dd>{tierText}</dd>
        <dt>{t('Confidence', 'Confianza')}</dt>
        <dd>{l(CONFIDENCE_LABEL[meta.confidence])}</dd>
        <dt>{t('Shelf life', 'Vigencia')}</dt>
        <dd>{l(SHELF_LABEL[meta.shelfLife])}</dd>
        {meta.notes !== undefined && (
          <>
            <dt>{t('Notes', 'Notas')}</dt>
            <dd>{l(meta.notes)}</dd>
          </>
        )}
      </dl>
    </details>
  );
}
