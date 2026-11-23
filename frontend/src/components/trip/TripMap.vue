<template>
  <div class="relative h-full w-full isolate trip-map" :class="{ 'trip-map-far': zoom < 10 }" :style="{ '--map-bottom-inset': `${insets.bottom}px` }">
    <div ref="mapEl" class="h-full w-full bg-[#e8eef3]"></div>

    <!-- 右上：底圖 -->
    <div class="absolute right-3 z-10 flex rounded-lg bg-white card-shadow-hover overflow-hidden text-xs" :style="{ top: `${insets.top + 12}px` }">
      <button
        v-for="b in BASES"
        :key="b.key"
        class="px-3 h-8 cursor-pointer whitespace-nowrap"
        :class="base === b.key ? 'bg-accent text-white font-semibold' : 'hover:bg-hover'"
        @click="setBase(b.key)"
      >
        {{ b.label }}
      </button>
    </div>

    <!-- 右下：縮放、指北、定位、顯示全部 -->
    <div class="absolute right-3 z-10 flex flex-col gap-2 transition-[bottom] duration-200" :style="{ bottom: `${insets.bottom + 28}px` }">
      <button v-if="bearing || pitch" class="map-btn" title="回到正北、平面" @click="resetNorth">
        <span class="block text-[15px] leading-none" :style="{ transform: `rotate(${-bearing}deg)` }">🧭</span>
      </button>
      <div class="hidden md:flex flex-col rounded-lg bg-white card-shadow-hover overflow-hidden">
        <button class="map-btn !shadow-none !rounded-none" title="放大" @click="map?.zoomIn()"><Icon name="plus" :size="18" /></button>
        <div class="h-px bg-line mx-1.5"></div>
        <button class="map-btn !shadow-none !rounded-none" title="縮小" @click="map?.zoomOut()"><span class="text-lg leading-none">−</span></button>
      </div>
      <button class="map-btn" :class="tilted ? '!text-accent' : ''" title="立體（建築物 3D）" @click="toggleTilt"><span class="text-[11px] font-bold">3D</span></button>
      <button class="map-btn" title="我的位置" :disabled="locating" @click="locate"><Icon name="locate" :size="18" /></button>
      <button class="map-btn" title="顯示全部地點" @click="fit(true)"><Icon name="fit" :size="18" /></button>
    </div>

    <div
      v-if="routing"
      class="absolute left-1/2 -translate-x-1/2 z-10 rounded-full bg-white card-shadow-hover px-3 h-8 flex items-center gap-2 text-xs text-ink-2"
      :style="{ bottom: `${insets.bottom + 28}px` }"
    >
      <span class="size-3 rounded-full border-2 border-accent border-t-transparent animate-spin"></span>規劃路線中…
    </div>
  </div>
</template>

<script setup>
import {
  onBeforeUnmount, onMounted, ref, watch,
} from 'vue';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// 地圖的背景執行緒：Vite 會把套件打包到別的位置，要明確告訴 MapLibre worker 檔在哪裡
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import Icon from '../Icon.vue';
import { useUiStore } from '@/stores/ui';
import {
  stopCategory, customCategories, byStopOrder, UNSCHEDULED_COLOR, TAIWAN_BOUNDS, travelModeInfo, fmtDuration,
} from '@/utils/trip';

maplibregl.setWorkerUrl(workerUrl);

const props = defineProps({
  days: { type: Array, required: true }, // tripDays()
  stops: { type: Array, required: true },
  routes: { type: Object, default: () => ({}) }, // { [date]: { lines, legs } }
  lanes: { type: Array, default: () => [] }, // 分頭路線（只在選了某一天時傳入）：{ key, color, name, stops, seq, lines }
  routing: { type: Boolean, default: false },
  selectedDate: { type: String, default: null }, // null = 全部、'unscheduled' = 備選
  focusStopId: { type: Number, default: null },
  preview: { type: Object, default: null }, // 正在查看、還沒加入的地點 { title, lat, lng }
  insets: { type: Object, default: () => ({ top: 0, bottom: 0, left: 0 }) }, // 被其他介面蓋住的範圍（手機底部抽屜、搜尋列）
  cardPad: { type: Number, default: 0 }, // 地點卡片蓋住的高度：只影響聚焦位置，不移動地圖按鈕
});
const emit = defineEmits(['select', 'move', 'place', 'blank']);

