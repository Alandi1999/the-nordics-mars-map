import { useEffect, useRef } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import Feature from 'ol/Feature';
import Polygon from 'ol/geom/Polygon';
import Point from 'ol/geom/Point';
import ImageLayer from 'ol/layer/Image';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Static from 'ol/source/ImageStatic';
import { Circle as CircleStyle, Fill, RegularShape, Stroke, Style, Text } from 'ol/style';
import LineString from 'ol/geom/LineString';
import type { FeatureLike } from 'ol/Feature';
import type BaseLayer from 'ol/layer/Base';
import { LAYER_DEFS } from './layers';
import { METERS_PER_DEGREE } from '../lib/mars';
import type { SiteConfig } from '../config/sites';
import { useI18n } from '../i18n';

export interface LayerState {
  visible: boolean;
  opacity: number;
}

export interface OverlayImage {
  id: string;
  url: string;
  extent: [number, number, number, number];
  visible: boolean;
  opacity: number;
}

export interface RouteLine {
  id: string;
  color: string;
  coords: [number, number][];
  selected: boolean;
  dashed?: boolean;
}

export interface Pin {
  id: string;
  coord: [number, number];
}

export interface PoiPin {
  id: string;
  coord: [number, number];
  kind: 'waypoint' | 'science' | 'hazard' | 'habitat' | 'shelter' | 'landmark';
}

export interface Endpoints {
  start: [number, number] | null;
  end: [number, number] | null;
}

interface Props {
  site: SiteConfig;
  layers: Record<string, LayerState>;
  overlays: OverlayImage[];
  aoi: [number, number, number, number];
  marker: [number, number] | null;
  routes: RouteLine[];
  endpoints: Endpoints;
  shelters: Pin[];
  hazards: [number, number][][];
  traverse: [number, number][] | null;
  pois: PoiPin[];
  selectedPoi: string | null;
  focus: { coord: [number, number]; nonce: number } | null;
  onPointer: (lonLat: [number, number] | null) => void;
  onClick: (lonLat: [number, number], poiId?: string) => void;
  /** Reports degrees-per-pixel and center latitude after every move. */
  onView: (resolutionDegPerPx: number, centerLat: number) => void;
}

function viewFor(site: SiteConfig, existing?: View): View {
  const [lon, lat] = site.center;
  const resolution = (site.viewKm * 1000) / METERS_PER_DEGREE / 1000; // ~1000 px across
  if (existing) {
    existing.animate({ center: [lon, lat], resolution, duration: 600 });
    return existing;
  }
  return new View({
    projection: 'EPSG:4326', // plain lon/lat plane; Mars geometry handled in lib/mars.ts
    center: [lon, lat],
    resolution,
    minResolution: resolution / 200,
    maxResolution: 360 / 512,
    extent: [-180, -90, 180, 90],
  });
}

const aoiStyle = new Style({ stroke: new Stroke({ color: '#ff7a3d', width: 2, lineDash: [8, 6] }) });
function routeStyle(f: FeatureLike): Style[] {
  const kind = f.get('kind');
  if (kind === 'point') {
    return [
      new Style({
        image: new CircleStyle({ radius: 11, fill: new Fill({ color: '#0b0d10' }), stroke: new Stroke({ color: '#fff', width: 2 }) }),
        text: new Text({ text: f.get('label'), fill: new Fill({ color: '#fff' }), font: 'bold 12px monospace' }),
      }),
    ];
  }
  if (kind === 'hazard') {
    return [new Style({ fill: new Fill({ color: 'rgba(239,68,68,0.28)' }), stroke: new Stroke({ color: '#ef4444', width: 2, lineDash: [6, 4] }) })];
  }
  if (kind === 'shelter') {
    return [
      new Style({
        image: new CircleStyle({ radius: 11, fill: new Fill({ color: '#052e16' }), stroke: new Stroke({ color: '#4ade80', width: 3 }) }),
        text: new Text({ text: f.get('label'), fill: new Fill({ color: '#bbf7d0' }), font: 'bold 11px monospace' }),
      }),
    ];
  }
  const selected = f.get('selected') as boolean;
  const dashed = f.get('dashed') as boolean;
  return [
    new Style({ stroke: new Stroke({ color: 'rgba(0,0,0,0.7)', width: selected ? 8 : 5 }) }),
    new Style({ stroke: new Stroke({ color: f.get('color') as string, width: selected ? 5 : 3, lineDash: dashed ? [10, 8] : undefined }), zIndex: selected ? 2 : 1 }),
  ];
}

