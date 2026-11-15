import { useMemo, useState } from 'react';
import { useI18n, type Bi } from '../i18n';
import { PROBE_DATE, type DataMeta } from '../lib/dataMeta';
import { linkAt, latencySeries, waitState } from '../lib/ephemeris';
import { INCIDENT_LABEL, type Incident, type IncidentType } from '../routing/incidents';
import { STATUS_TEXT, type Assessment, type SpaceWeatherEvent } from '../safety/protocol';
import type { Shelter } from '../safety/shelters';
import { RAD_GALE_MSV_PER_DAY } from '../terrain/shielding';
import type { SiteId } from '../config/sites';
import { DataBadge } from './DataBadge';

export const SHIELD_META: DataMeta = {
  source: { en: 'Geometric shielding of the illustrative terrain (sky-view factor), team calculation', es: 'Blindaje geométrico del terreno ilustrativo (sky-view factor), cálculo del equipo' },
  acquiredAt: { en: 'Computed in the browser', es: 'Calculado en el navegador' },
  retrievedAt: PROBE_DATE,
  tier: 1,
  confidence: 'estimated',
  shelfLife: 'slow',
  notes: { en: 'Simplified model: relative dose = max(0.25, visible sky). It is not radiation transport and the base terrain is illustrative.', es: 'Modelo simplificado: dosis relativa = máx(0,25; cielo visible). No es transporte de radiación y el terreno de base es ilustrativo.' },
};

export const SHELTER_META: DataMeta = {
  source: { en: 'Candidate sites computed from the estimated shielding (not surveyed)', es: 'Sitios candidatos calculados del blindaje estimado (no relevados)' },
  acquiredAt: { en: 'Computed in the browser', es: 'Calculado en el navegador' },
  retrievedAt: PROBE_DATE,
  tier: 1,
  confidence: 'estimated',
  shelfLife: 'slow',
  notes: { en: 'Best geometric shielding (sky-view factor) among passable cells, separated by ≥ 1.2 km. Simplified model, not radiation transport.', es: 'Mejor blindaje geométrico (sky-view factor) entre celdas transitables, separadas ≥ 1,2 km. Modelo simplificado, no transporte de radiación.' },
};

export const EVENT_META: DataMeta = {
  source: { en: 'Illustrative sample using the NASA DONKI schema (WSA-ENLIL, impact on Mars)', es: 'Muestra ilustrativa con el esquema de NASA DONKI (WSA-ENLIL, impacto en Marte)' },
  sourceUrl: 'https://kauai.ccmc.gsfc.nasa.gov/DONKI/',
  acquiredAt: { en: 'Values invented for the demo', es: 'Valores inventados para la demo' },
  retrievedAt: PROBE_DATE,
  tier: 3,
  confidence: 'estimated',
  shelfLife: 'fast',
  notes: {
    en: 'DONKI is experimental and is not the official forecast (NOAA SWPC). A solar event does not imply an impact on Mars: only simulations that include it are used. The dose multiplier is a team assumption.',
    es: 'DONKI es experimental y no es el pronóstico oficial (NOAA SWPC). Un evento solar no implica impacto en Marte: solo se usan simulaciones que lo incluyen. El multiplicador de dosis es un supuesto del equipo.',
  },
};

export const LINK_META: DataMeta = {
  source: { en: 'astronomy-engine (offline ephemerides), validated against JPL Horizons', es: 'astronomy-engine (efemérides offline), validado contra JPL Horizons' },
  sourceUrl: 'https://ssd.jpl.nasa.gov/horizons/',
  acquiredAt: { en: 'Computed for the chosen date', es: 'Calculado para la fecha elegida' },
  retrievedAt: PROBE_DATE,
  tier: 1,
  confidence: 'high',
  shelfLife: 'slow',
  notes: { en: 'Latency = geometric distance / c. Matches Horizons within 0.1% on the dates tested.', es: 'Latencia = distancia geométrica / c. Coincide con Horizons dentro de 0,1 % en las fechas probadas.' },
};