const ui = useUiStore();
const mapEl = ref(null);
const locating = ref(false);
const zoom = ref(7);
const bearing = ref(0);
const pitch = ref(0);
const tilted = ref(false);

/* ---------- 底圖 ----------
 * 地圖：OpenFreeMap（免費、不需金鑰、全世界的向量地圖，資料來自 OpenStreetMap）
 * 衛星：EOX Sentinel-2 cloudless（全世界），台灣範圍內疊上國土測繪中心的正射影像（更清楚）
 */
const BASES = [{ key: 'map', label: '地圖' }, { key: 'satellite', label: '衛星' }];
const VECTOR_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const [[twS, twW], [twN, twE]] = TAIWAN_BOUNDS;
const SATELLITE_STYLE = {
  version: 8,
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    eox: {
      type: 'raster',
      tiles: ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg'],
      tileSize: 256,
      maxzoom: 14,
      attribution: '<a href="https://s2maps.eu" target="_blank">Sentinel-2 cloudless</a> by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2020)',
    },
    nlsc: {
      type: 'raster',
      tiles: ['https://wmts.nlsc.gov.tw/wmts/PHOTO2/default/GoogleMapsCompatible/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 19,
      bounds: [twW, twS, twE, twN],
      attribution: '&copy; <a href="https://maps.nlsc.gov.tw/" target="_blank">內政部國土測繪中心</a>',
    },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#1d2a33' } },
    { id: 'eox', type: 'raster', source: 'eox' },
    { id: 'nlsc', type: 'raster', source: 'nlsc', minzoom: 8 },
  ],
};
// 地名：有繁體中文名稱用繁中，否則用當地名稱（日本顯示日文、韓國顯示韓文）
const NAME_EXPR = ['coalesce', ['get', 'name:zh-Hant'], ['get', 'name:zh-TW'], ['get', 'name'], ['get', 'name:latin']];
const POI_LAYERS = ['poi_r20', 'poi_r7', 'poi_r1', 'poi_transit', 'airport'];
const base = ref(localStorage.getItem('planner_map_base_v2') === 'satellite' ? 'satellite' : 'map');

let map = null;
let styleReady = false;
let observer = null;
let hoverPopup = null;
let myLocation = null;
let previewMarker = null;
let autoFit = true; // 剛載入、版面還在調整時自動對準；使用者動過地圖或 1.5 秒後就停止
const markers = new Map(); // stop.id → maplibregl.Marker
let extraMarkers = []; // 路段標籤
const canDrag = window.matchMedia?.('(pointer: fine)').matches; // 手機不開放拖曳圖標，避免移動地圖時不小心拉走

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[ch]));
const lngLat = ([lat, lng]) => [lng, lat];

/* ---------- 資料 ---------- */

// 依目前篩選，整理出要顯示的每日路線與備選（備選以虛線圖標顯示，不連線）
function visibleGroups() {
  const groups = [];
  const sel = props.selectedDate;
  const showBackupsOnly = sel === 'unscheduled';
  for (const day of props.days) {
    if (sel && !showBackupsOnly && sel !== day.date) continue;
    const ofDay = props.stops.filter((s) => s.date === day.date).sort(byStopOrder);
    if (!showBackupsOnly) {
      groups.push({
        key: day.date, color: day.color, label: day.title, stops: ofDay.filter((s) => !s.isBackup && !s.memberId), numbered: true, route: props.routes[day.date],
      });
    }
    const backups = ofDay.filter((s) => s.isBackup);
    if (backups.length) groups.push({ key: `${day.date}-backup`, color: day.color, label: `${day.title}備選`, stops: backups, numbered: false, backup: true });
  }
  // 未定日期的備選：看某一天時也顯示，方便找附近替代的地點
  const undated = props.stops.filter((s) => !s.date).sort(byStopOrder);
  if (undated.length) groups.push({ key: 'backup', color: UNSCHEDULED_COLOR, label: '備選（未定日期）', stops: undated, numbered: false, backup: true });
  return groups;
}

