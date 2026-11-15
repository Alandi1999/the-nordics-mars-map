import { useMemo, useState } from 'react';
import type { SiteId } from '../config/sites';
import { GUIDES, HEALTH_ITEMS, circadianOffsetHours, healthItem, healthMeta, missionPhase, radiationBudget, type EventGuide, type HealthItem } from '../crew/health';
import { useI18n, type Bi } from '../i18n';
import { PROBE_DATE, type DataMeta } from '../lib/dataMeta';
import { DataBadge } from './DataBadge';

const PRESETS = [1, 30, 90, 180, 500];

const CALC_META: DataMeta = {
  source: { en: 'Team calculation using RAD figures (Hassler et al., 2014) and NASA NTRS', es: 'Cálculo del equipo con cifras de RAD (Hassler et al., 2014) y NASA NTRS' },
  acquiredAt: { en: 'Calculated for the selected sol', es: 'Calculado para el sol elegido' },
  retrievedAt: PROBE_DATE,
  tier: 1,
  confidence: 'estimated',
  shelfLife: 'slow',
  notes: {
    en: 'Surface = 0.67 mSv/day × sol, in open terrain and at Gale only (mean from Aug 2012 to Jun 2013; varies with the solar cycle). Transit = 2 × 180 days × 1.8 mSv/day. NASA\'s career limit is pending a source, so it is not compared.',
    es: 'Superficie = 0,67 mSv/día × sol, en terreno abierto y solo en Gale (media de ago-2012 a jun-2013; varía con el ciclo solar). Tránsito = 2 × 180 días × 1,8 mSv/día. El límite de carrera de la NASA está pendiente de fuente, por eso no se compara.',
  },
};

const PHASE_LABEL = {
  llegada: { en: 'Arrival', es: 'Llegada' },
  inicio: { en: 'Start', es: 'Inicio' },
  medio: { en: 'Middle', es: 'Mitad' },
  final: { en: 'End', es: 'Final' },
} as const;

function Item({ item }: { item: HealthItem }) {
  const { t, l } = useI18n();
  return (
    <li className="health">
      <strong>{l(item.title)}</strong>
      {item.pendingSource && <span className="tag">{t('pending a source', 'pendiente de fuente')}</span>}
      <p>{l(item.text)}</p>
      {item.countermeasure && <p className="muted">{t('Countermeasure', 'Contramedida')}: {l(item.countermeasure)}</p>}
      <DataBadge meta={healthMeta(item)} />
    </li>
  );
}

function Guide({ guide, rttMin, onSolar }: { guide: EventGuide; rttMin: number; onSolar: () => void }) {
  const { t, l } = useI18n();
  const [done, setDone] = useState<Set<number>>(new Set());
  return (
    <div className="guide" role="group" aria-label={l(guide.title)}>
      <h3>{l(guide.title)}</h3>
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
                  {l(s.text)}
                  {guide.id === 'dust-inhalation' && s.itemId === 'medical-ai' && ` (${t('round trip today', 'ida y vuelta hoy')}: ${rttMin.toFixed(0)} min)`}
                  {item?.pendingSource && <span className="tag">{t('pending a source', 'pendiente de fuente')}</span>}
                  {!item && <span className="tag team">{t('team step', 'paso del equipo')}</span>}
                </span>
              </label>
            </li>
          );
        })}
      </ol>
      {guide.solar && <button className="ghost" onClick={onSolar}>{t('See shelter and margin (Safety)', 'Ver refugio y margen (Seguridad)')}</button>}
      <p className="muted">{t('Team concept, not an official protocol or medical advice.', 'Concepto del equipo, no un protocolo oficial ni consejo médico.')}</p>
    </div>
  );
}

export function CrewSection({ siteId, rttMin, onSolar }: { siteId: SiteId; rttMin: number; onSolar: () => void }) {
  const { t, l } = useI18n();
  const [sol, setSol] = useState(30);
  const [includeTransit, setIncludeTransit] = useState(false);
  const [guideId, setGuideId] = useState<string | null>(null);
  const budget = useMemo(() => radiationBudget(sol, siteId), [sol, siteId]);
  const items = HEALTH_ITEMS.filter((i) => includeTransit || i.applies_to !== 'transit');
  const categories: Bi[] = [...new Map(items.map((i) => [i.category.en, i.category])).values()];
  const guide = GUIDES.find((g) => g.id === guideId);

  return (
    <>
      <section>
        <h2>Crew Status</h2>
        <label className="field">
          <span>{t('Mission sol', 'Sol de la misión')}</span>
          <input type="range" min={1} max={500} step={1} value={sol} onChange={(e) => setSol(Number(e.target.value))} aria-label={t('Mission sol', 'Sol de la misión')} />
          <output>sol {sol} · {l(PHASE_LABEL[missionPhase(sol, 30)])} ({t('reference stay: 30 sols', 'estancia de referencia: 30 sol')})</output>
        </label>
        <div className="presets" role="group" aria-label={t('Preset sol', 'Sol predefinido')}>
          {PRESETS.map((p) => (
            <button key={p} className="mini wide" aria-pressed={sol === p} onClick={() => setSol(p)}>{p}</button>
          ))}
        </div>
        <dl className="probe">
          <dt>{t('24 h clock drift', 'Desfase de reloj 24 h')}</dt>
          <dd>{circadianOffsetHours(sol).toFixed(1)} h ({t('sol = 24 h 39 min 35 s', 'sol = 24 h 39 min 35 s')})</dd>
          <dt>{t('Surface radiation', 'Radiación en superficie')}</dt>
          <dd>{budget.surfaceMsv === null ? t('no RAD measurement at this site', 'sin medición RAD en este sitio') : `≈ ${budget.surfaceMsv.toFixed(1)} mSv ${t('accumulated (estimated)', 'acumulados (estimado)')}`}</dd>
          <dt>{t('Transit radiation', 'Radiación en tránsito')}</dt>
          <dd>≈ {budget.transitMsv.toFixed(0)} mSv {t('round trip (estimated)', 'ida y vuelta (estimado)')}</dd>
          <dt>{t('NASA career limit', 'Límite de carrera NASA')}</dt>
          <dd>{t('pending a source', 'pendiente de fuente')}</dd>
        </dl>
        <DataBadge meta={CALC_META} />
      </section>

      <section>
        <h2>{t('Simulate event', 'Simular evento')}</h2>
        <div className="guide-pick" role="group" aria-label={t('Event to simulate', 'Evento a simular')}>
          {GUIDES.map((g) => (
            <button key={g.id} className="ghost" aria-pressed={guideId === g.id} onClick={() => setGuideId(guideId === g.id ? null : g.id)}>
              {l(g.title)}
            </button>
          ))}
        </div>
        {guide && <Guide key={guide.id} guide={guide} rttMin={rttMin} onSolar={onSolar} />}
      </section>

      <section>
        <h2>{t('Risks and countermeasures', 'Riesgos y contramedidas')}</h2>
        <label className="check">
          <input type="checkbox" checked={includeTransit} onChange={(e) => setIncludeTransit(e.target.checked)} />
          {t('Include transit risks', 'Incluir riesgos del tránsito')}
        </label>
        {categories.map((c) => (
          <div key={c.en}>
            <h3>{l(c)}</h3>
            <ul className="plain-list stack">
              {items.filter((i) => i.category.en === c.en).map((i) => <Item key={i.id} item={i} />)}
            </ul>
          </div>
        ))}
      </section>
    </>
  );
}
