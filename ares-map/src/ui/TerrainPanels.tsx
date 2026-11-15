import { DEFAULT_MOBILITY, type MobilityConfig } from '../config/mobility';
import { PROBE_DATE, type DataMeta } from '../lib/dataMeta';
import { DataBadge } from './DataBadge';
import { useI18n, type Bi } from '../i18n';
import { COST_COLORS, CONTOUR_INTERVAL_M, OVERLAY_LABELS, RAMP, ROUGHNESS_MAX_DEG, SLOPE_MAX_DEG, type OverlayId } from '../terrain/render';
import { compass, type Probe } from '../terrain/probe';

export const TERRAIN_META: DataMeta = {
  source: { en: 'Team procedural terrain (NOT NASA data)', es: 'Terreno procedural del equipo (NO es dato de NASA)' },
  acquiredAt: { en: 'Generated in the browser', es: 'Generado en el navegador' },
  retrievedAt: PROBE_DATE,
  tier: 1,
  confidence: 'estimated',
  shelfLife: 'slow',
  notes: {
    en: 'Synthetic relief (noise + mountain + scarp) anchored to the measured elevation of a real rover waypoint; all other heights are invented. Replace with the HiRISE/HRSC DTM of the AOI in the real version.',
    es: 'Relieve sintético (ruido + montaña + escarpe) anclado a la elevación medida de un waypoint real del rover; el resto de las alturas es inventado. Sustituir por DTM HiRISE/HRSC del AOI en la versión real.',
  },
};

export interface OverlayState {
  visible: boolean;
  opacity: number;
}

export const OVERLAY_IDS: OverlayId[] = ['hillshade', 'slope', 'roughness', 'cost', 'contours', 'shielding'];
export const TERRAIN_TAB_IDS: OverlayId[] = ['hillshade', 'slope', 'roughness', 'cost', 'contours'];

const rgb = (c: number[]) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;

function Legend({ id, mobility }: { id: OverlayId; mobility: MobilityConfig }) {
  const { t } = useI18n();
  if (id === 'slope' || id === 'roughness') {
    const max = id === 'slope' ? SLOPE_MAX_DEG : ROUGHNESS_MAX_DEG;
    const grad = RAMP.map(([t, r, g, b]) => `${rgb([r, g, b])} ${t * 100}%`).join(', ');
    return (
      <div className="legend">
        <div className="ramp" style={{ background: `linear-gradient(90deg, ${grad})` }} />
        <div className="ramp-labels"><span>0°</span><span>{max}°+</span></div>
      </div>
    );
  }
  if (id === 'cost') {
    const rows: [number, string][] = [
      [0, t(`Comfortable (≤ ${mobility.slopeComfortDeg}°)`, `Cómodo (≤ ${mobility.slopeComfortDeg}°)`)],
      [1, t(`Caution (≤ ${mobility.slopeCautionDeg}°)`, `Precaución (≤ ${mobility.slopeCautionDeg}°)`)],
      [2, t(`Difficult (≤ ${mobility.slopeNoGoDeg}°)`, `Difícil (≤ ${mobility.slopeNoGoDeg}°)`)],
      [3, t(`Forbidden (> ${mobility.slopeNoGoDeg}°)`, `Prohibido (> ${mobility.slopeNoGoDeg}°)`)],
    ];
    return (
      <ul className="legend classes">
        {rows.map(([k, label]) => (
          <li key={k}>
            <span className="swatch" style={{ background: rgb(COST_COLORS[k]) }} />
            {label}
          </li>
        ))}
      </ul>
    );
  }
  if (id === 'shielding') {
    const grad = RAMP.map(([t, r, g, b]) => `${rgb([r, g, b])} ${t * 100}%`).join(', ');
    return (
      <div className="legend">
        <div className="ramp" style={{ background: `linear-gradient(90deg, ${grad})` }} />
        <div className="ramp-labels"><span>{t('open terrain (dose 1.0)', 'terreno abierto (dosis 1,0)')}</span><span>{t('heavily shielded', 'muy blindado')}</span></div>
      </div>
    );
  }
  if (id === 'contours') return <p className="muted">{t(`Thin line every ${CONTOUR_INTERVAL_M} m, thick line every ${CONTOUR_INTERVAL_M * 4} m.`, `Línea fina cada ${CONTOUR_INTERVAL_M} m, gruesa cada ${CONTOUR_INTERVAL_M * 4} m.`)}</p>;
  return <p className="muted">{t('Sun from the NW (315°), 45° above the horizon.', 'Sol desde el NO (315°), 45° sobre el horizonte.')}</p>;
}