function routeFeatures(groups) {
  const features = [];
  const line = (coords, color, kind, name = '') => {
    if (coords?.length > 1) {
      features.push({
        type: 'Feature', properties: { color, kind, name }, geometry: { type: 'LineString', coordinates: coords.map(lngLat) },
      });
    }
  };
  let prevLast = null;
  for (const g of groups) {
    if (!g.numbered || !g.stops.length) continue;
    const points = g.stops.map((s) => [s.lat, s.lng]);
    if (prevLast) line([prevLast, points[0]], g.color, 'link'); // 跨天以虛線連接
    if (points.length > 1) {
      const lines = g.route?.lines?.length ? g.route.lines : [{ mode: 'straight', coords: points }];
      for (const l of lines) {
        const info = travelModeInfo(l.mode);
        line(l.coords, g.color, info.kind === 'line' ? 'line' : info.kind, `${info.emoji} ${info.label}`);
      }
    }
    prevLast = points[points.length - 1];
  }
  for (const lane of props.lanes) {
    const lines = lane.lines?.length ? lane.lines : [{ coords: lane.seq.map((s) => [s.lat, s.lng]) }];
    for (const l of lines) line(l.coords, lane.color, 'lane', `${lane.name}的路線`);
  }
  return { type: 'FeatureCollection', features };
}

/* ---------- 圖層 ---------- */
const ROUTE_LAYERS = [
  // 白色外框（讓路線在地圖上清楚）
  { id: 'trip-route-casing', filter: ['!', ['in', ['get', 'kind'], ['literal', ['link', 'lane']]]], paint: { 'line-color': '#fff', 'line-width': 8, 'line-opacity': 0.9 } },
  { id: 'trip-route-lane-casing', filter: ['==', ['get', 'kind'], 'lane'], paint: { 'line-color': '#fff', 'line-width': 6.5, 'line-opacity': 0.9 } },
  { id: 'trip-route-link', filter: ['==', ['get', 'kind'], 'link'], paint: { 'line-color': ['get', 'color'], 'line-width': 3, 'line-opacity': 0.55, 'line-dasharray': [1.5, 2] } },
  { id: 'trip-route-road', filter: ['==', ['get', 'kind'], 'road'], paint: { 'line-color': ['get', 'color'], 'line-width': 5 } },
  { id: 'trip-route-rail', filter: ['==', ['get', 'kind'], 'rail'], layout: { 'line-cap': 'butt' }, paint: { 'line-color': ['get', 'color'], 'line-width': 4.5, 'line-dasharray': [3, 2] } },
  { id: 'trip-route-air', filter: ['==', ['get', 'kind'], 'air'], paint: { 'line-color': ['get', 'color'], 'line-width': 3, 'line-dasharray': [2, 1.5] } },
  { id: 'trip-route-sea', filter: ['==', ['get', 'kind'], 'sea'], paint: { 'line-color': ['get', 'color'], 'line-width': 3.5, 'line-dasharray': [1, 1.2] } },
  { id: 'trip-route-line', filter: ['==', ['get', 'kind'], 'line'], paint: { 'line-color': ['get', 'color'], 'line-width': 4, 'line-dasharray': [0.3, 2] } },
  { id: 'trip-route-lane', filter: ['==', ['get', 'kind'], 'lane'], layout: { 'line-cap': 'butt' }, paint: { 'line-color': ['get', 'color'], 'line-width': 3.5, 'line-dasharray': [2, 1.6] } },
];

function setupStyle() {
  styleReady = true;
  const style = map.getStyle();
  if (base.value === 'map') {
    for (const layer of style.layers) {
      const field = layer.layout?.['text-field'];
      if (layer.type === 'symbol' && field && !/shield/.test(layer.id)) map.setLayoutProperty(layer.id, 'text-field', NAME_EXPR);
    }
  }
  // 路線畫在地名下面（跟 Google 地圖一樣，路線不會蓋住文字）
  const firstLabel = style.layers.find((l) => l.type === 'symbol')?.id;
  if (!map.getSource('trip-routes')) map.addSource('trip-routes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  for (const def of ROUTE_LAYERS) {
    if (map.getLayer(def.id)) continue;
    map.addLayer({
      type: 'line', source: 'trip-routes', layout: { 'line-cap': 'round', 'line-join': 'round', ...(def.layout || {}) }, ...def,
    }, firstLabel);
  }
  render();
}

function pinElement(stop, label, color, backup) {
  const el = document.createElement('div');
  el.className = backup ? 'trip-pin-wrap trip-pin-backup' : 'trip-pin-wrap';
  el.innerHTML = `<div class="trip-pin" style="--pin:${color}">
      <span class="trip-pin-num">${escapeHtml(label)}</span>
      <span class="trip-pin-emoji">${escapeHtml(stopCategory(stop).emoji)}</span>
    </div>`;
  return el;
}

