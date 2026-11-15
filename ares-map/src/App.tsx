import { useEffect, useMemo, useRef, useState } from 'react';
import { MapView, type LayerState, type OverlayImage } from './map/MapView';
import { LAYER_DEFS } from './map/layers';
import { SITES, type SiteId } from './config/sites';
import { buildPois, ROVER } from './data/pois';
import { bearingDeg, distanceM, moveBy } from './lib/geo';
import { linkAt } from './lib/ephemeris';
import { prefetchTiles, tileUrlsFor, type PrefetchResult } from './lib/offline';
import { CrewSection } from './ui/CrewPanel';
import { PoiSection } from './ui/PoiPanel';
import { GloveSection, type GloveView } from './ui/GlovePanel';
import { WeatherSection } from './ui/WeatherPanel';
import { generateWeather } from './lib/weather';
import { DEFAULT_MOBILITY, type MobilityConfig } from './config/mobility';
import { DataBadge } from './ui/DataBadge';
import { metersPerDegreeLon } from './lib/mars';
import { aStar } from './routing/astar';
import { buildCost } from './routing/cost';
import { circleRing, applyIncidents, loadIncidents, saveIncidents, type Incident } from './routing/incidents';
import { examplePair, nearestPassable, PROFILE_INFO, planRoutes, routeStats, travelWeights, type RouteProfile } from './routing/plan';
import { assess, type SpaceWeatherEvent } from './safety/protocol';
import { pickShelters } from './safety/shelters';
import { derive } from './terrain/derive';
import { cellAt, cellCenter, generateTerrain } from './terrain/grid';
import { probeAt, type Probe } from './terrain/probe';
import { renderOverlay, type OverlayId } from './terrain/render';
import { doseRelative, skyViewFactor } from './terrain/shielding';
import { MobilitySection, OVERLAY_IDS, ProbeSection, TerrainSection, type OverlayState } from './ui/TerrainPanels';
import { RouteSection, type PickMode } from './ui/RoutePanel';
import {
  EventsSection, IncidentSection, LinkSection, ProtocolCard, SheltersSection, SHIELD_META,
  type HazardForm, type Sim,
} from './ui/SafetyPanels';
import sample from './data/spaceweather.sample.json';
import { useI18n, type Bi } from './i18n';

const EVENTS = sample.events as SpaceWeatherEvent[];

type Tab = 'map' | 'poi' | 'terrain' | 'weather' | 'route' | 'safety' | 'crew' | 'link' | 'glove';
const TABS: { id: Tab; label: Bi }[] = [
  { id: 'map', label: { en: 'Map', es: 'Mapa' } },
  { id: 'poi', label: { en: 'Points', es: 'Puntos' } },
  { id: 'terrain', label: { en: 'Terrain', es: 'Terreno' } },
  { id: 'weather', label: { en: 'Weather', es: 'Clima' } },
  { id: 'route', label: { en: 'Route', es: 'Ruta' } },
  { id: 'safety', label: { en: 'Safety', es: 'Seguridad' } },
  { id: 'crew', label: { en: 'Crew', es: 'Equipo' } },
  { id: 'link', label: { en: 'Link', es: 'Enlace' } },
  { id: 'glove', label: { en: 'Glove', es: 'Guante' } },
];

/** Messages are stored as codes (not text) so they follow the language when it changes. */
type RouteMsg = null | { k: 'outside' } | { k: 'forbidden' } | { k: 'nopair' };
type PoiMsg = null | { k: 'outside' } | { k: 'forbidden' };

function niceLength(maxMeters: number): number {
  const pow = 10 ** Math.floor(Math.log10(maxMeters));
  for (const k of [5, 2, 1]) if (k * pow <= maxMeters) return k * pow;
  return pow;
}

const fmtDist = (m: number) => (m >= 1000 ? `${m / 1000} km` : `${m} m`);

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

function useIsMobile() {
  const query = '(max-width: 760px)';
  const [m, setM] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return m;
}

