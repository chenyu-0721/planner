import { addDays, diffDays, parseDate, sortOrderAt } from './planner';

// 地點類別（地圖圖標）
export const CATEGORIES = [
  { key: 'sight', label: '景點', emoji: '🏞️' },
  { key: 'food', label: '美食', emoji: '🍜' },
  { key: 'hotel', label: '住宿', emoji: '🏨' },
  { key: 'transport', label: '交通', emoji: '🚉' },
  { key: 'shopping', label: '購物', emoji: '🛍️' },
  { key: 'activity', label: '活動', emoji: '🎡' },
  { key: 'other', label: '其他', emoji: '📌' },
];
export const categoryInfo = (key) => CATEGORIES.find((c) => c.key === key) || CATEGORIES[0];

// 每天的路線顏色
export const DAY_COLORS = ['#0f6cbd', '#c239b3', '#ca5010', '#107c10', '#8764b8', '#038387', '#d13438', '#986f0b', '#004e8c', '#e3008c'];
export const UNSCHEDULED_COLOR = '#8a8886';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

// 行程的每一天
export function tripDays(trip) {
  if (!trip) return [];
  const n = diffDays(trip.endDate, trip.startDate) + 1;
  return Array.from({ length: Math.max(0, n) }, (_, i) => {
    const date = addDays(trip.startDate, i);
    const d = parseDate(date);
    return {
      date,
      index: i,
      color: DAY_COLORS[i % DAY_COLORS.length],
      title: `第 ${i + 1} 天`,
      subtitle: `${d.getMonth() + 1}/${d.getDate()}（週${WEEKDAYS[d.getDay()]}）`,
    };
  });
}

export function fmtTripRange(trip) {
  const s = parseDate(trip.startDate);
  const e = parseDate(trip.endDate);
  const days = diffDays(trip.endDate, trip.startDate) + 1;
  const end = s.getFullYear() === e.getFullYear() ? `${e.getMonth() + 1}/${e.getDate()}` : `${e.getFullYear()}/${e.getMonth() + 1}/${e.getDate()}`;
  return `${s.getFullYear()}/${s.getMonth() + 1}/${s.getDate()} – ${end}・${days} 天`;
}

export const byStopOrder = (a, b) => a.sortOrder - b.sortOrder || a.id - b.id;

