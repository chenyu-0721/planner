<template>
  <div ref="el" class="h-full w-full weather-map"></div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { attachWind } from '@/utils/windField';
import { formatArea, impactOf } from '@/utils/weatherDesk';

const props = defineProps({
  radar: { type: Object, default: null },
  storms: { type: Array, default: () => [] },
  pressure: { type: Object, default: () => ({ highs: [], lows: [] }) },
  aiPaths: { type: Array, default: () => [] },
  wind: { type: Object, default: null },
  windIndex: { type: Number, default: 0 },
  layers: {
    type: Object,
    default: () => ({ cwa: true, jma: true, ai: true, pressure: true, wind: true, radar: false, impact: true }),
  },
});

const el = ref(null);
let map = null;
let radarLayer = null;
let stormLayer = null;
let impactLayer = null;
let pressureLayer = null;
let stopWind = null;

function stormColor(storm) {
  return storm.source === 'cwa' ? '#3ee07a' : '#ff6b6b';
}

function drawRadar() {
  if (!map) return;
  if (radarLayer) {
    radarLayer.remove();
    radarLayer = null;
  }
  if (!props.layers.radar || !props.radar?.host || !props.radar?.path) return;
  radarLayer = L.tileLayer(`${props.radar.host}${props.radar.path}/256/{z}/{x}/{y}/2/1_1.png`, {
    opacity: 0.32,
    pane: 'radar',
    attribution: 'RainViewer',
  }).addTo(map);
}

function compactMap() {
  return !map || map.getSize().x < 640;
}

function tip(layer, text, options) {
  layer.bindTooltip(text, {
    ...options,
    permanent: compactMap() ? false : options.permanent,
    className: 'weather-tip',
  });
  return layer;
}

function drawPath(coords, color, dash) {
  if (!coords || coords.length < 2) return;
  L.polyline(coords, {
    color: '#0b1220',
    weight: 7,
    opacity: 0.28,
    interactive: false,
    pane: 'storms',
  }).addTo(stormLayer);
  L.polyline(coords, {
    color,
    weight: 3.4,
    opacity: 0.98,
    dashArray: dash || null,
    lineCap: 'round',
    pane: 'storms',
  }).addTo(stormLayer);
}

function drawStorms() {
  if (!stormLayer) return;
  stormLayer.clearLayers();
  const shown = props.storms.filter((storm) => (
    (storm.source === 'cwa' && props.layers.cwa) || (storm.source === 'jma' && props.layers.jma)
  ));
  shown.forEach((storm, index) => {
    const color = stormColor(storm);
    if ((storm.track || []).length > 1) drawPath(storm.track, color, '1 8');
    const future = (storm.forecast || []).map((p) => p.center).filter(Boolean);
    const line = storm.center ? [storm.center, ...future] : future;
    if (line.length > 1) drawPath(line, color);
    if (storm.center) {
      tip(L.circleMarker(storm.center, {
        radius: compactMap() ? 6 : 8, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1, pane: 'storms',
      }), storm.sourceLabel, {
        permanent: true,
        direction: index === 0 ? 'left' : 'right',
      }).addTo(stormLayer);
    }
  });
  if (props.layers.ai) {
    for (const path of props.aiPaths || []) {
      const past = (path.points || []).filter((point) => point.center && (point.hours || 0) <= 0).map((point) => point.center);
      const future = (path.points || []).filter((point) => point.center && (point.hours || 0) >= 0).map((point) => point.center);
      if (past.length > 1) drawPath(past, '#e2c6ff', '1 8');
      if (future.length > 1) drawPath(future, '#e2c6ff', '10 8');
      const origin = (path.points || []).find((point) => point.kind === 'past' && point.center);
      if (origin?.center) {
        tip(L.circleMarker(origin.center, {
          radius: 5, color: '#fff', weight: 2, fillColor: '#c9a0ff', fillOpacity: 1, pane: 'storms',
        }), 'AI 起報', { permanent: true, direction: 'top' }).addTo(stormLayer);
      }
      const marks = compactMap()
        ? [{ hours: 72, label: 'AI 72 小時' }]
        : [
          { hours: 72, label: 'AI 72 小時' },
          { hours: 120, label: 'AI 5 日' },
          { hours: 240, label: 'AI 10 日' },
        ];
      for (const item of marks) {
        const mark = (path.points || []).find((point) => point.hours === item.hours)
          || (item.hours === 240 ? (path.points || []).at(-1) : null);
        if (!mark?.center || (item.hours === 240 && mark.hours < 168)) continue;
        tip(L.circleMarker(mark.center, {
          radius: item.hours === 72 ? 6 : 5, color: '#fff', weight: 2, fillColor: '#c9a0ff', fillOpacity: 1, pane: 'storms',
        }), item.hours === 240 && mark.hours !== 240 ? `AI ${Math.round(mark.hours / 24)} 日` : item.label, {
          permanent: true, direction: 'bottom',
        }).addTo(stormLayer);
      }
    }
  }
}