export default function App() {
  const { lang, setLang, t, l } = useI18n();
  const [tab, setTab] = useState<Tab>('map');
  const [collapsed, setCollapsed] = useState(false);
  const isMobile = useIsMobile();
  const [siteId, setSiteId] = useState<SiteId>('gale');
  const site = SITES[siteId];
  const online = useOnline();
  const [layers, setLayers] = useState<Record<string, LayerState>>(() =>
    Object.fromEntries(LAYER_DEFS.map((d) => [d.id, { visible: d.defaultVisible, opacity: d.defaultOpacity }])),
  );

  // --- terrain, shielding, cost
  const grid = useMemo(() => generateTerrain(site), [site]);
  const derived = useMemo(() => derive(grid), [grid]);
  const dose = useMemo(() => doseRelative(skyViewFactor(grid)), [grid]);
  const [mobility, setMobility] = useState<MobilityConfig>(DEFAULT_MOBILITY);
  const baseCost = useMemo(() => buildCost(derived, mobility), [derived, mobility]);
  const [incidents, setIncidents] = useState<Incident[]>(loadIncidents);
  useEffect(() => saveIncidents(incidents), [incidents]);
  const siteIncidents = useMemo(() => incidents.filter((i) => i.siteId === siteId), [incidents, siteId]);
  const cost = useMemo(() => applyIncidents(grid, baseCost, incidents), [grid, baseCost, incidents]);
  const shelters = useMemo(() => pickShelters(grid, dose, cost), [grid, dose, cost]);

  // --- POIs and real traverse
  const pois = useMemo(() => buildPois(siteId, shelters), [siteId, shelters]);
  const traverseLine = useMemo(() => ROVER[siteId].traverse.map((p) => [p[0], p[1]] as [number, number]), [siteId]);
  const [showTraverse, setShowTraverse] = useState(true);
  const [showPois, setShowPois] = useState(true);
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ coord: [number, number]; nonce: number } | null>(null);
  const [poiMsg, setPoiMsg] = useState<PoiMsg>(null);
  const selectedPoi = pois.find((p) => p.id === selectedPoiId) ?? null;
  const poiPins = useMemo(
    () => (showPois ? pois.filter((p) => p.kind !== 'shelter').map((p) => ({ id: p.id, coord: p.lonlat, kind: p.kind })) : []),
    [showPois, pois],
  );

  // --- mocked surface weather (spec F3)
  const weather = useMemo(() => generateWeather(siteId), [siteId]);
  const showThemis = (kind: 'day' | 'night') => {
    setLayers((s) => ({
      ...s,
      'themis-day': { ...s['themis-day'], visible: kind === 'day' },
      'themis-night': { ...s['themis-night'], visible: kind === 'night' },
    }));
    setTab('map');
    if (isMobile) setCollapsed(true); // on phones, hide the panel so the thermal imagery is visible
  };

  // --- offline preparation
  const [offline, setOffline] = useState<{ running: boolean; result: PrefetchResult | null; error: string | null }>({ running: false, result: null, error: null });
  const swActive = 'serviceWorker' in navigator && !!navigator.serviceWorker.controller;
  const prepareOffline = async () => {
    setOffline({ running: true, result: null, error: null });
    try {
      const urls = tileUrlsFor(site);
      const result = await prefetchTiles(urls, (r) => setOffline({ running: true, result: r, error: null }));
      setOffline({ running: false, result, error: null });
    } catch (e) {
      setOffline({ running: false, result: null, error: e instanceof Error ? e.message : 'Error desconocido' });
    }
  };

  // --- overlays
  const [ovState, setOvState] = useState<Record<OverlayId, OverlayState>>({
    hillshade: { visible: true, opacity: 0.6 },
    slope: { visible: false, opacity: 0.7 },
    roughness: { visible: false, opacity: 0.7 },
    cost: { visible: true, opacity: 0.7 },
    contours: { visible: false, opacity: 0.9 },
    shielding: { visible: false, opacity: 0.8 },
  });
  const staticUrls = useMemo(
    () => ({
      hillshade: renderOverlay('hillshade', grid, derived, baseCost),
      slope: renderOverlay('slope', grid, derived, baseCost),
      roughness: renderOverlay('roughness', grid, derived, baseCost),
      contours: renderOverlay('contours', grid, derived, baseCost),
      shielding: renderOverlay('shielding', grid, derived, baseCost, dose),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [grid, derived, dose],
  );
  const costUrl = useMemo(() => renderOverlay('cost', grid, derived, cost), [grid, derived, cost]);
  const overlays: OverlayImage[] = OVERLAY_IDS.map((id) => ({
    id,
    url: id === 'cost' ? costUrl : staticUrls[id],
    extent: grid.extent,
    ...ovState[id],
  }));

  // --- probe / picking
  const [mode, setMode] = useState<PickMode>('probe');
  const [clicked, setClicked] = useState<[number, number] | null>(null);
  const probe: Probe | null | undefined = useMemo(
    () => (clicked ? probeAt(grid, derived, cost, dose, clicked[0], clicked[1]) : undefined),
    [clicked, grid, derived, cost, dose],
  );

  // --- routes
  const [startCell, setStartCell] = useState<number | null>(null);
  const [endCell, setEndCell] = useState<number | null>(null);
  const [selected, setSelected] = useState<RouteProfile>('safe');
  const [routeMsg, setRouteMsg] = useState<RouteMsg>(null);
  const endpointBlocked =
    (startCell !== null && cost.cls[startCell] === 3) || (endCell !== null && cost.cls[endCell] === 3);
  const routes = useMemo(
    () =>
      startCell !== null && endCell !== null && !endpointBlocked
        ? planRoutes(grid, derived, cost, mobility, startCell, endCell, dose, shelters)
        : [],
    [grid, derived, cost, mobility, startCell, endCell, endpointBlocked, dose, shelters],
  );
  const cellLL = (i: number | null): [number, number] | null =>
    i === null ? null : cellCenter(grid, Math.floor(i / grid.size), i % grid.size);

  // --- hazard reports
  const [hazardForm, setHazardForm] = useState<HazardForm>({ type: 'unstable_ground', radiusM: 200, note: '' });

  // --- space weather simulation
  const [sim, setSim] = useState<Sim | null>(null);
  const [speed, setSpeed] = useState(30);
  useEffect(() => {
    if (!sim) return;
    const id = window.setInterval(() => {
      setSim((s) => (s ? { ...s, elapsedMin: s.elapsedMin + (0.25 * speed) / 60 } : s));
    }, 250);
    return () => window.clearInterval(id);
  }, [sim === null, speed]); // eslint-disable-line react-hooks/exhaustive-deps

  const position = useMemo(
    () => startCell ?? nearestPassable(travelWeights(cost), grid.size, grid.size >> 1, grid.size >> 1),
    [startCell, cost, grid.size],
  );
  const positionLabel = startCell !== null ? t('your position (A)', 'tu posición (A)') : t('the AOI center', 'el centro del AOI');
  const shelterPlan = useMemo(() => {
    if (!sim || position === null || shelters.length === 0) return null;
    const n = grid.size;
    const pr = Math.floor(position / n);
    const pc = position % n;
    const w = travelWeights(cost);
    const nearest = [...shelters]
      .sort((a, b) => Math.hypot(Math.floor(a.cell / n) - pr, (a.cell % n) - pc) - Math.hypot(Math.floor(b.cell / n) - pr, (b.cell % n) - pc))
      .slice(0, 3);
    let best: { shelter: (typeof shelters)[number]; cells: number[]; minutes: number; distM: number } | null = null;
    for (const sh of nearest) {
      const cells = aStar(w, n, grid.cellM, position, sh.cell);
      if (!cells) continue;
      const { stats } = routeStats(cells, grid, derived, cost, mobility, dose, shelters);
      if (!best || stats.timeMin < best.minutes) best = { shelter: sh, cells, minutes: stats.timeMin, distM: stats.distanceM };
    }
    return best;
    // Recomputed when the event is triggered or the situation changes, not on every countdown tick.
  }, [sim?.event.simulationID, position, cost, shelters, grid, derived, mobility, dose]); // eslint-disable-line react-hooks/exhaustive-deps
  const assessment = sim ? assess(sim.event.etaMin - sim.elapsedMin, shelterPlan?.minutes ?? null) : null;

  // On phones the panel hides while the user picks a point on the map, and returns afterwards.
  const prevMode = useRef<PickMode>('probe');
  useEffect(() => {
    if (isMobile && mode !== 'probe') setCollapsed(true);
    if (mode === 'probe' && prevMode.current !== 'probe') setCollapsed(false);
    prevMode.current = mode;
  }, [mode, isMobile]);

  // --- site reset
  useEffect(() => {
    setClicked(null);
    setStartCell(null);
    setEndCell(null);
    setMode('probe');
    setRouteMsg(null);
    setSim(null);
    setSelectedPoiId(null);
    setPoiMsg(null);
  }, [siteId]);

  const handleClick = (ll: [number, number], poiId?: string) => {
    if (poiId && mode === 'probe') {
      setSelectedPoiId(poiId);
      setPoiMsg(null);
      setTab('poi');
      setCollapsed(false);
      return;
    }
    if (mode === 'probe') return setClicked(ll);
    const cell = cellAt(grid, ll[0], ll[1]);
    if (!cell) return setRouteMsg({ k: 'outside' });
    if (mode === 'hazard') {
      const inc: Incident = {
        id: `inc-${Date.now().toString(36)}`,
        siteId,
        createdAt: new Date().toISOString(),
        lonlat: ll,
        radiusM: hazardForm.radiusM,
        type: hazardForm.type,
        note: hazardForm.note || undefined,
        tier: 2,
        syncedToEarth: false,
      };
      setIncidents((list) => [...list, inc]);
      setMode('probe');
      return;
    }
    const i = cell.r * grid.size + cell.c;
    if (cost.cls[i] === 3) return setRouteMsg({ k: 'forbidden' });
    setRouteMsg(null);
    if (mode === 'start') {
      setStartCell(i);
      setMode(endCell === null ? 'end' : 'probe');
    } else {
      setEndCell(i);
      setMode('probe');
    }
  };
  const routeText = (m: NonNullable<RouteMsg>) =>
    m.k === 'outside'
      ? t('Outside the AOI: no terrain has been computed there.', 'Fuera del AOI: no hay terreno calculado ahí.')
      : m.k === 'forbidden'
        ? t(
            `Forbidden point (slope > ${mobility.slopeNoGoDeg}° or reported hazard). Pick another one.`,
            `Punto prohibido (pendiente > ${mobility.slopeNoGoDeg}° o peligro reportado). Elegí otro.`,
          )
        : t('No connected pair of points was found.', 'No se encontró un par de puntos conectado.');
  const routeMessage = routeMsg
    ? routeText(routeMsg)
    : endpointBlocked
      ? t(
          'The start or the destination is now in a forbidden zone (thresholds or reported hazard).',
          'Inicio o destino quedó en zona prohibida (umbrales o peligro reportado).',
        )
      : null;
  const poiMessage = poiMsg
    ? poiMsg.k === 'outside'
      ? t(
          'That point is outside the 10 km AOI: there is no computed terrain to route it.',
          'Ese punto está fuera del AOI de 10 km: no hay terreno calculado para rutearlo.',
        )
      : t('That point falls in a forbidden zone of the illustrative terrain.', 'Ese punto cae en zona prohibida del terreno ilustrativo.')
    : null;
  const loadExample = () => {
    const pair = examplePair(grid, cost);
    if (!pair) return setRouteMsg({ k: 'nopair' });
    setRouteMsg(null);
    setStartCell(pair.start);
    setEndCell(pair.end);
    setMode('probe');
  };
  const clearRoute = () => {
    setStartCell(null);
    setEndCell(null);
    setRouteMsg(null);
    setMode('probe');
  };

  const routeLines = [
    ...routes.map((r) => ({
      id: r.profile,
      color: PROFILE_INFO[r.profile].color,
      coords: r.coords,
      selected: r.profile === selected,
    })),
    ...(shelterPlan
      ? [{
          id: 'to-shelter',
          color: '#f8fafc',
          coords: shelterPlan.cells.map((c) => cellCenter(grid, Math.floor(c / grid.size), c % grid.size)),
          selected: true,
          dashed: true,
        }]
      : []),
  ];
  const hazardRings = siteIncidents.map((i) => circleRing(i.lonlat[0], i.lonlat[1], i.radiusM));

  const applyPoiAs = (poi: { lonlat: [number, number] }, as: 'start' | 'end') => {
    const cell = cellAt(grid, poi.lonlat[0], poi.lonlat[1]);
    if (!cell) return setPoiMsg({ k: 'outside' });
    const i = cell.r * grid.size + cell.c;
    if (cost.cls[i] === 3) return setPoiMsg({ k: 'forbidden' });
    setPoiMsg(null);
    if (as === 'start') setStartCell(i);
    else setEndCell(i);
    setTab('route');
  };

  // --- glove concept view (simulated position)
  const [noiseM, setNoiseM] = useState(40);
  const rtt = useMemo(() => linkAt(new Date()).roundTripMin, []);
  const gloveView: GloveView = useMemo(() => {
    const truePos = position !== null ? cellCenter(grid, Math.floor(position / grid.size), position % grid.size) : null;
    const pos = truePos ? moveBy(truePos, noiseM, (noiseM * 137.5) % 360) : null;
    const alertTarget = sim && shelterPlan ? { label: `Refugio ${shelterPlan.shelter.id}`, coord: shelterPlan.shelter.coord } : null;
    const endLL = endCell !== null ? cellCenter(grid, Math.floor(endCell / grid.size), endCell % grid.size) : null;
    const target = alertTarget ?? (endLL ? { label: t('Destination B', 'Destino B'), coord: endLL } : null);
    const dist = pos && target ? distanceM(pos, target.coord) : null;
    return {
      status: sim && assessment ? assessment.status : null,
      targetLabel: target?.label ?? null,
      bearing: pos && target ? bearingDeg(pos, target.coord) : null,
      distanceM: dist,
      etaMin: alertTarget && shelterPlan ? shelterPlan.minutes : dist !== null ? dist / ((mobility.walkSpeedKmh * 1000) / 60) : null,
      etaKind: alertTarget ? 'ruta' : 'línea recta',
      rttMin: rtt,
      online,
      alertLeftMin: sim ? sim.event.etaMin - sim.elapsedMin : null,
    };
  }, [position, grid, noiseM, sim, shelterPlan, endCell, assessment, mobility.walkSpeedKmh, rtt, online]);

  // --- scale bar / status
  const [pointer, setPointer] = useState<[number, number] | null>(null);
  const [view, setView] = useState<{ res: number; lat: number }>({ res: 0.001, lat: 0 });
  const scale = useMemo(() => {
    const mPerPx = view.res * metersPerDegreeLon(view.lat);
    const meters = niceLength(mPerPx * 120);
    return { meters, px: meters / mPerPx };
  }, [view]);
  const patch = (id: string, p: Partial<LayerState>) => setLayers((s) => ({ ...s, [id]: { ...s[id], ...p } }));

  const posDose = position !== null ? dose[position] : 1;

  return (
    <div className="app">
      <aside className="panel">
        <div className="panel-head">
          <div>
            <h1>ARES MAP</h1>
            <p className="sub">{t('Conceptual prototype', 'Prototipo conceptual')} · NASA Space Apps 2026</p>
            <div className="lang" role="group" aria-label={t('Language', 'Idioma')}>
              {(['en', 'es'] as const).map((code) => (
                <button key={code} aria-pressed={lang === code} lang={code} onClick={() => setLang(code)}>
                  {code.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <button className="panel-toggle" aria-expanded={!collapsed} aria-controls="panel-body" onClick={() => setCollapsed((c) => !c)}>
            {collapsed ? t('Show panel ▼', 'Mostrar panel ▼') : t('Hide panel ▲', 'Ocultar panel ▲')}
          </button>
        </div>
        <div className="tabs" role="tablist" aria-label="Secciones">
          {TABS.map((tb) => (
            <button key={tb.id} role="tab" aria-selected={tab === tb.id} onClick={() => { setTab(tb.id); setCollapsed(false); }}>
              {l(tb.label)}
            </button>
          ))}
        </div>

        <div id="panel-body" className="panel-body" hidden={collapsed}>
        {tab === 'map' && (
          <>
            <section>
              <h2>{t('Site', 'Sitio')}</h2>
              <div className="seg" role="group" aria-label={t('Site', 'Sitio')}>
                {Object.values(SITES).map((s) => (
                  <button key={s.id} aria-pressed={s.id === siteId} onClick={() => setSiteId(s.id)}>
                    {s.id === 'gale' ? 'Gale' : 'Jezero'}
                  </button>
                ))}
              </div>
              <p className="name">{l(site.name)}</p>
              <p className="muted">{l(site.objective)}</p>
              <DataBadge meta={site.meta} />
            </section>
            {(['base', 'thermal'] as const).map((group) => (
              <section key={group}>
                <h2>{group === 'base' ? t('Base layers', 'Capas base') : t('Thermal', 'Térmico')}</h2>
                {LAYER_DEFS.filter((d) => d.group === group).map((d) => (
                  <div className="layer" key={d.id}>
                    <label>
                      <input type="checkbox" checked={layers[d.id].visible} onChange={(e) => patch(d.id, { visible: e.target.checked })} />
                      {l(d.label)}
                    </label>
                    <input
                      type="range" min={0} max={1} step={0.05} value={layers[d.id].opacity}
                      aria-label={`${t('Opacity', 'Opacidad')} ${l(d.label)}`}
                      onChange={(e) => patch(d.id, { opacity: Number(e.target.value) })}
                    />
                    <DataBadge meta={d.meta} />
                  </div>
                ))}
              </section>
            ))}
            <section>
              <h2>{t('Offline mode', 'Modo sin conexión')}</h2>
              <p className="muted">
                {t(
                  "Saves the map imagery of this site's initial view on the device. Terrain data, routes, alerts and panels already ship inside the app.",
                  'Guarda en el dispositivo las imágenes de la vista inicial de este sitio. Los datos del terreno, rutas, alertas y paneles ya viajan dentro de la app.',
                )}
              </p>
              <button className="ghost" onClick={prepareOffline} disabled={offline.running || !online}>
                {offline.running ? t('Downloading…', 'Descargando…') : t('Prepare offline mode', 'Preparar modo offline')}
              </button>
              {offline.result && (
                <p className={offline.result.failed ? 'warnbox' : 'okbox'} role="status">
                  {offline.result.done}/{offline.result.total} {t('images saved', 'imágenes guardadas')}{offline.result.failed ? `, ${offline.result.failed} ${t('failed', 'fallaron')}` : ''}.
                </p>
              )}
              {offline.error && <p className="warnbox" role="status">{offline.error}</p>}
              <p className="muted">Service worker: {swActive ? t('active (the app opens without a network)', 'activo (la app abre sin red)') : t('inactive in this mode (it activates in the installed/built version)', 'inactivo en este modo (se activa en la versión instalada/compilada)')}.</p>
            </section>
          </>
        )}

        {tab === 'poi' && (
          <PoiSection
            siteId={siteId} pois={pois} selected={selectedPoi}
            showTraverse={showTraverse} showPois={showPois}
            onToggleTraverse={setShowTraverse} onTogglePois={setShowPois}
            onSelect={(id) => { setSelectedPoiId(id); setPoiMsg(null); }}
            onCenter={(p) => setFocus({ coord: p.lonlat, nonce: Date.now() })}
            onUseAs={applyPoiAs} message={poiMessage}
          />
        )}

        {tab === 'terrain' && (
          <>
            <TerrainSection state={ovState} mobility={mobility} onChange={(id, p) => setOvState((s) => ({ ...s, [id]: { ...s[id], ...p } }))} />
            <MobilitySection cfg={mobility} onChange={setMobility} />
            <ProbeSection probe={probe} onClear={() => setClicked(null)} />
          </>
        )}

        {tab === 'weather' && <WeatherSection key={siteId} series={weather} onThemis={showThemis} />}

        {tab === 'route' && (
          <>
            <RouteSection
              mode={mode} setMode={setMode}
              hasStart={startCell !== null} hasEnd={endCell !== null}
              routes={routes} message={routeMessage}
              selected={selected} onSelect={setSelected}
              onExample={loadExample} onClear={clearRoute} mobility={mobility}
            />
            <IncidentSection
              active={mode === 'hazard'}
              onToggle={() => setMode(mode === 'hazard' ? 'probe' : 'hazard')}
              form={hazardForm} setForm={setHazardForm}
              incidents={incidents}
              onDelete={(id) => setIncidents((l) => l.filter((i) => i.id !== id))}
              onSync={() => setIncidents((l) => l.map((i) => ({ ...i, syncedToEarth: true })))}
              siteIncidentsApplied={siteIncidents.length}
            />
          </>
        )}

        {tab === 'safety' && (
          <>
            <section>
              <h2>{t('Radiation on the terrain', 'Radiación en el terreno')}</h2>
              <div className="layer">
                <label>
                  <input
                    type="checkbox" checked={ovState.shielding.visible}
                    onChange={(e) => setOvState((s) => ({ ...s, shielding: { ...s.shielding, visible: e.target.checked } }))}
                  />
                  {t('Terrain shielding (estimated)', 'Blindaje del terreno (estimado)')}
                </label>
                <input
                  type="range" min={0} max={1} step={0.05} value={ovState.shielding.opacity}
                  aria-label={t('Shielding opacity', 'Opacidad blindaje')}
                  onChange={(e) => setOvState((s) => ({ ...s, shielding: { ...s.shielding, opacity: Number(e.target.value) } }))}
                />
              </div>
              <p className="muted">{t('More color = less visible sky = lower relative dose. Simplified model, not radiation transport.', 'Más color = menos cielo visible = menor dosis relativa. Modelo simplificado, no transporte de radiación.')}</p>
              <DataBadge meta={SHIELD_META} />
            </section>
            <SheltersSection shelters={shelters} siteId={siteId} />
            <EventsSection
              events={EVENTS} sim={sim} speed={speed}
              onTrigger={(event) => setSim({ event, elapsedMin: 0 })}
              onDismiss={() => setSim(null)} onSpeed={setSpeed}
            />
            {sim && assessment && (
              <ProtocolCard
                sim={sim} assessment={assessment}
                shelter={shelterPlan?.shelter ?? null}
                walkMin={shelterPlan?.minutes ?? null} walkDistM={shelterPlan?.distM ?? null}
                doseHere={posDose} siteId={siteId} fromLabel={positionLabel}
              />
            )}
          </>
        )}

        {tab === 'crew' && (
          <CrewSection
            siteId={siteId} rttMin={rtt}
            onSolar={() => { setSim({ event: EVENTS[1], elapsedMin: 0 }); setTab('safety'); }}
          />
        )}

        {tab === 'link' && <LinkSection />}

        {tab === 'glove' && <GloveSection view={gloveView} noiseM={noiseM} onNoise={setNoiseM} />}
        </div>
      </aside>

      <main className="stage">
        <MapView
          site={site}
          layers={layers}
          overlays={overlays}
          aoi={grid.extent}
          marker={clicked}
          onClick={handleClick}
          routes={routeLines}
          endpoints={{ start: cellLL(startCell), end: cellLL(endCell) }}
          shelters={shelters.map((s) => ({ id: s.id, coord: s.coord }))}
          hazards={hazardRings}
          traverse={showTraverse ? traverseLine : null}
          pois={poiPins}
          selectedPoi={selectedPoiId}
          focus={focus}
          onPointer={setPointer}
          onView={(res, lat) => setView({ res, lat })}
        />
        {OVERLAY_IDS.some((id) => ovState[id].visible) && (
          <div className="banner" role="note">{t('ILLUSTRATIVE TERRAIN · does not match the real relief of the site', 'TERRENO ILUSTRATIVO · no corresponde al relieve real del sitio')}</div>
        )}
        {mode === 'hazard' && <div className="banner danger" role="note">{t('Click where the hazard is', 'Hacé clic donde está el peligro')}</div>}
        {(mode === 'start' || mode === 'end') && (
          <div className="banner pick" role="note">
            {mode === 'start'
              ? t('Click the map to set the start A', 'Hacé clic en el mapa para fijar el inicio A')
              : t('Click the map to set the destination B', 'Hacé clic en el mapa para fijar el destino B')}
          </div>
        )}
        <div className="scale" style={{ width: scale.px }}>{fmtDist(scale.meters)}</div>
        <footer className="status">
          <span>{pointer ? `LAT ${pointer[1].toFixed(4)}°  LON ${pointer[0].toFixed(4)}°E` : 'LAT —  LON —'}</span>
          <span className={online ? 'ok' : 'warn'}>
            {t('LINK', 'ENLACE')}: {online ? t('NETWORK AVAILABLE', 'RED DISPONIBLE') : t('NO SIGNAL', 'SIN SEÑAL')}
          </span>
        </footer>
      </main>
    </div>
  );
}
