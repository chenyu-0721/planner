<template>
  <div class="relative h-full w-full isolate">
    <div ref="mapEl" class="h-full w-full bg-[#e8eef3]"></div>


    <!-- 底圖切換 -->
    <div class="absolute top-3 right-3 z-[1000] flex rounded bg-white card-shadow-hover overflow-hidden text-xs">
      <button
        v-for="l in BASE_LAYERS"
        :key="l.key"
        class="px-2.5 h-8 cursor-pointer whitespace-nowrap"
        :class="baseKey === l.key ? 'bg-accent text-white font-semibold' : 'hover:bg-hover'"
        @click="setBase(l.key)"
      >
        {{ l.key === 'emap' ? '地圖' : l.key === 'photo' ? '衛星' : 'OSM' }}
      </button>
    </div>

    <div class="absolute right-3 bottom-6 z-[1000] flex flex-col gap-2">
      <button class="map-btn" title="我的位置" :disabled="locating" @click="locate"><Icon name="locate" :size="18" /></button>
      <button class="map-btn" title="顯示全部地點" @click="fit(true)"><Icon name="fit" :size="18" /></button>
    </div>

    <div v-if="routing" class="absolute left-3 bottom-6 z-[1000] rounded-full bg-white card-shadow-hover px-3 h-8 flex items-center text-xs text-ink-2">
      規劃路線中…
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Icon from '../Icon.vue';
import { useUiStore } from '@/stores/ui';
import {
  stopCategory, customCategories, byStopOrder, UNSCHEDULED_COLOR, BASE_LAYERS, TAIWAN_BOUNDS, TAIWAN_CENTER, MIN_ZOOM, inTaiwan, travelModeInfo, fmtDuration,
} from '@/utils/trip';

const props = defineProps({
  days: { type: Array, required: true }, // tripDays()
  stops: { type: Array, required: true },
  routes: { type: Object, default: () => ({}) }, // { [date]: { coords, legs } }
  lanes: { type: Array, default: () => [] }, // 分頭路線（只在選了某一天時傳入）：{ key, color, name, stops, seq, lines }
  routing: { type: Boolean, default: false },
  selectedDate: { type: String, default: null }, // null = 全部、'unscheduled' = 備選
  focusStopId: { type: Number, default: null },
});
const emit = defineEmits(['select', 'move']);

const ui = useUiStore();
const mapEl = ref(null);
const baseKey = ref(localStorage.getItem('planner_map_base') || 'emap');
const locating = ref(false);
let map = null;
let layer = null;
let tiles = null;
let myLocation = null;
const markers = new Map();
let observer = null;

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[ch]));

function pinIcon(stop, label, color, backup = false) {
  return L.divIcon({
    className: backup ? 'trip-pin-wrap trip-pin-backup' : 'trip-pin-wrap',
    html: `<div class="trip-pin" style="--pin:${color}">
      <span class="trip-pin-num">${label}</span>
      <span class="trip-pin-emoji">${stopCategory(stop).emoji}</span>
    </div>`,
    iconSize: [34, 44],
    iconAnchor: [17, 42],
    tooltipAnchor: [0, -40],
  });
}

function legChipText(leg) {
  const info = travelModeInfo(leg.mode);
  if (!leg.duration) return `${info.emoji} ${info.label}`;
  return info.kind === 'rail' ? `${info.emoji} 約 ${fmtDuration(leg.duration)}` : `${info.emoji} ${fmtDuration(leg.duration)}`;
}

// 線條樣式：道路 = 實線、高鐵 / 火車 / 捷運 = 虛線（不要看起來像道路）、直線 = 點線
function drawLine({ mode, coords }, color) {
  const info = travelModeInfo(mode);
  const tip = `${info.emoji} ${info.label}`;
  if (info.kind === 'rail') {
    L.polyline(coords, { color: '#fff', weight: 7, opacity: 0.95, interactive: false }).addTo(layer);
    L.polyline(coords, {
      color, weight: 4, opacity: 0.95, dashArray: '14 10', lineCap: 'butt',
    }).bindTooltip(tip, { sticky: true }).addTo(layer);
    return;
  }
  L.polyline(coords, { color: '#fff', weight: 8, opacity: 0.9, interactive: false }).addTo(layer);
  L.polyline(coords, {
    color, weight: 5, opacity: 0.95, dashArray: info.kind === 'road' ? null : '1 9', lineCap: 'round',
  }).bindTooltip(tip, { sticky: true }).addTo(layer);
}