// 兩點直線距離（公里）
export function distanceKm(a, b) {
  const R = 6371;
  const rad = (v) => (v * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export const fmtDistance = (km) => (km < 1 ? `${Math.round(km * 1000)} 公尺` : `${km.toFixed(km < 10 ? 1 : 0)} 公里`);

export const fmtCost = (v) => (v == null ? '' : `$${Number(v).toLocaleString()}`);

/**
 * 設定時間後，依時間把地點排到當天適當位置，回傳新的 sortOrder
 * 規則：排在第一個「時間比它晚」的地點前面；沒有的話排在最後一個有時間的地點後面
 */
export function sortOrderForTime(dayStops, stop, time) {
  const list = dayStops.filter((s) => s.id !== stop.id).sort(byStopOrder);
  if (!time) return stop.sortOrder;
  let index = list.findIndex((s) => s.startTime && s.startTime > time);
  if (index < 0) {
    const lastTimed = list.map((s) => !!s.startTime).lastIndexOf(true);
    index = lastTimed + 1;
  }
  return sortOrderAt(list, index);
}

/* ---------- 地圖範圍與底圖（鎖定台灣） ---------- */

// 台灣本島、澎湖、金門、馬祖、蘭嶼、綠島
export const TAIWAN_BOUNDS = [[21.6, 117.9], [26.6, 122.4]];
export const TAIWAN_CENTER = [23.7, 120.95];
export const MIN_ZOOM = 7;

const NLSC_ATTR = '&copy; <a href="https://maps.nlsc.gov.tw/" target="_blank">內政部國土測繪中心</a>';
export const BASE_LAYERS = [
  {
    key: 'emap',
    name: '臺灣通用電子地圖',
    url: 'https://wmts.nlsc.gov.tw/wmts/EMAP/default/GoogleMapsCompatible/{z}/{y}/{x}',
    attribution: NLSC_ATTR,
    maxNativeZoom: 19,
  },
  {
    key: 'photo',
    name: '衛星空照（正射影像）',
    url: 'https://wmts.nlsc.gov.tw/wmts/PHOTO2/default/GoogleMapsCompatible/{z}/{y}/{x}',
    attribution: NLSC_ATTR,
    maxNativeZoom: 19,
  },
  {
    key: 'osm',
    name: 'OpenStreetMap',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
    maxNativeZoom: 19,
  },
];

export const inTaiwan = (lat, lng) => lat >= TAIWAN_BOUNDS[0][0] && lat <= TAIWAN_BOUNDS[1][0]
  && lng >= TAIWAN_BOUNDS[0][1] && lng <= TAIWAN_BOUNDS[1][1];

/* ---------- 地點搜尋 ----------
 * 搜尋建議：Photon（OpenStreetMap 資料，允許邊打字邊搜尋），限定台灣範圍
 * 地圖點選取得地址：Nominatim（每秒最多 1 次）
 */
const PHOTON = 'https://photon.komoot.io/api/';
const NOMINATIM = 'https://nominatim.openstreetmap.org';

const withHao = (n) => (n ? (/[號号]$/.test(n) ? n : `${n}號`) : '');
const joinAddress = (...parts) => parts.filter(Boolean).filter((p, i, arr) => arr.indexOf(p) === i).join('');

export async function searchPlaces(query, signal) {
  const [[s, w], [n, e]] = TAIWAN_BOUNDS;
  const url = `${PHOTON}?q=${encodeURIComponent(query)}&limit=8&bbox=${w},${s},${e},${n}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('地點搜尋失敗，請稍後再試');
  const data = await res.json();
  return data.features
    .filter((f) => f.properties.countrycode === 'TW')
    .map((f) => {
      const p = f.properties;
      const [lng, lat] = f.geometry.coordinates;
      // 台灣地址：縣市 → 鄉鎮市區 → 路名門牌（省級名稱不顯示）
      const address = joinAddress(p.county, p.city, p.district, p.street, withHao(p.housenumber));
      return {
        title: p.name || joinAddress(p.street, withHao(p.housenumber)) || p.city || '新地點',
        address,
        lat,
        lng,
      };
    })
    .filter((r, i, arr) => arr.findIndex((x) => x.title === r.title && Math.abs(x.lat - r.lat) < 1e-4) === i);
}

let lastReverse = 0;
export async function reverseGeocode(lat, lng) {
  try {
    const wait = lastReverse + 1100 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastReverse = Date.now();
    const url = `${NOMINATIM}/reverse?format=jsonv2&zoom=18&addressdetails=1&accept-language=zh-TW&lat=${lat}&lon=${lng}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const r = await res.json();
    if (r.error) return null;
    const a = r.address || {};
    const address = joinAddress(a.county, a.city, a.town || a.suburb || a.city_district, a.road, withHao(a.house_number));
    return { title: r.name || joinAddress(a.road, withHao(a.house_number)) || '新地點', address: address || r.display_name };
  } catch {
    return null;
  }
}

/* ---------- 道路路線（OSRM，FOSSGIS 免費服務） ---------- */

export const TRAVEL_MODES = [
  { key: 'car', label: '開車', emoji: '🚗', profile: 'routed-car/route/v1/driving', gmaps: 'driving' },
  { key: 'bike', label: '騎車', emoji: '🚲', profile: 'routed-bike/route/v1/bike', gmaps: 'bicycling' },
  { key: 'foot', label: '步行', emoji: '🚶', profile: 'routed-foot/route/v1/foot', gmaps: 'walking' },
  { key: 'straight', label: '直線', emoji: '📏', profile: null, gmaps: 'driving' },
];
export const travelModeInfo = (key) => TRAVEL_MODES.find((m) => m.key === key) || TRAVEL_MODES[0];

const routeCache = new Map();

/**
 * 取得依序經過各點的道路路線
 * @returns {{ coords: [lat, lng][], legs: { distance: number, duration: number }[] } | null}
 */
export async function fetchRoute(mode, points) {
  const info = travelModeInfo(mode);
  if (!info.profile || points.length < 2) return null;
  const coordStr = points.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
  const key = `${mode}|${coordStr}`;
  if (routeCache.has(key)) return routeCache.get(key);
  const res = await fetch(`https://routing.openstreetmap.de/${info.profile}/${coordStr}?overview=full&geometries=geojson`);
  if (!res.ok) throw new Error('路線規劃失敗');
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes?.length) return null;
  const route = {
    coords: data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    legs: data.routes[0].legs.map((l) => ({ distance: l.distance / 1000, duration: l.duration })),
  };
  routeCache.set(key, route);
  return route;
}

export function fmtDuration(sec) {
  const m = Math.max(1, Math.round(sec / 60));
  if (m < 60) return `${m} 分`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} 小時 ${m % 60} 分` : `${h} 小時`;
}

/* ---------- Google 地圖連結（免費，不需要 API 金鑰） ---------- */

const ll = (p) => `${p.lat},${p.lng}`;
export const googlePlaceUrl = (stop) => `https://www.google.com/maps/search/?api=1&query=${ll(stop)}`;

// 當天路線導航（Google 地圖最多 9 個中途點）
export function googleDirectionsUrl(stops, mode) {
  if (stops.length < 2) return stops[0] ? googlePlaceUrl(stops[0]) : '';
  const list = stops.slice(0, 11);
  const params = new URLSearchParams({
    api: '1',
    origin: ll(list[0]),
    destination: ll(list[list.length - 1]),
    travelmode: travelModeInfo(mode).gmaps,
  });
  if (list.length > 2) params.set('waypoints', list.slice(1, -1).map(ll).join('|'));
  return `https://www.google.com/maps/dir/?${params}`;
}