function addPin(stop, label, color, { backup = false, sub = '' } = {}) {
  const el = pinElement(stop, label, color, backup);
  const marker = new maplibregl.Marker({
    element: el, anchor: 'bottom', draggable: canDrag, offset: [0, -2],
  }).setLngLat([stop.lng, stop.lat]).addTo(map);
  if (backup) el.style.zIndex = '0';
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    emit('select', stop);
  });
  el.addEventListener('mouseenter', () => {
    const time = stop.startTime ? `${stop.startTime}${stop.endTime ? `–${stop.endTime}` : ''}　` : '';
    hoverPopup.setLngLat([stop.lng, stop.lat])
      .setHTML(`<b>${escapeHtml(stop.title)}</b><br><span style="color:#616161">${escapeHtml(sub)}　${escapeHtml(time)}</span>`)
      .addTo(map);
  });
  el.addEventListener('mouseleave', () => hoverPopup.remove());
  marker.on('dragstart', () => hoverPopup.remove());
  marker.on('dragend', () => {
    const { lat, lng } = marker.getLngLat();
    emit('move', stop, { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) });
  });
  markers.set(stop.id, marker);
}

function legChipText(leg) {
  const info = travelModeInfo(leg.mode);
  if (!leg.duration) return `${info.emoji} ${info.label}`;
  return `${info.emoji} ${leg.estimated ? '約 ' : ''}${fmtDuration(leg.duration)}`;
}

function addLegChip(from, to, leg, color) {
  if (!from || !to || !leg) return;
  const coords = leg.coords?.length ? leg.coords : null;
  const mid = coords ? coords[Math.floor(coords.length / 2)] : [(from.lat + to.lat) / 2, (from.lng + to.lng) / 2];
  const el = document.createElement('span');
  el.className = 'trip-leg-chip';
  el.style.boxShadow = `inset 3px 0 0 ${color}, 0 1px 3px rgba(0,0,0,.18)`;
  el.textContent = legChipText(leg);
  extraMarkers.push(new maplibregl.Marker({ element: el }).setLngLat(lngLat(mid)).addTo(map));
}

function render() {
  if (!map || !styleReady) return;
  const groups = visibleGroups();
  map.getSource('trip-routes')?.setData(routeFeatures(groups));

  markers.forEach((m) => m.remove());
  markers.clear();
  extraMarkers.forEach((m) => m.remove());
  extraMarkers = [];
  hoverPopup?.remove();

  // 先畫備選（壓在下面），再畫行程地點
  for (const g of groups.filter((x) => x.backup)) g.stops.forEach((s) => addPin(s, '備', g.color, { backup: true, sub: g.label }));
  for (const lane of props.lanes) {
    lane.stops.forEach((s) => addPin(s, (lane.name || '?').slice(0, 1), lane.color, { sub: `${lane.name}的路線` }));
  }
  for (const g of groups.filter((x) => x.numbered)) {
    g.stops.forEach((s, i) => addPin(s, String(i + 1), g.color, { sub: g.label }));
    g.route?.legs?.forEach((leg, i) => addLegChip(g.stops[i], g.stops[i + 1], leg, g.color));
  }
}

/* ---------- 正在查看的地點（搜尋結果、點地圖上的店家） ---------- */
function renderPreview() {
  previewMarker?.remove();
  previewMarker = null;
  const p = props.preview;
  if (!map || !p) return;
  const el = document.createElement('div');
  el.className = 'trip-preview-pin';
  el.innerHTML = '<svg width="30" height="42" viewBox="0 0 30 42"><path d="M15 0C6.7 0 0 6.6 0 14.8 0 25.9 15 42 15 42s15-16.1 15-27.2C30 6.6 23.3 0 15 0z" fill="#d93025"/><circle cx="15" cy="15" r="5.5" fill="#7a1a13"/></svg>';
  previewMarker = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([p.lng, p.lat]).addTo(map);
  const z = Math.max(map.getZoom(), 15);
  map.easeTo({
    center: [p.lng, p.lat], zoom: z, duration: 600, padding: cameraPadding(),
  });
}

/* ---------- 視角 ---------- */
function cameraPadding() {
  const pad = 56;
  return {
    top: props.insets.top + pad, bottom: props.insets.bottom + props.cardPad + pad, left: (props.insets.left || 0) + pad, right: pad + 44, // 右邊有地圖按鈕
  };
}