function addLegChip(from, to, leg, color) {
  if (!from || !to || !leg) return;
  const mid = leg.coords?.length
    ? leg.coords[Math.floor(leg.coords.length / 2)]
    : [(from.lat + to.lat) / 2, (from.lng + to.lng) / 2];
  const marker = L.marker(mid, {
    icon: L.divIcon({
      className: 'trip-leg-label',
      html: `<span class="trip-leg-chip" style="box-shadow:inset 3px 0 0 ${color}, 0 1px 3px rgba(0,0,0,.18)">${escapeHtml(legChipText(leg))}</span>`,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    }),
    interactive: false,
    keyboard: false,
  });
  marker.addTo(layer);
}

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

function render() {
  if (!map) return;
  layer.clearLayers();
  markers.clear();
  const groups = visibleGroups();

  // 依時程連線：同一天沿道路（或直線），跨天以虛線連接
  let prevLast = null;
  for (const g of groups) {
    if (!g.numbered || !g.stops.length) continue;
    const points = g.stops.map((s) => [s.lat, s.lng]);
    if (prevLast) {
      L.polyline([prevLast, points[0]], { color: g.color, weight: 3, opacity: 0.6, dashArray: '6 8' }).addTo(layer);
    }
    if (points.length > 1) {
      // 每一段依交通方式畫不同樣式；路線還沒算好時先畫直線
      const lines = g.route?.lines?.length ? g.route.lines : [{ mode: 'straight', coords: points }];
      for (const line of lines) drawLine(line, g.color);
      g.route?.legs?.forEach((leg, i) => addLegChip(g.stops[i], g.stops[i + 1], leg, g.color));
    }
    prevLast = points[points.length - 1];
  }

  // 分頭路線：成員顏色的細虛線，圖標標示成員名字的第一個字
  for (const lane of props.lanes) {
    const lines = lane.lines?.length ? lane.lines : [{ coords: lane.seq.map((s) => [s.lat, s.lng]) }];
    for (const line of lines) {
      L.polyline(line.coords, { color: '#fff', weight: 6, opacity: 0.9, interactive: false }).addTo(layer);
      L.polyline(line.coords, {
        color: lane.color, weight: 3.5, opacity: 0.95, dashArray: '8 7', lineCap: 'butt',
      }).bindTooltip(`${escapeHtml(lane.name)}的路線`, { sticky: true }).addTo(layer);
    }
  }
  for (const lane of props.lanes) {
    lane.stops.forEach((s) => {
      const marker = L.marker([s.lat, s.lng], {
        icon: pinIcon(s, escapeHtml((lane.name || '?').slice(0, 1)), lane.color),
        draggable: true,
        autoPan: true,
        riseOnHover: true,
      });
      marker.bindTooltip(`<b>${escapeHtml(s.title)}</b><br><span style="color:#616161">${escapeHtml(lane.name)}</span>`, { direction: 'top' });
      marker.on('click', () => emit('select', s));
      marker.on('dragend', (e) => {
        const { lat, lng } = e.target.getLatLng();
        emit('move', s, { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) });
      });
      marker.addTo(layer);
      markers.set(s.id, marker);
    });
  }

  for (const g of groups) {
    g.stops.forEach((s, i) => {
      const marker = L.marker([s.lat, s.lng], {
        icon: pinIcon(s, g.numbered ? i + 1 : '備', g.color, g.backup),
        draggable: true,
        autoPan: true,
        riseOnHover: true,
        zIndexOffset: g.backup ? -1000 : 0, // 備選壓在行程地點下面
      });
      const time = s.startTime ? `${s.startTime}${s.endTime ? `–${s.endTime}` : ''}　` : '';
      marker.bindTooltip(`<b>${escapeHtml(s.title)}</b><br><span style="color:#616161">${escapeHtml(g.label)}　${time}</span>`, { direction: 'top' });
      marker.on('click', () => emit('select', s));
      marker.on('dragend', (e) => {
        const { lat, lng } = e.target.getLatLng();
        emit('move', s, { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) });
      });
      marker.addTo(layer);
      markers.set(s.id, marker);
    });
  }
}