const traverseStyle = new Style({ stroke: new Stroke({ color: 'rgba(255,255,255,0.75)', width: 2 }) });

function poiStyle(f: FeatureLike): Style[] {
  const kind = f.get('kind') as string;
  const selected = f.get('selected') as boolean;
  const dark = new Stroke({ color: '#0b0d10', width: 1.5 });
  const image =
    kind === 'science'
      ? new RegularShape({ points: 4, radius: 9, angle: 0, fill: new Fill({ color: '#c084fc' }), stroke: dark })
      : kind === 'hazard'
        ? new RegularShape({ points: 3, radius: 9, fill: new Fill({ color: '#ef4444' }), stroke: dark })
        : kind === 'landmark'
          ? new RegularShape({ points: 5, radius: 10, radius2: 4, fill: new Fill({ color: '#38bdf8' }), stroke: dark })
          : new CircleStyle({ radius: 5, fill: new Fill({ color: '#e2e8f0' }), stroke: dark });
  const out = [new Style({ image })];
  if (selected) out.unshift(new Style({ image: new CircleStyle({ radius: 14, stroke: new Stroke({ color: '#ff7a3d', width: 3 }) }) }));
  return out;
}

const markerStyle = new Style({
  image: new CircleStyle({
    radius: 7,
    fill: new Fill({ color: 'rgba(255,122,61,0.35)' }),
    stroke: new Stroke({ color: '#ffffff', width: 2 }),
  }),
});