function fit(animate = true) {
  if (!map) return;
  const groups = visibleGroups();
  // 以行程中的地點為主；只有備選時才縮放到備選
  const planned = [
    ...groups.filter((g) => !g.backup).flatMap((g) => g.stops),
    ...props.lanes.flatMap((l) => l.stops),
  ];
  const pts = (planned.length ? planned : groups.flatMap((g) => g.stops)).map((s) => [s.lng, s.lat]);
  const duration = animate ? 700 : 0;
  if (!pts.length) {
    map.easeTo({ center: [120.95, 23.7], zoom: 6.6, duration });
    return;
  }
  if (pts.length === 1) {
    map.easeTo({ center: pts[0], zoom: 15, duration });
    return;
  }
  const bounds = pts.reduce((b, p) => b.extend(p), new maplibregl.LngLatBounds(pts[0], pts[0]));
  map.fitBounds(bounds, { padding: cameraPadding(), maxZoom: 15, duration });
}

function setBase(key) {
  if (base.value === key || !map) return;
  base.value = key;
  localStorage.setItem('planner_map_base_v2', key);
  styleReady = false;
  map.setStyle(key === 'satellite' ? SATELLITE_STYLE : VECTOR_STYLE);
}

function resetNorth() {
  tilted.value = false;
  map?.easeTo({ bearing: 0, pitch: 0, duration: 500 });
}
function toggleTilt() {
  tilted.value = !tilted.value;
  map?.easeTo({ pitch: tilted.value ? 55 : 0, zoom: tilted.value ? Math.max(map.getZoom(), 16) : map.getZoom(), duration: 600 });
}

function locate() {
  if (!navigator.geolocation) {
    ui.toast('此瀏覽器不支援定位', 'error');
    return;
  }
  locating.value = true;
  navigator.geolocation.getCurrentPosition((pos) => {
    locating.value = false;
    const { latitude: lat, longitude: lng } = pos.coords;
    myLocation?.remove();
    const el = document.createElement('div');
    el.className = 'trip-my-location';
    myLocation = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
    map.easeTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 15), duration: 700 });
  }, () => {
    locating.value = false;
    ui.toast('無法取得目前位置，請確認已允許定位權限', 'error');
  }, { enableHighAccuracy: true, timeout: 10000 });
}

/** 地圖目前的中心（搜尋時以此為中心排序結果） */
function getCenter() {
  if (!map) return null;
  const c = map.getCenter();
  return { lat: c.lat, lng: c.lng, zoom: map.getZoom() };
}

/* ---------- 點地圖：店家 / 長按任意位置 ---------- */
function poiAt(point) {
  const layers = POI_LAYERS.filter((id) => map.getLayer(id));
  if (!layers.length) return null;
  const f = map.queryRenderedFeatures([[point.x - 6, point.y - 6], [point.x + 6, point.y + 6]], { layers })[0];
  if (!f || f.geometry.type !== 'Point') return null;
  const [lng, lat] = f.geometry.coordinates;
  const p = f.properties || {};
  const title = p['name:zh-Hant'] || p['name:zh-TW'] || p.name || p['name:latin'];
  return title ? {
    title, lat, lng, kind: p.subclass || p.class || '', source: 'poi',
  } : null;
}

let pressTimer = null;
let pressStart = null;
function cancelPress() {
  clearTimeout(pressTimer);
  pressTimer = null;
}