export const INCIDENT_META: DataMeta = {
  source: { en: 'Local observation by the user (local queue, not synced with Earth)', es: 'Observación local del usuario (cola local, sin sincronizar con la Tierra)' },
  acquiredAt: { en: 'Time of the report', es: 'Hora del reporte' },
  retrievedAt: PROBE_DATE,
  tier: 2,
  confidence: 'medium',
  shelfLife: 'fast',
};

const fmtClock = (min: number) => {
  const total = Math.max(0, Math.round(min * 60));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

/* ---------- Shelters ---------- */

export function SheltersSection({ shelters, siteId }: { shelters: Shelter[]; siteId: SiteId }) {
  const { t } = useI18n();
  return (
    <section>
      <h2>{t('Shelter zones · estimated', 'Zonas de refugio · estimadas')}</h2>
      {shelters.length === 0 ? (
        <p className="warnbox">{t('There is no shielded, passable terrain in the AOI.', 'No hay terreno blindado y transitable en el AOI.')}</p>
      ) : (
        <ul className="plain-list">
          {shelters.map((s) => (
            <li key={s.id}>
              <strong>{s.id}</strong> · {t('relative dose', 'dosis relativa')} {s.doseRelative.toFixed(2)}
              {siteId === 'gale' && ` ≈ ${(s.doseRelative * RAD_GALE_MSV_PER_DAY).toFixed(1)} mSv/${t('day', 'día')}`}
            </li>
          ))}
        </ul>
      )}
      <p className="muted">
        {t(
          `RAD baseline (${RAD_GALE_MSV_PER_DAY} mSv/day) at Gale only: mean from Aug 2012 to Jun 2013 (Hassler et al., 2014), not real time.`,
          `Línea base RAD (${RAD_GALE_MSV_PER_DAY} mSv/día) solo en Gale: media de ago-2012 a jun-2013 (Hassler et al., 2014), no tiempo real.`,
        )}
        {siteId === 'jezero' && t(' There is no RAD measurement at Jezero: only the relative dose is shown.', ' En Jezero no hay medición RAD: solo se muestra la dosis relativa.')}
      </p>
      <DataBadge meta={SHELTER_META} />
    </section>
  );
}

/* ---------- Space weather + protocol ---------- */

export interface Sim {
  event: SpaceWeatherEvent;
  elapsedMin: number;
}

export function EventsSection({ events, sim, speed, onTrigger, onDismiss, onSpeed }: {
  events: SpaceWeatherEvent[];
  sim: Sim | null;
  speed: number;
  onTrigger: (e: SpaceWeatherEvent) => void;
  onDismiss: () => void;
  onSpeed: (s: number) => void;
}) {
  const { t, l } = useI18n();
  return (
    <section>
      <h2>{t('Space-weather alerts', 'Alertas de clima espacial')}</h2>
      <p className="warnbox">{t('ILLUSTRATIVE SAMPLE using the DONKI schema · not a real forecast', 'MUESTRA ILUSTRATIVA con el esquema de DONKI · no es un pronóstico real')}</p>
      <ul className="plain-list">
        {events.map((e) => (
          <li key={e.simulationID}>
            <button className="ghost" onClick={() => onTrigger(e)} aria-pressed={sim?.event.simulationID === e.simulationID}>
              {t('Simulate', 'Simular')}: {l(e.title)} · {t('arrival in', 'llegada en')} {fmtClock(e.etaMin)}
            </button>
          </li>
        ))}
      </ul>
      <label className="field">
        <span>{t('Demo speed', 'Velocidad de la demo')}</span>
        <select value={speed} onChange={(e) => onSpeed(Number(e.target.value))}>
          <option value={1}>{t('Real time ×1', 'Tiempo real ×1')}</option>
          <option value={30}>×30</option>
          <option value={120}>×120</option>
        </select>
      </label>
      {sim && <button className="ghost" onClick={onDismiss}>{t('Dismiss alert', 'Descartar alerta')}</button>}
      <DataBadge meta={EVENT_META} />
    </section>
  );
}

const IMPACT = (e: SpaceWeatherEvent): Bi =>
  e.impact.isGlancingBlow
    ? { en: 'glancing blow', es: 'impacto rasante' }
    : e.impact.isMinorImpact
      ? { en: 'minor impact', es: 'impacto menor' }
      : { en: 'direct impact', es: 'impacto directo' };

export function ProtocolCard({ sim, assessment, shelter, walkMin, walkDistM, doseHere, siteId, fromLabel }: {
  sim: Sim;
  assessment: Assessment;
  shelter: Shelter | null;
  walkMin: number | null;
  walkDistM: number | null;
  doseHere: number;
  siteId: SiteId;
  fromLabel: string;
}) {
  const { t, l } = useI18n();
  const e = sim.event;
  const left = e.etaMin - sim.elapsedMin;
  const st = STATUS_TEXT[assessment.status];
  const arrived = left <= 0;
  const shape = { ok: '●', tight: '▲', late: '■', 'no-shelter': '■' }[assessment.status];
  return (
    <section className={`protocol ${assessment.status}`} aria-live="polite">
      <h2>{t('Protocol card', 'Tarjeta de protocolo')}</h2>
      <p className="code">{shape} {l(st.code)}</p>
      <dl className="probe">
        <dt>{t('1 · Alert', '1 · Alerta')}</dt>
        <dd>{l(e.title)} ({l(IMPACT(e))}, CME {e.cme.speed} km/s)</dd>
        <dt>{t('Arrival', 'Llegada')}</dt>
        <dd>{arrived ? t('EVENT IN PROGRESS', 'EVENTO EN CURSO') : t(`in ${fmtClock(left)}`, `en ${fmtClock(left)}`)}</dd>
        <dt>{t('2 · Risk', '2 · Riesgo')}</dt>
        <dd>
          {t(`Dose ×${e.doseMultiplier} over baseline (assumption).`, `Dosis ×${e.doseMultiplier} sobre la base (supuesto).`)}{' '}
          {siteId === 'gale'
            ? t(
                `Here ≈ ${(doseHere * RAD_GALE_MSV_PER_DAY * e.doseMultiplier).toFixed(1)} mSv/day (order of magnitude, estimated).`,
                `Aquí ≈ ${(doseHere * RAD_GALE_MSV_PER_DAY * e.doseMultiplier).toFixed(1)} mSv/día (orden de magnitud, estimado).`,
              )
            : t(`Relative dose here ${doseHere.toFixed(2)}.`, `Dosis relativa aquí ${doseHere.toFixed(2)}.`)}
        </dd>
        <dt>{t('3 · Action', '3 · Acción')}</dt>
        <dd>{l(st.action)}</dd>
        {shelter && walkMin !== null && (
          <>
            <dt>{t('Shelter', 'Refugio')}</dt>
            <dd>
              {t(
                `${shelter.id} ${fmtClock(walkMin)} away on foot (≈ ${Math.round(walkDistM ?? 0)} m) from ${fromLabel}`,
                `${shelter.id} a ${fmtClock(walkMin)} de marcha (≈ ${Math.round(walkDistM ?? 0)} m) desde ${fromLabel}`,
              )}
              {assessment.marginMin !== null && ` · ${t('margin', 'margen')} ${assessment.marginMin >= 0 ? '+' : ''}${Math.round(assessment.marginMin)} min`}
            </dd>
          </>
        )}
      </dl>
      <p className="muted">{t('Illustrative team protocol (concept). It is not an official NASA procedure or medical advice.', 'Protocolo ilustrativo del equipo (concepto). No es un procedimiento oficial de NASA ni consejo médico.')}</p>
      <DataBadge meta={EVENT_META} />
    </section>
  );
}

/* ---------- Earth–Mars link ---------- */

const todayIso = () => new Date().toISOString().slice(0, 10);

export function LinkSection() {
  const { t } = useI18n();
  const [date, setDate] = useState(todayIso());
  const [waited, setWaited] = useState(0);
  const at = useMemo(() => new Date(`${date}T00:00:00Z`), [date]);
  const valid = !Number.isNaN(at.getTime());
  const state = useMemo(() => (valid ? linkAt(at) : null), [at, valid]);
  const series = useMemo(() => latencySeries(new Date('2025-01-01T00:00:00Z'), new Date('2030-01-01T00:00:00Z'), 15), []);

  const W = 300;
  const H = 100;
  const t0 = series[0].t;
  const t1 = series.at(-1)!.t;
  const x = (t: number) => 6 + ((t - t0) / (t1 - t0)) * (W - 12);
  const y = (m: number) => H - 14 - ((m - 3) / 20) * (H - 24);
  const line = series.map((p, i) => `${i ? 'L' : 'M'} ${x(p.t).toFixed(1)} ${y(p.oneWayMin).toFixed(1)}`).join(' ');
  const min = series.reduce((a, p) => (p.oneWayMin < a.oneWayMin ? p : a));
  const max = series.reduce((a, p) => (p.oneWayMin > a.oneWayMin ? p : a));

  return (
    <section>
      <h2>{t('Earth–Mars link', 'Enlace Tierra–Marte')}</h2>
      <label className="field">
        <span>{t('Date (UTC)', 'Fecha (UTC)')}</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="datein" />
      </label>
      {state ? (
        <>
          <dl className="probe">
            <dt>{t('Distance', 'Distancia')}</dt><dd>{state.distanceMkm.toFixed(1)} M km ({state.distanceAu.toFixed(3)} {t('AU', 'UA')})</dd>
            <dt>{t('One-way latency', 'Latencia un sentido')}</dt><dd>{state.oneWayMin.toFixed(1)} min</dd>
            <dt>{t('Round trip', 'Ida y vuelta')}</dt><dd>{state.roundTripMin.toFixed(1)} min</dd>
          </dl>
          <label className="field">
            <span>{t('Time without a reply from Earth', 'Tiempo sin respuesta de la Tierra')}</span>
            <input type="range" min={0} max={60} step={1} value={waited} onChange={(e) => setWaited(Number(e.target.value))} />
            <output>{waited} min</output>
          </label>
          <p className={waitState(waited, state.roundTripMin) === 'overdue' ? 'warnbox' : 'okbox'} role="status">
            {waitState(waited, state.roundTripMin) === 'overdue'
              ? t(
                  `NO REPLY ≥ ${state.roundTripMin.toFixed(0)} min: longer than the expected round trip. Continue with the autonomous plan and retry.`,
                  `SIN RESPUESTA ≥ ${state.roundTripMin.toFixed(0)} min: más que la ida y vuelta esperada. Seguir con el plan autónomo y reintentar.`,
                )
              : t(
                  `Waiting: still within the round trip (${state.roundTripMin.toFixed(0)} min). This is normal.`,
                  `Esperando: aún dentro de la ida y vuelta (${state.roundTripMin.toFixed(0)} min). Es normal.`,
                )}
          </p>
        </>
      ) : (
        <p className="warnbox">{t('Invalid date.', 'Fecha inválida.')}</p>
      )}
      <figure className="profile">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t(
            `One-way latency 2025–2030: minimum ${min.oneWayMin.toFixed(1)} min, maximum ${max.oneWayMin.toFixed(1)} min`,
            `Latencia un sentido 2025–2030: mínimo ${min.oneWayMin.toFixed(1)} min, máximo ${max.oneWayMin.toFixed(1)} min`,
          )}>
          <path d={line} fill="none" stroke="#38bdf8" strokeWidth={1.8} />
          {valid && t0 <= at.getTime() && at.getTime() <= t1 && <line x1={x(at.getTime())} x2={x(at.getTime())} y1={6} y2={H - 14} stroke="#ff7a3d" strokeWidth={1.5} />}
          <text x={6} y={H - 3} className="ax">2025</text>
          <text x={W - 6} y={H - 3} textAnchor="end" className="ax">2030</text>
          <text x={8} y={y(max.oneWayMin) + 10} className="ax">{max.oneWayMin.toFixed(0)} min</text>
          <text x={8} y={y(min.oneWayMin) - 3} className="ax">{min.oneWayMin.toFixed(0)} min</text>
        </svg>
        <figcaption className="muted">{t('One-way latency 2025–2030 (orange line = chosen date).', 'Latencia de un sentido 2025–2030 (línea naranja = fecha elegida).')}</figcaption>
      </figure>
      <DataBadge meta={LINK_META} />
    </section>
  );
}

