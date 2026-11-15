import { DEFAULT_MOBILITY, type MobilityConfig } from '../config/mobility';
import { PROBE_DATE, type DataMeta } from '../lib/dataMeta';
import { DataBadge } from './DataBadge';
import { COST_COLORS, CONTOUR_INTERVAL_M, OVERLAY_LABELS, RAMP, ROUGHNESS_MAX_DEG, SLOPE_MAX_DEG, type OverlayId } from '../terrain/render';
import { compass, type Probe } from '../terrain/probe';

export const TERRAIN_META: DataMeta = {
  source: 'Terreno procedural del equipo (NO es dato de NASA)',
  acquiredAt: 'Generado en el navegador',
  retrievedAt: PROBE_DATE,
  tier: 1,
  confidence: 'estimated',
  shelfLife: 'slow',
  notes:
    'Elevación sintética (ruido + montaña + escarpe) con la altitud base de la spec. Sustituir por DTM HiRISE/HRSC del AOI en la versión real.',
};

export interface OverlayState {
  visible: boolean;
  opacity: number;
}

export const OVERLAY_IDS: OverlayId[] = ['hillshade', 'slope', 'roughness', 'cost', 'contours', 'shielding'];
export const TERRAIN_TAB_IDS: OverlayId[] = ['hillshade', 'slope', 'roughness', 'cost', 'contours'];

const rgb = (c: number[]) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;

function Legend({ id, mobility }: { id: OverlayId; mobility: MobilityConfig }) {
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
      [0, `Cómodo (≤ ${mobility.slopeComfortDeg}°)`],
      [1, `Precaución (≤ ${mobility.slopeCautionDeg}°)`],
      [2, `Difícil (≤ ${mobility.slopeNoGoDeg}°)`],
      [3, `Prohibido (> ${mobility.slopeNoGoDeg}°)`],
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
        <div className="ramp-labels"><span>terreno abierto (dosis 1,0)</span><span>muy blindado</span></div>
      </div>
    );
  }
  if (id === 'contours') return <p className="muted">Línea fina cada {CONTOUR_INTERVAL_M} m, gruesa cada {CONTOUR_INTERVAL_M * 4} m.</p>;
  return <p className="muted">Sol desde el NO (315°), 45° sobre el horizonte.</p>;
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
  return (
    <section>
      <h2>Terreno y peligros · ilustrativo</h2>
      <p className="muted">Cubre solo el recuadro naranja (AOI de ≈ 10 km).</p>
      {TERRAIN_TAB_IDS.map((id) => (
        <div className="layer" key={id}>
          <label>
            <input type="checkbox" checked={state[id].visible} onChange={(e) => onChange(id, { visible: e.target.checked })} />
            {OVERLAY_LABELS[id]}
          </label>
          <input
            type="range" min={0} max={1} step={0.05} value={state[id].opacity}
            aria-label={`Opacidad ${OVERLAY_LABELS[id]}`}
            onChange={(e) => onChange(id, { opacity: Number(e.target.value) })}
          />
        </div>
      ))}
      {TERRAIN_TAB_IDS.filter((id) => state[id].visible && id !== 'hillshade').map((id) => (
        <div key={id}>
          <h3>{OVERLAY_LABELS[id]}</h3>
          <Legend id={id} mobility={mobility} />
        </div>
      ))}
      <DataBadge meta={TERRAIN_META} />
    </section>
  );
}

type NumKey = 'slopeComfortDeg' | 'slopeCautionDeg' | 'slopeNoGoDeg' | 'a' | 'b' | 'walkSpeedKmh';

const FIELDS: { key: NumKey; label: string; min: number; max: number; step: number; unit: string }[] = [
  { key: 'slopeComfortDeg', label: 'Pendiente cómoda', min: 2, max: 20, step: 1, unit: '°' },
  { key: 'slopeCautionDeg', label: 'Pendiente de precaución', min: 5, max: 30, step: 1, unit: '°' },
  { key: 'slopeNoGoDeg', label: 'Pendiente prohibida', min: 10, max: 40, step: 1, unit: '°' },
  { key: 'a', label: 'a (peso de pendiente²)', min: 0, max: 0.05, step: 0.0025, unit: '' },
  { key: 'b', label: 'b (peso de rugosidad)', min: 0, max: 2, step: 0.05, unit: '' },
  { key: 'walkSpeedKmh', label: 'Velocidad en plano', min: 0.5, max: 5, step: 0.1, unit: ' km/h' },
];

