import { useMemo, useState } from 'react';
import { PROBE_DATE, type DataMeta } from '../lib/dataMeta';
import { linkAt, latencySeries, waitState } from '../lib/ephemeris';
import { INCIDENT_LABEL, type Incident, type IncidentType } from '../routing/incidents';
import { STATUS_TEXT, type Assessment, type SpaceWeatherEvent } from '../safety/protocol';
import type { Shelter } from '../safety/shelters';
import { RAD_GALE_MSV_PER_DAY } from '../terrain/shielding';
import type { SiteId } from '../config/sites';
import { DataBadge } from './DataBadge';

export const SHIELD_META: DataMeta = {
  source: 'Blindaje geométrico del terreno ilustrativo (sky-view factor), cálculo del equipo',
  acquiredAt: 'Calculado en el navegador',
  retrievedAt: PROBE_DATE,
  tier: 1,
  confidence: 'estimated',
  shelfLife: 'slow',
  notes: 'Modelo simplificado: dosis relativa = máx(0,25; cielo visible). No es transporte de radiación y el terreno de base es ilustrativo.',
};

export const SHELTER_META: DataMeta = {
  source: 'Sitios candidatos calculados del blindaje estimado (no relevados)',
  acquiredAt: 'Calculado en el navegador',
  retrievedAt: PROBE_DATE,
  tier: 1,
  confidence: 'estimated',
  shelfLife: 'slow',
  notes: 'Mejor blindaje geométrico (sky-view factor) entre celdas transitables, separadas ≥ 1,2 km. Modelo simplificado, no transporte de radiación.',
};

export const EVENT_META: DataMeta = {
  source: 'Muestra ilustrativa con el esquema de NASA DONKI (WSA-ENLIL, impacto en Marte)',
  sourceUrl: 'https://kauai.ccmc.gsfc.nasa.gov/DONKI/',
  acquiredAt: 'Valores inventados para la demo',
  retrievedAt: PROBE_DATE,
  tier: 3,
  confidence: 'estimated',
  shelfLife: 'fast',
  notes: 'DONKI es experimental y no es el pronóstico oficial (NOAA SWPC). Un evento solar no implica impacto en Marte: solo se usan simulaciones que lo incluyen. El multiplicador de dosis es un supuesto del equipo.',
};

export const LINK_META: DataMeta = {
  source: 'astronomy-engine (efemérides offline), validado contra JPL Horizons',
  sourceUrl: 'https://ssd.jpl.nasa.gov/horizons/',
  acquiredAt: 'Calculado para la fecha elegida',
  retrievedAt: PROBE_DATE,
  tier: 1,
  confidence: 'high',
  shelfLife: 'slow',
  notes: 'Latencia = distancia geométrica / c. Coincide con Horizons dentro de 0,1 % en las fechas probadas.',
};