export { Legend };

export function TerrainSection({
  state,
  mobility,
  onChange,
}: {
  state: Record<OverlayId, OverlayState>;
  mobility: MobilityConfig;
  onChange: (id: OverlayId, p: Partial<OverlayState>) => void;
}) {
  const { t, l } = useI18n();
  return (
    <section>
      <h2>{t('Terrain and hazards · illustrative', 'Terreno y peligros · ilustrativo')}</h2>
      <p className="muted">{t('Covers only the orange box (≈ 10 km AOI).', 'Cubre solo el recuadro naranja (AOI de ≈ 10 km).')}</p>
      {TERRAIN_TAB_IDS.map((id) => (
        <div className="layer" key={id}>
          <label>
            <input type="checkbox" checked={state[id].visible} onChange={(e) => onChange(id, { visible: e.target.checked })} />
            {l(OVERLAY_LABELS[id])}
          </label>
          <input
            type="range" min={0} max={1} step={0.05} value={state[id].opacity}
            aria-label={t(`Opacity ${l(OVERLAY_LABELS[id])}`, `Opacidad ${l(OVERLAY_LABELS[id])}`)}
            onChange={(e) => onChange(id, { opacity: Number(e.target.value) })}
          />
        </div>
      ))}
      {TERRAIN_TAB_IDS.filter((id) => state[id].visible && id !== 'hillshade').map((id) => (
        <div key={id}>
          <h3>{l(OVERLAY_LABELS[id])}</h3>
          <Legend id={id} mobility={mobility} />
        </div>
      ))}
      <DataBadge meta={TERRAIN_META} />
    </section>
  );
}

type NumKey = 'slopeComfortDeg' | 'slopeCautionDeg' | 'slopeNoGoDeg' | 'a' | 'b' | 'walkSpeedKmh';

const FIELDS: { key: NumKey; label: Bi; min: number; max: number; step: number; unit: string }[] = [
  { key: 'slopeComfortDeg', label: { en: 'Comfortable slope', es: 'Pendiente cómoda' }, min: 2, max: 20, step: 1, unit: '°' },
  { key: 'slopeCautionDeg', label: { en: 'Caution slope', es: 'Pendiente de precaución' }, min: 5, max: 30, step: 1, unit: '°' },
  { key: 'slopeNoGoDeg', label: { en: 'Forbidden slope', es: 'Pendiente prohibida' }, min: 10, max: 40, step: 1, unit: '°' },
  { key: 'a', label: { en: 'a (slope² weight)', es: 'a (peso de pendiente²)' }, min: 0, max: 0.05, step: 0.0025, unit: '' },
  { key: 'b', label: { en: 'b (roughness weight)', es: 'b (peso de rugosidad)' }, min: 0, max: 2, step: 0.05, unit: '' },
  { key: 'walkSpeedKmh', label: { en: 'Speed on flat ground', es: 'Velocidad en plano' }, min: 0.5, max: 5, step: 0.1, unit: ' km/h' },
];

export const MOBILITY_META: DataMeta = {
  source: { en: 'Team assumptions (spec §12), not NASA data', es: 'Supuestos del equipo (spec §12), no datos de NASA' },
  acquiredAt: 'n/a',
  retrievedAt: PROBE_DATE,
  tier: 1,
  confidence: 'estimated',
  shelfLife: 'slow',
  notes: {
    en: 'Validate against EVA operations literature and calibrate with Jezero before claiming rigor.',
    es: 'Validar con literatura de operaciones EVA y calibrar con Jezero antes de afirmar rigor.',
  },
};

