import { useMemo, useState } from 'react';
import type { SiteId } from '../config/sites';
import { GUIDES, HEALTH_ITEMS, circadianOffsetHours, healthItem, healthMeta, missionPhase, radiationBudget, type EventGuide, type HealthItem } from '../crew/health';
import { PROBE_DATE, type DataMeta } from '../lib/dataMeta';
import { DataBadge } from './DataBadge';

const PRESETS = [1, 30, 90, 180, 500];

const CALC_META: DataMeta = {
  source: 'Cálculo del equipo con cifras de RAD (Hassler et al., 2014) y NASA NTRS',
  acquiredAt: 'Calculado para el sol elegido',
  retrievedAt: PROBE_DATE,
  tier: 1,
  confidence: 'estimated',
  shelfLife: 'slow',
  notes:
    'Superficie = 0,67 mSv/día × sol, en terreno abierto y solo en Gale (media de ago-2012 a jun-2013; varía con el ciclo solar). Tránsito = 2 × 180 días × 1,8 mSv/día. El límite de carrera de la NASA está pendiente de fuente, por eso no se compara.',
};

const PHASE_LABEL = { llegada: 'Llegada', inicio: 'Inicio', medio: 'Mitad', final: 'Final' } as const;

function Item({ item }: { item: HealthItem }) {
  return (
    <li className="health">
      <strong>{item.title_es}</strong>
      {item.pendingSource && <span className="tag">pendiente de fuente</span>}
      <p>{item.text_es}</p>
      {item.countermeasure_es && <p className="muted">Contramedida: {item.countermeasure_es}</p>}
      <DataBadge meta={healthMeta(item)} />
    </li>
  );
}

function Guide({ guide, rttMin, onSolar }: { guide: EventGuide; rttMin: number; onSolar: () => void }) {
  const [done, setDone] = useState<Set<number>>(new Set());
  return (
    <div className="guide" role="group" aria-label={guide.title_es}>
      <h3>{guide.title_es}</h3>
      <ol>
        {guide.steps.map((s, i) => {
          const item = s.itemId ? healthItem(s.itemId) : undefined;
          return (
            <li key={i}>
              <label>
                <input
                  type="checkbox"
                  checked={done.has(i)}
                  onChange={() =>
                    setDone((d) => {
                      const n = new Set(d);
                      if (n.has(i)) n.delete(i);
                      else n.add(i);
                      return n;
                    })
                  }
                />
                <span>
                  {s.text_es}
                  {guide.id === 'dust-inhalation' && s.itemId === 'medical-ai' && ` (ida y vuelta hoy: ${rttMin.toFixed(0)} min)`}
                  {item?.pendingSource && <span className="tag">pendiente de fuente</span>}
                  {!item && <span className="tag team">paso del equipo</span>}
                </span>
              </label>
            </li>
          );
        })}
      </ol>
      {guide.solar && <button className="ghost" onClick={onSolar}>Ver refugio y margen (Seguridad)</button>}
      <p className="muted">Concepto del equipo, no un protocolo oficial ni consejo médico.</p>
    </div>
  );
}

export function CrewSection({ siteId, rttMin, onSolar }: { siteId: SiteId; rttMin: number; onSolar: () => void }) {
  const [sol, setSol] = useState(30);
  const [includeTransit, setIncludeTransit] = useState(false);
  const [guideId, setGuideId] = useState<string | null>(null);
  const budget = useMemo(() => radiationBudget(sol, siteId), [sol, siteId]);
  const items = HEALTH_ITEMS.filter((i) => includeTransit || i.applies_to !== 'transit');
  const categories = [...new Set(items.map((i) => i.category))];
  const guide = GUIDES.find((g) => g.id === guideId);

  return (
    <>
      <section>
        <h2>Crew Status</h2>
        <label className="field">
          <span>Sol de la misión</span>
          <input type="range" min={1} max={500} step={1} value={sol} onChange={(e) => setSol(Number(e.target.value))} aria-label="Sol de la misión" />
          <output>sol {sol} · {PHASE_LABEL[missionPhase(sol, 30)]} (estancia de referencia: 30 sol)</output>
        </label>
        <div className="presets" role="group" aria-label="Sol predefinido">
          {PRESETS.map((p) => (
            <button key={p} className="mini wide" aria-pressed={sol === p} onClick={() => setSol(p)}>{p}</button>
          ))}
        </div>
        <dl className="probe">
          <dt>Desfase de reloj 24 h</dt>
          <dd>{circadianOffsetHours(sol).toFixed(1)} h (sol = 24 h 39 min 35 s)</dd>
          <dt>Radiación en superficie</dt>
          <dd>{budget.surfaceMsv === null ? 'sin medición RAD en este sitio' : `≈ ${budget.surfaceMsv.toFixed(1)} mSv acumulados (estimado)`}</dd>
          <dt>Radiación en tránsito</dt>
          <dd>≈ {budget.transitMsv.toFixed(0)} mSv ida y vuelta (estimado)</dd>
          <dt>Límite de carrera NASA</dt>
          <dd>pendiente de fuente</dd>
        </dl>
        <DataBadge meta={CALC_META} />
      </section>

      <section>
        <h2>Simular evento</h2>
        <div className="guide-pick" role="group" aria-label="Evento a simular">
          {GUIDES.map((g) => (
            <button key={g.id} className="ghost" aria-pressed={guideId === g.id} onClick={() => setGuideId(guideId === g.id ? null : g.id)}>
              {g.title_es}
            </button>
          ))}
        </div>
        {guide && <Guide key={guide.id} guide={guide} rttMin={rttMin} onSolar={onSolar} />}
      </section>

      <section>
        <h2>Riesgos y contramedidas</h2>
        <label className="check">
          <input type="checkbox" checked={includeTransit} onChange={(e) => setIncludeTransit(e.target.checked)} />
          Incluir riesgos del tránsito
        </label>
        {categories.map((c) => (
          <div key={c}>
            <h3>{c}</h3>
            <ul className="plain-list stack">
              {items.filter((i) => i.category === c).map((i) => <Item key={i.id} item={i} />)}
            </ul>
          </div>
        ))}
      </section>
    </>
  );
}