function fit(animate = true) {
  if (!map) return;
  // 以行程中的地點為主；只有備選時才縮放到備選
  const groups = visibleGroups();
  const planned = [
    ...groups.filter((g) => !g.backup).flatMap((g) => g.stops.map((s) => [s.lat, s.lng])),
    ...props.lanes.flatMap((l) => l.stops.map((s) => [s.lat, s.lng])),
  ];
  const pts = planned.length ? planned : groups.flatMap((g) => g.stops.map((s) => [s.lat, s.lng]));
  if (!pts.length) map.setView(TAIWAN_CENTER, MIN_ZOOM, { animate });
  else if (pts.length === 1) map.setView(pts[0], 15, { animate });
  else map.fitBounds(pts, { padding: [56, 56], maxZoom: 16, animate });
}

function setBase(key) {
  const cfg = BASE_LAYERS.find((l) => l.key === key) || BASE_LAYERS[0];
  baseKey.value = cfg.key;
  localStorage.setItem('planner_map_base', cfg.key);
  if (tiles) tiles.remove();
  tiles = L.tileLayer(cfg.url, {
    attribution: cfg.attribution, maxZoom: 20, maxNativeZoom: cfg.maxNativeZoom, bounds: TAIWAN_BOUNDS,
  }).addTo(map);
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
    if (!inTaiwan(lat, lng)) {
      ui.toast('你目前不在台灣範圍內', 'error');
      return;
    }
    myLocation?.remove();
    myLocation = L.circleMarker([lat, lng], {
      radius: 8, color: '#fff', weight: 3, fillColor: '#0f6cbd', fillOpacity: 1,
    }).bindTooltip('我的位置').addTo(map);
    map.setView([lat, lng], 16);
  }, () => {
    locating.value = false;
    ui.toast('無法取得目前位置，請確認已允許定位權限', 'error');
  }, { enableHighAccuracy: true, timeout: 10000 });
}

onMounted(() => {
  // 地圖鎖定在台灣範圍內
  map = L.map(mapEl.value, {
    zoomControl: true,
    maxBounds: TAIWAN_BOUNDS,
    maxBoundsViscosity: 1,
    minZoom: MIN_ZOOM,
  }).setView(TAIWAN_CENTER, MIN_ZOOM);
  setBase(baseKey.value);
  // 道路路線（OSRM / Valhalla）、軌道與地點搜尋都使用 OpenStreetMap 資料（ODbL）
  map.attributionControl.addAttribution('路線與軌道 &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>');
  layer = L.layerGroup().addTo(map);
  render();
  fit(false); // 第一次直接顯示在正確位置
  // 容器大小改變（手機切換分頁、側欄收合）時重新計算
  observer = new ResizeObserver(() => map?.invalidateSize());
  observer.observe(mapEl.value);
});

onBeforeUnmount(() => {
  observer?.disconnect();
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
watch(() => props.focusStopId, (id) => {
  const m = markers.get(id);
  if (!m || !map) return;
  map.setView(m.getLatLng(), Math.max(map.getZoom(), 15), { animate: true });
  m.openTooltip();
});

defineExpose({ fit });
</script>

<style scoped>
.map-btn {
  width: 36px;
  height: 36px;
  border-radius: 4px;
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
:deep(.trip-leg-label) {
  background: none !important;
  border: 0 !important;
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
  transform: translate(-50%, -50%);
  pointer-events: none;
}
</style>
