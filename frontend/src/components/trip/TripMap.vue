<template>
  <div class="relative h-full w-full isolate">
    <div ref="mapEl" class="h-full w-full bg-[#e8eef3]" :class="picking ? 'trip-map-picking' : ''"></div>

    <div v-if="picking" class="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 rounded-full bg-[#323130] text-white text-sm pl-4 pr-1.5 py-1.5 card-shadow-hover whitespace-nowrap">
      <Icon name="locate" :size="16" />點選地圖上的位置來新增地點
      <button class="rounded-full bg-white/15 hover:bg-white/25 px-2.5 h-7 cursor-pointer" @click="$emit('cancel-pick')">取消</button>
    </div>

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
  categoryInfo, byStopOrder, UNSCHEDULED_COLOR, BASE_LAYERS, TAIWAN_BOUNDS, TAIWAN_CENTER, MIN_ZOOM, inTaiwan,
} from '@/utils/trip';

const props = defineProps({
  days: { type: Array, required: true }, // tripDays()
  stops: { type: Array, required: true },
  routes: { type: Object, default: () => ({}) }, // { [date]: { coords, legs } }
  routing: { type: Boolean, default: false },
  selectedDate: { type: String, default: null }, // null = 全部、'unscheduled' = 未排入
  picking: { type: Boolean, default: false },
  focusStopId: { type: Number, default: null },
});
const emit = defineEmits(['select', 'move', 'pick', 'cancel-pick']);

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

function pinIcon(stop, label, color) {
  return L.divIcon({
    className: 'trip-pin-wrap',
    html: `<div class="trip-pin" style="--pin:${color}">
      <span class="trip-pin-num">${label}</span>
      <span class="trip-pin-emoji">${categoryInfo(stop.category).emoji}</span>
    </div>`,
    iconSize: [34, 44],
    iconAnchor: [17, 42],
    tooltipAnchor: [0, -40],
  });
}

// 依目前篩選，整理出要顯示的每日路線
function visibleGroups() {
  const groups = [];
  const showAll = !props.selectedDate;
  for (const day of props.days) {
    if (!showAll && props.selectedDate !== day.date) continue;
    const list = props.stops.filter((s) => s.date === day.date).sort(byStopOrder);
    groups.push({
      key: day.date, color: day.color, label: day.title, stops: list, numbered: true, route: props.routes[day.date],
    });
  }
  if (showAll || props.selectedDate === 'unscheduled') {
    const list = props.stops.filter((s) => !s.date).sort(byStopOrder);
    groups.push({ key: 'unscheduled', color: UNSCHEDULED_COLOR, label: '未排入日期', stops: list, numbered: false });
  }
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
      const line = g.route?.coords?.length ? g.route.coords : points;
      L.polyline(line, { color: '#fff', weight: 8, opacity: 0.9 }).addTo(layer);
      L.polyline(line, {
        color: g.color, weight: 5, opacity: 0.95, dashArray: g.route ? null : '1 9', lineCap: 'round',
      }).addTo(layer);
    }
    prevLast = points[points.length - 1];
  }

  for (const g of groups) {
    g.stops.forEach((s, i) => {
      const marker = L.marker([s.lat, s.lng], {
        icon: pinIcon(s, g.numbered ? i + 1 : '·', g.color),
        draggable: true,
        autoPan: true,
        riseOnHover: true,
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
  const pts = visibleGroups().flatMap((g) => g.stops.map((s) => [s.lat, s.lng]));
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
  layer = L.layerGroup().addTo(map);
  map.on('click', (e) => {
    if (!props.picking) return;
    emit('pick', { lat: Number(e.latlng.lat.toFixed(6)), lng: Number(e.latlng.lng.toFixed(6)) });
  });
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
watch(() => props.days, render);
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
</style>