function ring(center, km, color, fill, weight, dash) {
  return L.circle(center, {
    radius: km * 1000,
    color,
    weight: weight || 1.6,
    fillColor: color,
    fillOpacity: fill,
    dashArray: dash || null,
    pane: 'impact',
    interactive: true,
  });
}

function drawImpact() {
  if (!impactLayer) return;
  impactLayer.clearLayers();
  if (!props.layers.impact) return;
  const shown = props.storms.filter((storm) => (
    (storm.source === 'cwa' && props.layers.cwa) || (storm.source === 'jma' && props.layers.jma)
  ));
  shown.forEach((storm) => {
    const color = stormColor(storm);
    const impact = impactOf(storm);
    if (storm.cone?.length >= 4) {
      L.polygon(storm.cone, {
        color,
        weight: 1.4,
        fillColor: color,
        fillOpacity: 0.12,
        pane: 'impact',
        interactive: false,
      }).addTo(impactLayer);
    }
    if (storm.center && impact.galeKm) {
      ring(storm.center, impact.galeKm, color, 0.13, 1.6, '5 4')
        .bindTooltip(`七級風圈 ${impact.galeKm} km${impact.areaKm2 ? `・約 ${formatArea(impact.areaKm2)}` : ''}`, {
          className: 'weather-tip',
        })
        .addTo(impactLayer);
    }
    if (storm.center && impact.stormKm) {
      ring(storm.center, impact.stormKm, color, 0.24, 2.2)
        .bindTooltip(`十級風圈 ${impact.stormKm} km`, { className: 'weather-tip' })
        .addTo(impactLayer);
    }
    (storm.forecast || []).forEach((point) => {
      if (!point.center || !point.radiusKm) return;
      ring(point.center, point.radiusKm, color, 0.06, 1, '3 7').addTo(impactLayer);
    });
  });
  if (props.layers.ai) {
    for (const path of props.aiPaths || []) {
      const marks = (path.points || []).filter((point) => point.hours > 0 && point.hours % 48 === 0 && point.center);
      const gale = impactOf(shown[0] || props.storms[0]).galeKm || 180;
      marks.forEach((point, index) => {
        const km = Math.max(70, Math.round(gale * (1 - index * 0.08)));
        ring(point.center, km, '#c9a0ff', 0.05, 1, '6 6').addTo(impactLayer);
      });
    }
  }
}

function pressureIcon(kind, value, minor) {
  return L.divIcon({
    className: `pressure-mark${minor ? ' is-minor' : ''}`,
    html: `<span class="${kind === 'H' ? 'is-high' : 'is-low'}"><b>${kind}</b><small>${value}</small></span>`,
    iconSize: minor ? [32, 32] : [42, 42],
    iconAnchor: minor ? [16, 16] : [21, 21],
  });
}

function isobarIcon(level) {
  return L.divIcon({
    className: 'isobar-label',
    html: `<span>${level}</span>`,
    iconSize: [28, 14],
    iconAnchor: [14, 7],
  });
}

function drawField() {
  if (!pressureLayer) return;
  pressureLayer.clearLayers();
  if (!props.layers.pressure) return;
  for (const contour of props.pressure?.contours || []) {
    const major = contour.level % 4 === 0;
    let longest = null;
    for (const line of contour.lines || []) {
      if (line.length < 2) continue;
      L.polyline(line, {
        color: major ? 'rgba(255,255,255,0.62)' : 'rgba(255,255,255,0.28)',
        weight: contour.level % 8 === 0 ? 2.2 : major ? 1.4 : 1,
        interactive: false,
        pane: 'isobars',
      }).addTo(pressureLayer);
      if (!longest || line.length > longest.length) longest = line;
    }
    if (major && longest && longest.length >= 6) {
      const mid = longest[Math.floor(longest.length / 2)];
      L.marker(mid, {
        icon: isobarIcon(contour.level),
        pane: 'isobars',
        interactive: false,
      }).addTo(pressureLayer);
    }
  }
  const groups = [
    ['H', props.pressure?.highs || []],
    ['L', props.pressure?.lows || []],
  ];
  for (const [kind, points] of groups) {
    for (const point of points) {
      if (point.lat == null || point.lng == null) continue;
      const minor = kind === 'H'
        ? !(point.pressure >= 1020 || (point.delta || 0) >= 1.8)
        : !(point.pressure <= 1004 || (point.delta || 0) >= 2.5);
      L.marker([point.lat, point.lng], {
        icon: pressureIcon(kind, point.pressure, minor),
        pane: 'labels',
        interactive: true,
      }).bindTooltip(`${kind === 'H' ? '高氣壓' : '低氣壓'} ${point.pressure} hPa`, {
        className: 'weather-tip',
      }).addTo(pressureLayer);
    }
  }
}

