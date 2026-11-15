import type { ReactElement } from 'react';
import type { MobilityConfig } from '../config/mobility';
import { PROBE_DATE, type DataMeta } from '../lib/dataMeta';
import { PROFILE_INFO, type Route, type RouteProfile } from '../routing/plan';
import { COST_COLORS } from '../terrain/render';
import { DataBadge } from './DataBadge';

export type PickMode = 'probe' | 'start' | 'end' | 'hazard';

export const ROUTE_META: DataMeta = {
  source: 'Cálculo A* del equipo sobre terreno ilustrativo',
  acquiredAt: 'Calculado en el navegador',
  retrievedAt: PROBE_DATE,
  tier: 1,
  confidence: 'estimated',
  shelfLife: 'fast',
  notes:
    'Tiempo = distancia × costo de celda ÷ velocidad (supuesto). Riesgo = 70 % por clase de terreno recorrida + 30 % por pendiente máxima. Dosis media: promedio del blindaje estimado a lo largo de la ruta. Ver docs/ROUTING.md.',
};

const fmtKm = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`);
const fmtTime = (min: number) =>
  min >= 60 ? `${Math.floor(min / 60)} h ${Math.round(min % 60)} min` : `${Math.round(min)} min`;

export function ElevationProfile({ route }: { route: Route }) {
  const pts = route.profilePoints;
  const W = 300;
  const H = 110;
  const pad = { l: 6, r: 6, t: 8, b: 16 };
  const total = pts.at(-1)!.d || 1;
  const zs = pts.map((p) => p.elevationM);
  const zMin = Math.min(...zs);
  const zMax = Math.max(...zs);
  const span = Math.max(1, zMax - zMin);
  const x = (d: number) => pad.l + (d / total) * (W - pad.l - pad.r);
  const y = (z: number) => H - pad.b - ((z - zMin) / span) * (H - pad.t - pad.b);
  const area =
    `M ${x(0)} ${H - pad.b} ` + pts.map((p) => `L ${x(p.d).toFixed(1)} ${y(p.elevationM).toFixed(1)}`).join(' ') + ` L ${x(total)} ${H - pad.b} Z`;
  const step = Math.max(1, Math.floor(pts.length / 150));
  const segs: ReactElement[] = [];
  for (let k = step; k < pts.length; k += step) {
    const a = pts[k - step];
    const b = pts[k];
    const [r, g, bl] = COST_COLORS[Math.max(a.cls, b.cls)];
    segs.push(
      <line key={k} x1={x(a.d)} y1={y(a.elevationM)} x2={x(b.d)} y2={y(b.elevationM)} stroke={`rgb(${r},${g},${bl})`} strokeWidth={2.5} />,
    );
  }
  return (
    <figure className="profile">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Perfil de elevación de la ruta ${PROFILE_INFO[route.profile].label}: de ${zMin.toFixed(0)} a ${zMax.toFixed(0)} m en ${fmtKm(total)}`}
      >
        <path d={area} fill="rgba(255,255,255,0.06)" />
        {segs}
        <text x={pad.l} y={H - 3} className="ax">0</text>
        <text x={W - pad.r} y={H - 3} textAnchor="end" className="ax">{fmtKm(total)}</text>
        <text x={pad.l + 2} y={pad.t + 2} className="ax">{zMax.toFixed(0)} m</text>
        <text x={pad.l + 2} y={H - pad.b - 3} className="ax">{zMin.toFixed(0)} m</text>
      </svg>
      <figcaption className="muted">Color del trazo = clase de terreno (verde cómodo → rojo prohibido).</figcaption>
    </figure>
  );
}

interface Props {
  mode: PickMode;
  setMode: (m: PickMode) => void;
  hasStart: boolean;
  hasEnd: boolean;
  routes: Route[];
  message: string | null;
  selected: RouteProfile;
  onSelect: (p: RouteProfile) => void;
  onExample: () => void;
  onClear: () => void;
  mobility: MobilityConfig;
}

export function RouteSection({ mode, setMode, hasStart, hasEnd, routes, message, selected, onSelect, onExample, onClear, mobility }: Props) {
  const current = routes.find((r) => r.profile === selected) ?? routes[0];
  return (
    <section>
      <h2>Planificador de ruta</h2>
      <div className="seg" role="group" aria-label="Elegir puntos">
        <button aria-pressed={mode === 'start'} onClick={() => setMode(mode === 'start' ? 'probe' : 'start')}>
          {hasStart ? 'Mover inicio A' : 'Elegir inicio A'}
        </button>
        <button aria-pressed={mode === 'end'} onClick={() => setMode(mode === 'end' ? 'probe' : 'end')}>
          {hasEnd ? 'Mover destino B' : 'Elegir destino B'}
        </button>
      </div>
      <div className="seg">
        <button className="plain" onClick={onExample}>Ruta de ejemplo</button>
        <button className="plain" onClick={onClear} disabled={!hasStart && !hasEnd}>Limpiar</button>
      </div>
      {(mode === 'start' || mode === 'end') && <p className="hint">Hacé clic en el mapa para fijar {mode === 'start' ? 'el inicio' : 'el destino'}.</p>}
      {message && <p className="warnbox" role="status">{message}</p>}
      {!message && hasStart && hasEnd && routes.length === 0 && <p className="warnbox" role="status">No hay ruta posible con estos umbrales.</p>}

      {routes.length > 0 && (
        <>
          <div className="routes" role="radiogroup" aria-label="Rutas">
            {routes.map((r) => {
              const info = PROFILE_INFO[r.profile];
              return (
                <button
                  key={r.profile}
                  role="radio"
                  aria-checked={r.profile === current.profile}
                  className="route"
                  style={{ borderLeftColor: info.color }}
                  onClick={() => onSelect(r.profile)}
                >
                  <strong>{info.label}</strong>
                  <span>{fmtKm(r.stats.distanceM)} · {fmtTime(r.stats.timeMin)}</span>
                  <span>pend. máx {r.stats.maxSlopeDeg.toFixed(1)}° · +{Math.round(r.stats.ascentM)} m / −{Math.round(r.stats.descentM)} m</span>
                  <span>dosis media {r.stats.meanDose.toFixed(2)} (est.){r.stats.maxShelterDistM !== null && ` · refugio más lejano ${fmtKm(r.stats.maxShelterDistM)}`}</span>
                  <span className="risk">
                    Riesgo (estimado) {r.stats.risk}/100
                    <i style={{ width: `${r.stats.risk}%` }} />
                  </span>
                  {r.sameAs && <em>Igual que «{PROFILE_INFO[r.sameAs].label}»</em>}
                </button>
              );
            })}
          </div>
          <p className="muted">{PROFILE_INFO[current.profile].hint} Velocidad base {mobility.walkSpeedKmh} km/h (supuesto).</p>
          <ElevationProfile route={current} />
          <DataBadge meta={ROUTE_META} />
        </>
      )}
    </section>
  );
}
