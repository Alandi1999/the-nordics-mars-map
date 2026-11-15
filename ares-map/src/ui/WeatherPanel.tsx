import { useState } from 'react';
import { type DataMeta } from '../lib/dataMeta';
import { useI18n, type Bi } from '../i18n';
import type { SolWeather, WeatherSample, WeatherSeries } from '../lib/weather';
import { DataBadge } from './DataBadge';

/** The wind sensor limitation is specific to MEDA (spec §5.4 and §12), so the note depends on the site. */
const windNote = (instrument: string): Bi =>
  instrument.includes('MEDA')
    ? { en: 'Wind is not simulated: per the spec, the MEDA wind sensor is degraded.', es: 'No se simula viento: según la spec, el sensor de viento de MEDA está degradado.' }
    : { en: 'Wind is not simulated.', es: 'No se simula viento.' };

export const WEATHER_META = (instrument: string): DataMeta => ({
  source: {
    en: `INVENTED weather series for the demo (real data would come from ${instrument})`,
    es: `Serie de clima INVENTADA para la demo (el dato real vendría de ${instrument})`,
  },
  acquiredAt: {
    en: 'Generated in the browser; the sol and date only place the series along the rover traverse',
    es: 'Generada en el navegador; el sol y la fecha solo sitúan la serie en la trayectoria del rover',
  },
  retrievedAt: { en: 'Not applicable: generated in the browser, not downloaded', es: 'No aplica: se genera en el navegador, no se descarga' },
  tier: 1,
  confidence: 'estimated',
  shelfLife: 'fast',
  notes: {
    en: `These are not REMS or MEDA measurements. It shows the shape of a daily cycle (cold before dawn, peak in the afternoon, low pressure with small variation). Weather ages fast: real data should show its age. ${windNote(instrument).en}`,
    es: `No son mediciones de REMS ni de MEDA. Muestra la forma de un ciclo diario (frío antes del amanecer, máximo por la tarde, presión baja y con variación pequeña). El clima envejece rápido: un dato real debería mostrar su antigüedad. ${windNote(instrument).es}`,
  },
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
  const { t } = useI18n();
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
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t(`${label}: from ${lo.toFixed(digits)} to ${hi.toFixed(digits)} ${unit} over one sol (invented series)`, `${label}: de ${lo.toFixed(digits)} a ${hi.toFixed(digits)} ${unit} en un sol (serie inventada)`)}>
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
        {t(
          `${label} (${unit}) by local solar time. The scale is the same for every sol. Gray band = night by convention (0–6 h and 18–24 h), not a computed sunrise. Filled dot = maximum of the sol; empty = minimum.`,
          `${label} (${unit}) según la hora solar local. La escala es la misma para todos los sols. Franja gris = noche por convención (0–6 h y 18–24 h), no es un amanecer calculado. Punto lleno = máximo del sol; vacío = mínimo.`,
        )}
      </figcaption>
    </figure>
  );
}

export function WeatherSection({ series, onThemis }: {
  series: WeatherSeries;
  onThemis: (kind: 'day' | 'night') => void;
}) {
  const { t } = useI18n();
  const [idx, setIdx] = useState(series.sols.length - 1);
  const safeIdx = Math.min(idx, series.sols.length - 1);
  const sol: SolWeather = series.sols[safeIdx];
  const tMin = Math.min(...series.sols.map((s) => s.tMinC));
  const tMax = Math.max(...series.sols.map((s) => s.tMaxC));
  const pMin = Math.min(...series.sols.map((s) => s.pMinPa));
  const pMax = Math.max(...series.sols.map((s) => s.pMaxPa));
  const solText = t(`reference sol ${sol.sol} (≈ ${sol.date}) · invented values`, `sol de referencia ${sol.sol} (≈ ${sol.date}) · valores inventados`);
  return (
    <section>
      <h2>{t('Surface weather · simulated', 'Clima de superficie · simulado')}</h2>
      <p className="warnbox" role="note">
        {t(
          `ESTIMATED · INVENTED SERIES. With real data it would come from ${series.instrument}; here it only shows how it would look.`,
          `ESTIMADO · SERIE INVENTADA. Con datos reales vendría de ${series.instrument}; aquí solo muestra cómo se vería.`,
        )}
      </p>
      <label className="field">
        <span>Sol</span>
        <input
          type="range" min={0} max={series.sols.length - 1} step={1} value={safeIdx}
          aria-label={t('Sol of the series', 'Sol de la serie')}
          aria-valuetext={solText}
          onChange={(e) => setIdx(Number(e.target.value))}
        />
        <output>{solText}</output>
      </label>
      <dl className="probe">
        <dt>{t('Temperature', 'Temperatura')}</dt>
        <dd>{t(
          `${sol.tMinC.toFixed(0)} °C to ${sol.tMaxC.toFixed(0)} °C (swing of ${(sol.tMaxC - sol.tMinC).toFixed(0)} °C between night and day)`,
          `${sol.tMinC.toFixed(0)} °C a ${sol.tMaxC.toFixed(0)} °C (variación ${(sol.tMaxC - sol.tMinC).toFixed(0)} °C entre noche y día)`,
        )}</dd>
        <dt>{t('Pressure', 'Presión')}</dt>
        <dd>{sol.pMinPa.toFixed(0)} {t('to', 'a')} {sol.pMaxPa.toFixed(0)} Pa</dd>
        <dt>{t(`The ${series.sols.length} sols`, `Los ${series.sols.length} sols`)}</dt>
        <dd>{t(`temperature between ${tMin.toFixed(0)} and ${tMax.toFixed(0)} °C`, `temperatura entre ${tMin.toFixed(0)} y ${tMax.toFixed(0)} °C`)}</dd>
      </dl>
      <Chart samples={sol.samples} pick={(s) => s.tempC} unit="°C" color="#fb923c" label={t('Air temperature', 'Temperatura del aire')} digits={0} domain={[tMin, tMax]} />
      <Chart samples={sol.samples} pick={(s) => s.pressurePa} unit="Pa" color="#38bdf8" label={t('Pressure', 'Presión')} digits={0} domain={[pMin, pMax]} />
      <h3>{t('Real thermal imagery (THEMIS)', 'Imagen térmica real (THEMIS)')}</h3>
      <p className="muted">{t('The map thermal layers are real data from the Mars Odyssey spacecraft.', 'Las capas térmicas del mapa sí son datos reales de la nave Mars Odyssey.')}</p>
      <div className="seg">
        <button className="plain" onClick={() => onThemis('day')}>{t('View THEMIS daytime', 'Ver THEMIS de día')}</button>
        <button className="plain" onClick={() => onThemis('night')}>{t('View THEMIS nighttime', 'Ver THEMIS de noche')}</button>
      </div>
      <DataBadge meta={WEATHER_META(series.instrument)} />
    </section>
  );
}