let resizeObs = null;

onMounted(() => {
  map = L.map(el.value, {
    zoomControl: false,
    attributionControl: true,
    minZoom: 3,
    maxZoom: 12,
  }).setView([23.7, 121.0], window.innerWidth < 768 ? 5.2 : 5.6);
  L.control.zoom({ position: 'topright' }).addTo(map);
  map.createPane('base');
  map.createPane('names');
  map.createPane('radar');
  map.createPane('impact');
  map.createPane('isobars');
  map.createPane('storms');
  map.createPane('labels');
  map.getPane('base').style.zIndex = 120;
  map.getPane('names').style.zIndex = 500;
  map.getPane('radar').style.zIndex = 250;
  map.getPane('impact').style.zIndex = 320;
  map.getPane('isobars').style.zIndex = 360;
  map.getPane('storms').style.zIndex = 540;
  map.getPane('labels').style.zIndex = 650;
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    pane: 'base',
    maxZoom: 12,
    subdomains: 'abcd',
    attribution: '© OpenStreetMap © CARTO',
  }).addTo(map);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    pane: 'base',
    maxZoom: 12,
    attribution: 'Tiles © Esri',
  }).addTo(map);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
    pane: 'names',
    maxZoom: 12,
    opacity: 0.92,
  }).addTo(map);
  stormLayer = L.layerGroup().addTo(map);
  impactLayer = L.layerGroup().addTo(map);
  pressureLayer = L.layerGroup().addTo(map);
  stopWind = attachWind(map, L, () => ({
    wind: props.wind,
    index: props.windIndex,
    show: props.layers.wind,
  }));
  drawRadar();
  drawStorms();
  drawImpact();
  drawField();
  resizeObs = () => {
    map?.invalidateSize();
    drawStorms();
  };
  map.on('resize', resizeObs);
  window.addEventListener('resize', resizeObs);
});

watch(() => props.radar, drawRadar);
watch(() => props.layers.radar, drawRadar);
watch(() => props.storms, () => { drawStorms(); drawImpact(); }, { deep: true });
watch(() => props.aiPaths, () => { drawStorms(); drawImpact(); }, { deep: true });
watch(() => [props.layers.cwa, props.layers.jma, props.layers.ai, props.layers.impact], () => {
  drawStorms();
  drawImpact();
});
watch(() => props.pressure, drawField, { deep: true });
watch(() => props.layers.pressure, drawField);

function focusTaiwan() {
  map?.setView([23.7, 121.0], window.innerWidth < 768 ? 6.6 : 7.4);
}

function resize() {
  map?.invalidateSize();
}

defineExpose({ focusTaiwan, resize });

onBeforeUnmount(() => {
  if (resizeObs) {
    window.removeEventListener('resize', resizeObs);
    map?.off('resize', resizeObs);
  }
  stopWind?.();
  map?.remove();
  map = null;
});
</script>

<style>
.weather-map.leaflet-container {
  background: #0b1220;
  font-family: inherit;
}
.weather-map .leaflet-control-zoom a {
  background: #16324d;
  color: #fff;
  border: 0;
}
.weather-map .leaflet-control-attribution {
  background: rgba(10, 24, 40, 0.55);
  color: #d5deea;
}
@media (max-width: 767px) {
  .weather-map .leaflet-control-zoom a {
    width: 28px;
    height: 28px;
    line-height: 28px;
    font-size: 14px;
  }
  .weather-map .leaflet-control-attribution {
    font-size: 9px;
    max-width: 58%;
  }
}
.weather-tip {
  background: rgba(10, 24, 40, 0.92);
  color: #fff;
  border: 0;
  border-radius: 999px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.28);
  font-weight: 700;
  font-size: 12px;
  padding: 3px 9px;
}
.weather-tip::before {
  display: none;
}
.leaflet-container img {
  max-width: none !important;
  max-height: none !important;
}
.pressure-mark {
  background: transparent;
  border: 0;
}
.pressure-mark span {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: rgba(10, 24, 40, 0.42);
  box-shadow: 0 0 0 2px currentColor inset;
}
.pressure-mark b {
  font-size: 20px;
  line-height: 1;
  font-weight: 900;
}
.pressure-mark small {
  font-size: 9px;
  font-weight: 700;
}
.pressure-mark.is-minor span {
  width: 32px;
  height: 32px;
  background: rgba(10, 24, 40, 0.28);
  box-shadow: 0 0 0 1.5px currentColor inset;
}
.pressure-mark.is-minor b {
  font-size: 14px;
}
.pressure-mark.is-minor small {
  font-size: 8px;
}
.isobar-label {
  background: transparent;
  border: 0;
}
.isobar-label span {
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  text-shadow: 0 0 4px #0b1220, 0 1px 2px #0b1220;
}
.pressure-mark .is-high { color: #9ad4ff; }
.pressure-mark .is-low { color: #ff8d8d; }
</style>
