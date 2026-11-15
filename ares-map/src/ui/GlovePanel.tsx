import { useI18n } from '../i18n';
import { STATUS_TEXT, type Status } from '../safety/protocol';
import { PROBE_DATE, type DataMeta } from '../lib/dataMeta';
import { DataBadge } from './DataBadge';

export const GLOVE_META: DataMeta = {
  source: { en: 'ARES NAV concept by the team (not existing technology)', es: 'Concepto ARES NAV del equipo (no es tecnología existente)' },
  acquiredAt: { en: 'Simulated in the browser', es: 'Simulado en el navegador' },
  retrievedAt: PROBE_DATE,
  tier: 1,
  confidence: 'estimated',
  shelfLife: 'fast',
  notes: {
    en: 'There is no Martian GPS. The position is simulated: the position of point A (or the AOI center if there is no A) plus a configurable error. Only the essentials: alert, bearing, distance and link.',
    es: 'No existe un GPS marciano. La posición es simulada: posición del punto A (o el centro del AOI si no hay A) más un error configurable. Solo lo esencial: alerta, rumbo, distancia y enlace.',
  },
};

export interface GloveView {
  status: Status | null;
  targetLabel: string | null;
  bearing: number | null;
  distanceM: number | null;
  etaMin: number | null;
  etaKind: 'ruta' | 'línea recta';
  rttMin: number;
  online: boolean;
  alertLeftMin: number | null;
}

export function GloveSection({ view, noiseM, onNoise }: { view: GloveView; noiseM: number; onNoise: (m: number) => void }) {
  const { t, l } = useI18n();
  const band = view.status ? l(STATUS_TEXT[view.status].code) : t('NO ALERTS', 'SIN ALERTAS');
  const cls = view.status ?? 'idle';
  return (
    <section>
      <h2>{t('Glove · concept view', 'Guantelete · vista de concepto')}</h2>
      <div className={`glove ${cls}`} role="group" aria-label={t('Glove display (simulated)', 'Pantalla del guantelete (simulada)')}>
        <div className="ribbon">{t('CONCEPT · SIMULATED POSITION', 'CONCEPTO · POSICIÓN SIMULADA')}</div>
        <div className="gband">
          {view.status === 'ok' ? '● ' : view.status === 'tight' ? '▲ ' : view.status ? '■ ' : ''}
          {band}
          {view.alertLeftMin !== null && view.alertLeftMin > 0 && ` · ${Math.round(view.alertLeftMin)} min`}
        </div>
        {view.targetLabel && view.bearing !== null && view.distanceM !== null ? (
          <div className="gnav">
            <svg viewBox="-50 -50 100 100" className="garrow" role="img" aria-label={t(`Bearing ${Math.round(view.bearing)} degrees`, `Rumbo ${Math.round(view.bearing)} grados`)}>
              <circle r="46" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.4" />
              <text y="-34" textAnchor="middle" fontSize="12" fill="currentColor">N</text>
              <g transform={`rotate(${view.bearing})`}>
                <path d="M0 -30 L14 12 L0 4 L-14 12 Z" fill="currentColor" />
              </g>
            </svg>
            <div>
              <div className="gtarget">{view.targetLabel}</div>
              <div className="gdist">{view.distanceM >= 1000 ? `${(view.distanceM / 1000).toFixed(2)} km` : `${Math.round(view.distanceM)} m`}</div>
              <div className="gsub">
                {t('bearing', 'rumbo')} {Math.round(view.bearing)}°
                {view.etaMin !== null && ` · ${Math.round(view.etaMin)} min (${view.etaKind === 'ruta' ? t('route', 'ruta') : t('straight line', 'línea recta')})`}
              </div>
            </div>
          </div>
        ) : (
          <div className="gnav empty">{t('Set a point A and a destination B (Route tab) or trigger an alert (Safety).', 'Fijá un punto A y un destino B (pestaña Ruta) o lanzá una alerta (Seguridad).')}</div>
        )}
        <div className="gfoot">
          <span>{t('LINK', 'ENLACE')}: {view.online ? t('NETWORK', 'RED') : t('NO SIGNAL', 'SIN SEÑAL')}</span>
          <span>{t('Earth round trip', 'Tierra ida y vuelta')} {view.rttMin.toFixed(0)} min</span>
        </div>
      </div>
      <label className="field">
        <span>{t('Simulated position error (inertial)', 'Error de posición simulado (inercial)')}</span>
        <input type="range" min={0} max={300} step={10} value={noiseM} onChange={(e) => onNoise(Number(e.target.value))} />
        <output>±{noiseM} m</output>
      </label>
      <p className="muted">
        {t(
          'Designed for gloved hands: few words, large numbers, code by color + shape + text. In the concept, the glove carries only the map and alerts and the heavy computation would run on the satellite and the hub; in this prototype everything is computed in the browser.',
          'Pensado para manos enguantadas: pocas palabras, números grandes, código por color + forma + texto. En el concepto, el guantelete lleva solo mapa y alertas y el cálculo pesado correría en el satélite y el hub; en este prototipo todo se calcula en el navegador.',
        )}
      </p>
      <DataBadge meta={GLOVE_META} />
    </section>
  );
}