export const MOBILITY_META: DataMeta = {
  source: 'Supuestos del equipo (spec §12), no datos de NASA',
  acquiredAt: 'n/a',
  retrievedAt: PROBE_DATE,
  tier: 1,
  confidence: 'estimated',
  shelfLife: 'slow',
  notes: 'Validar con literatura de operaciones EVA y calibrar con Jezero antes de afirmar rigor.',
};

export function MobilitySection({ cfg, onChange }: { cfg: MobilityConfig; onChange: (c: MobilityConfig) => void }) {
  const set = (key: NumKey, v: number) => {
    const next = { ...cfg, [key]: v };
    // Keep comfort <= caution <= no-go so the classes stay ordered.
    next.slopeCautionDeg = Math.max(next.slopeCautionDeg, next.slopeComfortDeg);
    next.slopeNoGoDeg = Math.max(next.slopeNoGoDeg, next.slopeCautionDeg);
    onChange(next);
  };
  return (
    <section>
      <h2>Parámetros de movilidad</h2>
      <p className="warnbox">
        {cfg.calibrated ? 'Calibrados con Jezero.' : 'SUPUESTOS SIN VALIDAR · calibración con Jezero pendiente'}
      </p>
      {FIELDS.map((f) => (
        <label className="field" key={f.key}>
          <span>{f.label}</span>
          <input type="range" min={f.min} max={f.max} step={f.step} value={cfg[f.key]} onChange={(e) => set(f.key, Number(e.target.value))} />
          <output>{cfg[f.key]}{f.unit}</output>
        </label>
      ))}
      <button className="ghost" onClick={() => onChange(DEFAULT_MOBILITY)}>Restablecer valores por defecto</button>
      <p className="muted">costo = 1 + a·pendiente² + b·rugosidad; prohibido si pendiente &gt; límite.</p>
      <DataBadge meta={MOBILITY_META} />
    </section>
  );
}

const CLASS_NAME = ['Cómodo', 'Precaución', 'Difícil', 'PROHIBIDO'];

export function ProbeSection({ probe, onClear }: { probe: Probe | null | undefined; onClear: () => void }) {
  if (probe === undefined) {
    return (
      <section>
        <h2>Sondeo</h2>
        <p className="muted">Hacé clic en el mapa para ver elevación, pendiente y costo.</p>
      </section>
    );
  }
  return (
    <section>
      <h2>Sondeo</h2>
      {probe === null ? (
        <p className="warnbox">Fuera del AOI: no hay dato de terreno aquí.</p>
      ) : (
        <>
          <dl className="probe">
            <dt>Posición</dt><dd>{probe.lat.toFixed(4)}°, {probe.lon.toFixed(4)}°E</dd>
            <dt>Elevación</dt><dd>{probe.elevationM.toFixed(1)} m</dd>
            <dt>Pendiente</dt><dd>{probe.slopeDeg.toFixed(1)}°</dd>
            <dt>Aspecto (cae hacia)</dt><dd>{probe.slopeDeg < 0.5 ? '— (llano)' : `${probe.aspectDeg.toFixed(0)}° ${compass(probe.aspectDeg)}`}</dd>
            <dt>Rugosidad</dt><dd>{probe.roughnessDeg.toFixed(2)}° (proxy)</dd>
            <dt>Dosis relativa</dt><dd>{probe.doseRelative.toFixed(2)} ≈ {probe.doseMsvDay === null ? 'sin dato RAD en este sitio' : `${probe.doseMsvDay.toFixed(2)} mSv/día`} (estimado)</dd>
            <dt>Clase</dt><dd>{CLASS_NAME[probe.cls]}</dd>
            <dt>Costo</dt><dd>{Number.isFinite(probe.costMultiplier) ? `×${probe.costMultiplier.toFixed(2)}` : 'intransitable'}</dd>
          </dl>
          <DataBadge meta={TERRAIN_META} />
        </>
      )}
      <button className="ghost" onClick={onClear}>Quitar sondeo</button>
    </section>
  );
}