onMounted(() => {
  map = new maplibregl.Map({
    container: mapEl.value,
    style: base.value === 'satellite' ? SATELLITE_STYLE : VECTOR_STYLE,
    center: [120.95, 23.7],
    zoom: 6.6,
    attributionControl: false,
    dragRotate: true,
    pitchWithRotate: true,
    localIdeographFontFamily: '"Microsoft JhengHei", "PingFang TC", "Noto Sans TC", sans-serif',
  });
  map.addControl(new maplibregl.AttributionControl({
    compact: true,
    customAttribution: '路線與搜尋 &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
  }), 'bottom-right');
  map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
  hoverPopup = new maplibregl.Popup({
    closeButton: false, closeOnClick: false, offset: [0, -40], className: 'trip-hover-popup',
  });

  map.on('style.load', setupStyle);
  map.once('load', () => {
    fit(false);
    setTimeout(() => { autoFit = false; }, 1500);
  });
  map.on('movestart', (e) => { if (e.originalEvent) autoFit = false; });
  // 地圖來源標示預設收合成 ⓘ，點了才展開（MapLibre 第一次顯示時會自動展開）
  map.once('idle', () => {
    const attrib = map?.getContainer().querySelector('.maplibregl-ctrl-attrib');
    attrib?.removeAttribute('open');
    attrib?.classList.remove('maplibregl-compact-show');
  });
  map.on('move', () => {
    zoom.value = map.getZoom();
    bearing.value = Math.round(map.getBearing());
    pitch.value = Math.round(map.getPitch());
  });

  map.on('click', (e) => {
    const poi = poiAt(e.point);
    if (poi) emit('place', poi);
    else emit('blank');
  });
  map.on('contextmenu', (e) => emit('place', { lat: e.lngLat.lat, lng: e.lngLat.lng, reverse: true }));
  // 手機長按
  map.on('touchstart', (e) => {
    if (e.originalEvent.touches.length !== 1) return cancelPress();
    pressStart = e.point;
    const { lat, lng } = e.lngLat;
    cancelPress();
    pressTimer = setTimeout(() => {
      pressTimer = null;
      navigator.vibrate?.(15);
      emit('place', { lat, lng, reverse: true });
    }, 550);
    return undefined;
  });
  map.on('touchmove', (e) => {
    if (pressStart && Math.hypot(e.point.x - pressStart.x, e.point.y - pressStart.y) > 8) cancelPress();
  });
  map.on('touchend', cancelPress);
  map.on('movestart', (e) => { if (e.originalEvent?.touches?.length > 1) cancelPress(); });
  for (const id of POI_LAYERS) {
    map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
  }

  observer = new ResizeObserver(() => {
    map?.resize();
    if (autoFit && map) fit(false); // 版面剛定下來（例如手機抽屜）時重新對準
  });
  observer.observe(mapEl.value);
});

onBeforeUnmount(() => {
  observer?.disconnect();
  cancelPress();
  map?.remove();
  map = null;
});

watch(() => props.stops, render, { deep: true });
watch(() => props.routes, render);
watch(() => props.lanes, render);
watch(() => props.days, render);
watch(customCategories, render, { deep: true }); // 自訂圖標改了，地圖圖標跟著換
watch(() => props.selectedDate, () => {
  render();
  fit();
});
watch(() => props.preview, renderPreview);
// 剛載入時遮住地圖的範圍變了（抽屜高度），重新對準
watch(() => [props.insets.top, props.insets.bottom], () => {
  if (autoFit && map) fit(false);
});
watch(() => props.focusStopId, (id) => {
  const m = markers.get(id);
  if (!m || !map) return;
  const at = m.getLngLat();
  map.easeTo({
    center: at, zoom: Math.max(map.getZoom(), 15), duration: 600, padding: cameraPadding(),
  });
});

defineExpose({ fit, getCenter });
</script>

<style scoped>
.map-btn {
  width: 38px;
  height: 38px;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 3.2px 7.2px 0 rgba(0, 0, 0, 0.132), 0 0.6px 1.8px 0 rgba(0, 0, 0, 0.108);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-ink-2);
  cursor: pointer;
}
.map-btn:hover {
  color: var(--color-ink);
}
:deep(.trip-leg-chip) {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px 0 10px;
  border-radius: 999px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.14);
  font: 600 11px/1 "Segoe UI", sans-serif;
  color: #242424;
  white-space: nowrap;
  pointer-events: none;
}
/* 縮得很小時不顯示路段標籤，避免地圖太亂 */
.trip-map-far :deep(.trip-leg-chip) {
  display: none;
}
:deep(.trip-pin-wrap) {
  width: 34px;
  height: 44px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  cursor: pointer;
}
:deep(.trip-pin-wrap:hover) {
  z-index: 5;
}
:deep(.trip-preview-pin) {
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.35));
  animation: trip-drop 0.35s ease-out;
}
@keyframes trip-drop {
  from { transform: translateY(-14px); opacity: 0; }
}
:deep(.trip-my-location) {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #1a73e8;
  border: 3px solid #fff;
  box-shadow: 0 0 0 6px rgba(26, 115, 232, 0.2), 0 1px 4px rgba(0, 0, 0, 0.3);
}
:deep(.trip-hover-popup .maplibregl-popup-content) {
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.45;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
}
:deep(.trip-hover-popup .maplibregl-popup-tip) {
  display: none;
}
:deep(.maplibregl-ctrl-bottom-left),
:deep(.maplibregl-ctrl-bottom-right) {
  bottom: var(--map-bottom-inset, 0px);
}
</style>