export function MobilitySection({ cfg, onChange }: { cfg: MobilityConfig; onChange: (c: MobilityConfig) => void }) {
  const { t, l } = useI18n();
  const set = (key: NumKey, v: number) => {
    const next = { ...cfg, [key]: v };
    // Keep comfort <= caution <= no-go so the classes stay ordered.
    next.slopeCautionDeg = Math.max(next.slopeCautionDeg, next.slopeComfortDeg);
    next.slopeNoGoDeg = Math.max(next.slopeNoGoDeg, next.slopeCautionDeg);
    onChange(next);
  };
  return (
    <section>
      <h2>{t('Mobility parameters', 'Parámetros de movilidad')}</h2>
      <p className="warnbox">
        {cfg.calibrated
          ? t('Calibrated with Jezero.', 'Calibrados con Jezero.')
          : t('UNVALIDATED ASSUMPTIONS · Jezero calibration pending', 'SUPUESTOS SIN VALIDAR · calibración con Jezero pendiente')}
      </p>
      {FIELDS.map((f) => (
        <label className="field" key={f.key}>
          <span>{l(f.label)}</span>
          <input type="range" min={f.min} max={f.max} step={f.step} value={cfg[f.key]} onChange={(e) => set(f.key, Number(e.target.value))} />
          <output>{cfg[f.key]}{f.unit}</output>
        </label>
      ))}
      <button className="ghost" onClick={() => onChange(DEFAULT_MOBILITY)}>{t('Reset to defaults', 'Restablecer valores por defecto')}</button>
      <p className="muted">{t('cost = 1 + a·slope² + b·roughness; forbidden if slope > limit.', 'costo = 1 + a·pendiente² + b·rugosidad; prohibido si pendiente > límite.')}</p>
      <DataBadge meta={MOBILITY_META} />
    </section>
  );
}

const CLASS_NAME: Bi[] = [
  { en: 'Comfortable', es: 'Cómodo' },
  { en: 'Caution', es: 'Precaución' },
  { en: 'Difficult', es: 'Difícil' },
  { en: 'FORBIDDEN', es: 'PROHIBIDO' },
];

export function ProbeSection({ probe, onClear }: { probe: Probe | null | undefined; onClear: () => void }) {
  const { t, l } = useI18n();
  if (probe === undefined) {
    return (
      <section>
        <h2>{t('Probe', 'Sondeo')}</h2>
        <p className="muted">{t('Click the map to see elevation, slope and cost.', 'Hacé clic en el mapa para ver elevación, pendiente y costo.')}</p>
      </section>
    );
  }
  return (
    <section>
      <h2>{t('Probe', 'Sondeo')}</h2>
      {probe === null ? (
        <p className="warnbox">{t('Outside the AOI: there is no terrain data here.', 'Fuera del AOI: no hay dato de terreno aquí.')}</p>
      ) : (
        <>
          <dl className="probe">
            <dt>{t('Position', 'Posición')}</dt><dd>{probe.lat.toFixed(4)}°, {probe.lon.toFixed(4)}°E</dd>
            <dt>{t('Elevation', 'Elevación')}</dt><dd>{probe.elevationM.toFixed(1)} m</dd>
            <dt>{t('Slope', 'Pendiente')}</dt><dd>{probe.slopeDeg.toFixed(1)}°</dd>
            <dt>{t('Aspect (faces toward)', 'Aspecto (cae hacia)')}</dt><dd>{probe.slopeDeg < 0.5 ? t('— (flat)', '— (llano)') : `${probe.aspectDeg.toFixed(0)}° ${l(compass(probe.aspectDeg))}`}</dd>
            <dt>{t('Roughness', 'Rugosidad')}</dt><dd>{probe.roughnessDeg.toFixed(2)}° (proxy)</dd>
            <dt>{t('Relative dose', 'Dosis relativa')}</dt><dd>{probe.doseRelative.toFixed(2)} ≈ {probe.doseMsvDay === null ? t('no RAD data at this site', 'sin dato RAD en este sitio') : t(`${probe.doseMsvDay.toFixed(1)} mSv/day`, `${probe.doseMsvDay.toFixed(1)} mSv/día`)} {t('(estimated)', '(estimado)')}</dd>
            <dt>{t('Class', 'Clase')}</dt><dd>{l(CLASS_NAME[probe.cls])}</dd>
            <dt>{t('Cost', 'Costo')}</dt><dd>{Number.isFinite(probe.costMultiplier) ? `×${probe.costMultiplier.toFixed(2)}` : t('impassable', 'intransitable')}</dd>
          </dl>
          <DataBadge meta={TERRAIN_META} />
        </>
      )}
      <button className="ghost" onClick={onClear}>{t('Remove probe', 'Quitar sondeo')}</button>
    </section>
  );
}