export const INCIDENT_META: DataMeta = {
  source: 'Observación local del usuario (cola local, sin sincronizar con la Tierra)',
  acquiredAt: 'Hora del reporte',
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
  return (
    <section>
      <h2>Zonas de refugio · estimadas</h2>
      {shelters.length === 0 ? (
        <p className="warnbox">No hay terreno blindado y transitable en el AOI.</p>
      ) : (
        <ul className="plain-list">
          {shelters.map((s) => (
            <li key={s.id}>
              <strong>{s.id}</strong> · dosis relativa {s.doseRelative.toFixed(2)}
              {siteId === 'gale' && ` ≈ ${(s.doseRelative * RAD_GALE_MSV_PER_DAY).toFixed(1)} mSv/día`}
            </li>
          ))}
        </ul>
      )}
      <p className="muted">
        Línea base RAD ({RAD_GALE_MSV_PER_DAY} mSv/día) solo en Gale: media de ago-2012 a jun-2013 (Hassler et al., 2014), no tiempo real.
        {siteId === 'jezero' && ' En Jezero no hay medición RAD: solo se muestra la dosis relativa.'}
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
  return (
    <section>
      <h2>Alertas de clima espacial</h2>
      <p className="warnbox">MUESTRA ILUSTRATIVA con el esquema de DONKI · no es un pronóstico real</p>
      <ul className="plain-list">
        {events.map((e) => (
          <li key={e.simulationID}>
            <button className="ghost" onClick={() => onTrigger(e)} aria-pressed={sim?.event.simulationID === e.simulationID}>
              Simular: {e.title_es} · llegada en {fmtClock(e.etaMin)}
            </button>
          </li>
        ))}
      </ul>
      <label className="field">
        <span>Velocidad de la demo</span>
        <select value={speed} onChange={(e) => onSpeed(Number(e.target.value))}>
          <option value={1}>Tiempo real ×1</option>
          <option value={30}>×30</option>
          <option value={120}>×120</option>
        </select>
      </label>
      {sim && <button className="ghost" onClick={onDismiss}>Descartar alerta</button>}
      <DataBadge meta={EVENT_META} />
    </section>
  );
}

const IMPACT = (e: SpaceWeatherEvent) =>
  e.impact.isGlancingBlow ? 'impacto rasante' : e.impact.isMinorImpact ? 'impacto menor' : 'impacto directo';

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
  const e = sim.event;
  const left = e.etaMin - sim.elapsedMin;
  const t = STATUS_TEXT[assessment.status];
  const arrived = left <= 0;
  const shape = { ok: '●', tight: '▲', late: '■', 'no-shelter': '■' }[assessment.status];
  return (
    <section className={`protocol ${assessment.status}`} aria-live="polite">
      <h2>Tarjeta de protocolo</h2>
      <p className="code">{shape} {t.code}</p>
      <dl className="probe">
        <dt>1 · Alerta</dt>
        <dd>{e.title_es} ({IMPACT(e)}, CME {e.cme.speed} km/s)</dd>
        <dt>Llegada</dt>
        <dd>{arrived ? 'EVENTO EN CURSO' : `en ${fmtClock(left)}`}</dd>
        <dt>2 · Riesgo</dt>
        <dd>
          Dosis ×{e.doseMultiplier} sobre la base (supuesto).{' '}
          {siteId === 'gale'
            ? `Aquí ≈ ${(doseHere * RAD_GALE_MSV_PER_DAY * e.doseMultiplier).toFixed(1)} mSv/día (orden de magnitud, estimado).`
            : `Dosis relativa aquí ${doseHere.toFixed(2)}.`}
        </dd>
        <dt>3 · Acción</dt>
        <dd>{t.action_es}</dd>
        {shelter && walkMin !== null && (
          <>
            <dt>Refugio</dt>
            <dd>
              {shelter.id} a {fmtClock(walkMin)} de marcha (≈ {Math.round(walkDistM ?? 0)} m) desde {fromLabel}
              {assessment.marginMin !== null && ` · margen ${assessment.marginMin >= 0 ? '+' : ''}${Math.round(assessment.marginMin)} min`}
            </dd>
          </>
        )}
      </dl>
      <p className="muted">Protocolo ilustrativo del equipo (concepto). No es un procedimiento oficial de NASA ni consejo médico.</p>
      <DataBadge meta={EVENT_META} />
    </section>
  );
}

/* ---------- Earth–Mars link ---------- */

const todayIso = () => new Date().toISOString().slice(0, 10);