/* ---------- Hazard reports ---------- */

export interface HazardForm {
  type: IncidentType;
  radiusM: number;
  note: string;
}

export function IncidentSection({ active, onToggle, form, setForm, incidents, onDelete, onSync, siteIncidentsApplied }: {
  active: boolean;
  onToggle: () => void;
  form: HazardForm;
  setForm: (f: HazardForm) => void;
  incidents: Incident[];
  onDelete: (id: string) => void;
  onSync: () => void;
  siteIncidentsApplied: number;
}) {
  const { t, l, lang } = useI18n();
  const pending = incidents.filter((i) => !i.syncedToEarth).length;
  return (
    <section>
      <h2>{t('Report hazard', 'Reportar peligro')}</h2>
      <label className="field">
        <span>{t('Type', 'Tipo')}</span>
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as IncidentType })}>
          {(Object.keys(INCIDENT_LABEL) as IncidentType[]).map((k) => <option key={k} value={k}>{l(INCIDENT_LABEL[k])}</option>)}
        </select>
      </label>
      <label className="field">
        <span>{t('Zone radius', 'Radio de la zona')}</span>
        <select value={form.radiusM} onChange={(e) => setForm({ ...form, radiusM: Number(e.target.value) })}>
          {[100, 200, 400, 800].map((r) => <option key={r} value={r}>{r} m</option>)}
        </select>
      </label>
      <label className="field">
        <span>{t('Note (optional)', 'Nota (opcional)')}</span>
        <input type="text" value={form.note} maxLength={120} onChange={(e) => setForm({ ...form, note: e.target.value })} className="textin" />
      </label>
      <button className={active ? 'ghost armed' : 'ghost'} aria-pressed={active} onClick={onToggle}>
        {active ? t('Click on the map to mark the hazard…', 'Hacé clic en el mapa para marcar el peligro…') : t('Report hazard on the map', 'Reportar peligro en el mapa')}
      </button>
      <p className="muted">{t(`${siteIncidentsApplied} hazard(s) at this site applied to route calculation.`, `${siteIncidentsApplied} peligro(s) de este sitio aplicados al cálculo de rutas.`)}</p>
      {incidents.length > 0 && (
        <>
          <ul className="plain-list">
            {incidents.map((i) => (
              <li key={i.id}>
                <span>
                  {l(INCIDENT_LABEL[i.type])} · {i.siteId === 'gale' ? 'Gale' : 'Jezero'} · {i.radiusM} m · {new Date(i.createdAt).toLocaleTimeString(lang)}
                  {' · '}{i.syncedToEarth ? t('synced (simulated)', 'sincronizado (simulado)') : t('pending to send', 'pendiente de enviar')}
                </span>
                <button className="mini" onClick={() => onDelete(i.id)} aria-label={t('Delete report', 'Eliminar reporte')}>×</button>
              </li>
            ))}
          </ul>
          <button className="ghost" disabled={pending === 0} onClick={onSync}>
            {t(`Simulate link: send ${pending} to Earth`, `Simular enlace: enviar ${pending} a la Tierra`)}
          </button>
        </>
      )}
      <DataBadge meta={INCIDENT_META} />
    </section>
  );
}
