import { useState } from 'react';
import { type DataMeta } from '../lib/dataMeta';
import type { SolWeather, WeatherSample, WeatherSeries } from '../lib/weather';
import { DataBadge } from './DataBadge';

/** The wind sensor limitation is specific to MEDA (spec §5.4 and §12), so the note depends on the site. */
const windNote = (instrument: string) =>
  instrument.includes('MEDA')
    ? 'No se simula viento: según la spec, el sensor de viento de MEDA está degradado.'
    : 'No se simula viento.';

export const WEATHER_META = (instrument: string): DataMeta => ({
  source: `Serie de clima INVENTADA para la demo (el dato real vendría de ${instrument})`,
  acquiredAt: 'Generada en el navegador; el sol y la fecha solo sitúan la serie en la trayectoria del rover',
  retrievedAt: 'No aplica: se genera en el navegador, no se descarga',
  tier: 1,
  confidence: 'estimated',
  shelfLife: 'fast',
  notes: `No son mediciones de REMS ni de MEDA. Muestra la forma de un ciclo diario (frío antes del amanecer, máximo por la tarde, presión baja y con variación pequeña). El clima envejece rápido: un dato real debería mostrar su antigüedad. ${windNote(instrument)}`,
});

const W = 300;
const H = 120;
const PAD = { l: 34, r: 8, t: 10, b: 20 };

/** One chart. The Y domain is shared by every sol, so moving the slider does not rescale the axis. */
function Chart({ samples, pick, unit, color, label, digits, domain }: {
  samples: WeatherSample[];
  pick: (s: WeatherSample) => number;
  unit: string;
  color: string;
  label: string;
  digits: number;
  domain: [number, number];
}) {
  const ys = samples.map(pick);
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const pad = Math.max(1e-6, (domain[1] - domain[0]) * 0.08);
  const yMin = domain[0] - pad;
  const yMax = domain[1] + pad;
  const x = (h: number) => PAD.l + (h / 24) * (W - PAD.l - PAD.r);
  const y = (v: number) => H - PAD.b - ((v - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b);
  const path = samples.map((s, i) => `${i ? 'L' : 'M'} ${x(s.lmstH).toFixed(1)} ${y(pick(s)).toFixed(1)}`).join(' ');
  const iMin = ys.indexOf(lo);
  const iMax = ys.indexOf(hi);
  const ticks = [domain[0], (domain[0] + domain[1]) / 2, domain[1]];
  return (
    <figure className="profile">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: de ${lo.toFixed(digits)} a ${hi.toFixed(digits)} ${unit} en un sol (serie inventada)`}>
        {/* Night shading by convention: before 6 h and after 18 h local time */}
        <rect x={x(0)} y={PAD.t} width={x(6) - x(0)} height={H - PAD.t - PAD.b} fill="rgba(255,255,255,0.05)" />
        <rect x={x(18)} y={PAD.t} width={x(24) - x(18)} height={H - PAD.t - PAD.b} fill="rgba(255,255,255,0.05)" />
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.10)" strokeDasharray="2 3" />
            <text x={PAD.l - 4} y={y(t) + 3} textAnchor="end" className="ax">{t.toFixed(digits)}</text>
          </g>
        ))}
        <path d={path} fill="none" stroke={color} strokeWidth={2} />
        <circle cx={x(samples[iMax].lmstH)} cy={y(hi)} r={3.5} fill={color} />
        <circle cx={x(samples[iMin].lmstH)} cy={y(lo)} r={3.5} fill="none" stroke={color} strokeWidth={2} />
        {[0, 6, 12, 18, 24].map((h) => (
          <text key={h} x={x(h)} y={H - 5} textAnchor="middle" className="ax">{h} h</text>
        ))}
      </svg>
      <figcaption className="muted">
        {label} ({unit}) según la hora solar local. La escala es la misma para todos los sols. Franja gris = noche por convención
        (0–6 h y 18–24 h), no es un amanecer calculado. Punto lleno = máximo del sol; vacío = mínimo.
      </figcaption>
    </figure>
  );
}

export function WeatherSection({ series, onThemis }: {
  series: WeatherSeries;
  onThemis: (kind: 'day' | 'night') => void;
}) {
  const [idx, setIdx] = useState(series.sols.length - 1);
  const safeIdx = Math.min(idx, series.sols.length - 1);
  const sol: SolWeather = series.sols[safeIdx];
  const tMin = Math.min(...series.sols.map((s) => s.tMinC));
  const tMax = Math.max(...series.sols.map((s) => s.tMaxC));
  const pMin = Math.min(...series.sols.map((s) => s.pMinPa));
  const pMax = Math.max(...series.sols.map((s) => s.pMaxPa));
  const solText = `sol de referencia ${sol.sol} (≈ ${sol.date}) · valores inventados`;
  return (
    <section>
      <h2>Clima de superficie · simulado</h2>
      <p className="warnbox" role="note">
        ESTIMADO · SERIE INVENTADA. Con datos reales vendría de {series.instrument}; aquí solo muestra cómo se vería.
      </p>
      <label className="field">
        <span>Sol</span>
        <input
          type="range" min={0} max={series.sols.length - 1} step={1} value={safeIdx}
          aria-label="Sol de la serie"
          aria-valuetext={solText}
          onChange={(e) => setIdx(Number(e.target.value))}
        />
        <output>{solText}</output>
      </label>
      <dl className="probe">
        <dt>Temperatura</dt>
        <dd>{sol.tMinC.toFixed(0)} °C a {sol.tMaxC.toFixed(0)} °C (variación {(sol.tMaxC - sol.tMinC).toFixed(0)} °C entre noche y día)</dd>
        <dt>Presión</dt>
        <dd>{sol.pMinPa.toFixed(0)} a {sol.pMaxPa.toFixed(0)} Pa</dd>
        <dt>Los {series.sols.length} sols</dt>
        <dd>temperatura entre {tMin.toFixed(0)} y {tMax.toFixed(0)} °C</dd>
      </dl>
      <Chart samples={sol.samples} pick={(s) => s.tempC} unit="°C" color="#fb923c" label="Temperatura del aire" digits={0} domain={[tMin, tMax]} />
      <Chart samples={sol.samples} pick={(s) => s.pressurePa} unit="Pa" color="#38bdf8" label="Presión" digits={0} domain={[pMin, pMax]} />
      <h3>Imagen térmica real (THEMIS)</h3>
      <p className="muted">Las capas térmicas del mapa sí son datos reales de la nave Mars Odyssey.</p>
      <div className="seg">
        <button className="plain" onClick={() => onThemis('day')}>Ver THEMIS de día</button>
        <button className="plain" onClick={() => onThemis('night')}>Ver THEMIS de noche</button>
      </div>
      <DataBadge meta={WEATHER_META(series.instrument)} />
    </section>
  );
}