export function LinkSection() {
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
      <h2>Enlace Tierra–Marte</h2>
      <label className="field">
        <span>Fecha (UTC)</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="datein" />
      </label>
      {state ? (
        <>
          <dl className="probe">
            <dt>Distancia</dt><dd>{state.distanceMkm.toFixed(1)} M km ({state.distanceAu.toFixed(3)} UA)</dd>
            <dt>Latencia un sentido</dt><dd>{state.oneWayMin.toFixed(1)} min</dd>
            <dt>Ida y vuelta</dt><dd>{state.roundTripMin.toFixed(1)} min</dd>
          </dl>
          <label className="field">
            <span>Tiempo sin respuesta de la Tierra</span>
            <input type="range" min={0} max={60} step={1} value={waited} onChange={(e) => setWaited(Number(e.target.value))} />
            <output>{waited} min</output>
          </label>
          <p className={waitState(waited, state.roundTripMin) === 'overdue' ? 'warnbox' : 'okbox'} role="status">
            {waitState(waited, state.roundTripMin) === 'overdue'
              ? `SIN RESPUESTA ≥ ${state.roundTripMin.toFixed(0)} min: más que la ida y vuelta esperada. Seguir con el plan autónomo y reintentar.`
              : `Esperando: aún dentro de la ida y vuelta (${state.roundTripMin.toFixed(0)} min). Es normal.`}
          </p>
        </>
      ) : (
        <p className="warnbox">Fecha inválida.</p>
      )}
      <figure className="profile">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Latencia un sentido 2025–2030: mínimo ${min.oneWayMin.toFixed(1)} min, máximo ${max.oneWayMin.toFixed(1)} min`}>
          <path d={line} fill="none" stroke="#38bdf8" strokeWidth={1.8} />
          {valid && t0 <= at.getTime() && at.getTime() <= t1 && <line x1={x(at.getTime())} x2={x(at.getTime())} y1={6} y2={H - 14} stroke="#ff7a3d" strokeWidth={1.5} />}
          <text x={6} y={H - 3} className="ax">2025</text>
          <text x={W - 6} y={H - 3} textAnchor="end" className="ax">2030</text>
          <text x={8} y={y(max.oneWayMin) + 10} className="ax">{max.oneWayMin.toFixed(0)} min</text>
          <text x={8} y={y(min.oneWayMin) - 3} className="ax">{min.oneWayMin.toFixed(0)} min</text>
        </svg>
        <figcaption className="muted">Latencia de un sentido 2025–2030 (línea naranja = fecha elegida).</figcaption>
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
  const pending = incidents.filter((i) => !i.syncedToEarth).length;
  return (
    <section>
      <h2>Reportar peligro</h2>
      <label className="field">
        <span>Tipo</span>
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as IncidentType })}>
          {(Object.keys(INCIDENT_LABEL) as IncidentType[]).map((k) => <option key={k} value={k}>{INCIDENT_LABEL[k]}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Radio de la zona</span>
        <select value={form.radiusM} onChange={(e) => setForm({ ...form, radiusM: Number(e.target.value) })}>
          {[100, 200, 400, 800].map((r) => <option key={r} value={r}>{r} m</option>)}
        </select>
      </label>
      <label className="field">
        <span>Nota (opcional)</span>
        <input type="text" value={form.note} maxLength={120} onChange={(e) => setForm({ ...form, note: e.target.value })} className="textin" />
      </label>
      <button className={active ? 'ghost armed' : 'ghost'} aria-pressed={active} onClick={onToggle}>
        {active ? 'Hacé clic en el mapa para marcar el peligro…' : 'Reportar peligro en el mapa'}
      </button>
      <p className="muted">{siteIncidentsApplied} peligro(s) de este sitio aplicados al cálculo de rutas.</p>
      {incidents.length > 0 && (
        <>
          <ul className="plain-list">
            {incidents.map((i) => (
              <li key={i.id}>
                <span>
                  {INCIDENT_LABEL[i.type]} · {i.siteId === 'gale' ? 'Gale' : 'Jezero'} · {i.radiusM} m · {new Date(i.createdAt).toLocaleTimeString()}
                  {' · '}{i.syncedToEarth ? 'sincronizado (simulado)' : 'pendiente de enviar'}
                </span>
                <button className="mini" onClick={() => onDelete(i.id)} aria-label="Eliminar reporte">×</button>
              </li>
            ))}
          </ul>
          <button className="ghost" disabled={pending === 0} onClick={onSync}>
            Simular enlace: enviar {pending} a la Tierra
          </button>
        </>
      )}
      <DataBadge meta={INCIDENT_META} />
    </section>
  );
}