export function MapView({ site, layers, overlays, aoi, marker, routes, endpoints, shelters, hazards, traverse, pois, selectedPoi, focus, onPointer, onClick, onView }: Props) {
  const { t } = useI18n();
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<Map | null>(null);
  const olLayers = useRef<Record<string, BaseLayer>>({});
  const overlayLayers = useRef<Record<string, ImageLayer<Static>>>({});
  const aoiSource = useRef(new VectorSource());
  const markerSource = useRef(new VectorSource());
  const routeSource = useRef(new VectorSource());
  const traverseSource = useRef(new VectorSource());
  const poiSource = useRef(new VectorSource());
  const poiLayer = useRef<VectorLayer | null>(null);
  const handlers = useRef({ onPointer, onClick, onView });
  handlers.current = { onPointer, onClick, onView };

  useEffect(() => {
    if (!host.current) return;
    // Overlay layers belong to a specific map instance; React StrictMode remounts this effect.
    overlayLayers.current = {};
    const base: BaseLayer[] = LAYER_DEFS.map((def) => {
      const layer = def.create();
      olLayers.current[def.id] = layer;
      return layer;
    });
    poiLayer.current = new VectorLayer({ source: poiSource.current, style: poiStyle, zIndex: 58 });
    const top = [
      new VectorLayer({ source: traverseSource.current, style: traverseStyle, zIndex: 20 }),
      poiLayer.current,
      new VectorLayer({ source: aoiSource.current, style: aoiStyle, zIndex: 50 }),
      new VectorLayer({ source: routeSource.current, style: routeStyle, zIndex: 55 }),
      new VectorLayer({ source: markerSource.current, style: markerStyle, zIndex: 60 }),
    ];
    const view = viewFor(site);
    const m = new Map({ target: host.current, layers: [...base, ...top], view, controls: [] });
    map.current = m;

    const report = () => {
      const c = view.getCenter();
      const r = view.getResolution();
      if (c && r) handlers.current.onView(r, c[1]);
    };
    view.on('change:resolution', report);
    view.on('change:center', report);
    report();
    m.on('pointermove', (e) => handlers.current.onPointer(e.coordinate as [number, number]));
    m.on('singleclick', (e) => {
      const hit = m.forEachFeatureAtPixel(e.pixel, (f) => f.get('poiId') as string | undefined, {
        layerFilter: (l) => l === poiLayer.current,
        hitTolerance: 8,
      });
      handlers.current.onClick(e.coordinate as [number, number], hit);
    });
    const el = host.current;
    // The panel collapses and rotates on phones: tell OpenLayers whenever the container changes size.
    const ro = new ResizeObserver(() => m.updateSize());
    ro.observe(el);
    const leave = () => handlers.current.onPointer(null);
    el.addEventListener('pointerleave', leave);
    return () => {
      ro.disconnect();
      el.removeEventListener('pointerleave', leave);
      m.setTarget(undefined);
      map.current = null;
    };
    // The map is created once; site changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = map.current?.getView();
    if (view) viewFor(site, view);
  }, [site]);

  useEffect(() => {
    for (const [id, state] of Object.entries(layers)) {
      const l = olLayers.current[id];
      if (!l) continue;
      l.setVisible(state.visible);
      l.setOpacity(state.opacity);
    }
  }, [layers]);

  useEffect(() => {
    const [a, b, c, d] = aoi;
    aoiSource.current.clear();
    aoiSource.current.addFeature(
      new Feature(new Polygon([[[a, b], [c, b], [c, d], [a, d], [a, b]]])),
    );
  }, [aoi]);

  useEffect(() => {
    traverseSource.current.clear();
    if (traverse && traverse.length > 1) traverseSource.current.addFeature(new Feature(new LineString(traverse)));
  }, [traverse]);

  useEffect(() => {
    poiSource.current.clear();
    for (const p of pois) {
      const f = new Feature(new Point(p.coord));
      f.setProperties({ poiId: p.id, kind: p.kind, selected: p.id === selectedPoi });
      poiSource.current.addFeature(f);
    }
  }, [pois, selectedPoi]);

  useEffect(() => {
    if (focus) map.current?.getView().animate({ center: focus.coord, duration: 500 });
  }, [focus]);

  useEffect(() => {
    markerSource.current.clear();
    if (marker) markerSource.current.addFeature(new Feature(new Point(marker)));
  }, [marker]);

  useEffect(() => {
    const src = routeSource.current;
    src.clear();
    // Unselected routes first so the selected one is drawn on top.
    for (const r of [...routes].sort((a, b) => Number(a.selected) - Number(b.selected))) {
      const f = new Feature(new LineString(r.coords));
      f.setProperties({ kind: 'line', color: r.color, selected: r.selected, dashed: r.dashed ?? false });
      src.addFeature(f);
    }
    for (const ring of hazards) {
      const f = new Feature(new Polygon([ring]));
      f.set('kind', 'hazard');
      src.addFeature(f);
    }
    for (const sh of shelters) {
      const f = new Feature(new Point(sh.coord));
      f.setProperties({ kind: 'shelter', label: sh.id });
      src.addFeature(f);
    }
    for (const [label, pt] of [['A', endpoints.start], ['B', endpoints.end]] as const) {
      if (!pt) continue;
      const f = new Feature(new Point(pt));
      f.setProperties({ kind: 'point', label });
      src.addFeature(f);
    }
  }, [routes, endpoints, shelters, hazards]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const seen = new Set<string>();
    overlays.forEach((o, idx) => {
      seen.add(o.id);
      let layer = overlayLayers.current[o.id];
      const source = new Static({ url: o.url, imageExtent: o.extent, projection: 'EPSG:4326' });
      if (!layer) {
        layer = new ImageLayer({ source, zIndex: 10 + idx });
        overlayLayers.current[o.id] = layer;
        m.addLayer(layer);
      } else if ((layer.getSource() as Static).getUrl() !== o.url) {
        layer.setSource(source);
      }
      layer.setVisible(o.visible);
      layer.setOpacity(o.opacity);
    });
    for (const id of Object.keys(overlayLayers.current)) {
      if (!seen.has(id)) {
        m.removeLayer(overlayLayers.current[id]);
        delete overlayLayers.current[id];
      }
    }
  }, [overlays]);

  return <div ref={host} className="map" role="application" aria-label={t('Map of Mars', 'Mapa de Marte')} />;
}
