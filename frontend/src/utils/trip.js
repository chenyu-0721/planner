import { reactive } from 'vue';
import { addDays, diffDays, parseDate, sortOrderAt } from './planner';
import { cachedRailRoute, fetchRailRoute } from './railRoute';

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

// 自訂圖標（所有使用者共用，隨行程資料一起載入）
export const customCategories = reactive([]);
export function setCustomCategories(list) {
  customCategories.splice(0, customCategories.length, ...list);
}
/** 地點實際顯示的圖標：有自訂圖標用自訂，否則用內建類別 */
export function stopCategory(stop) {
  const c = stop.customCategoryId ? customCategories.find((x) => x.id === stop.customCategoryId) : null;
  return c ? { key: `custom-${c.id}`, label: c.label, emoji: c.emoji } : categoryInfo(stop.category);
}

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

// 備選：沒有日期（備選清單），或標記為某天的備選。備選不排序號、不連線、不計入時間與預算
export const isBackup = (s) => !s.date || !!s.isBackup;
export const isPlanned = (s) => !!s.date && !s.isBackup;

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
 * Photon（OpenStreetMap 資料，允許邊打字邊搜尋），限定台灣、以目前行程位置為中心排序。
 * lang=default：使用當地名稱（台灣即中文）。不指定時 Photon 會依瀏覽器語言回傳，
 * 但它不支援中文，會改用英文名稱（例如「Taipei 101」）。
 * 會順便去掉空白、全形，以及結尾的「店／餐廳」，多試一次。
 * OpenStreetMap 找不到的地方，可以貼上 Google 地圖的分享連結或座標（見下方 parse 函式）。
 */
const PHOTON = 'https://photon.komoot.io/api/';

const withHao = (n) => (n ? (/[號号]$/.test(n) ? n : `${n}號`) : '');
const joinAddress = (...parts) => parts.filter(Boolean).filter((p, i, arr) => arr.indexOf(p) === i).join('');

function searchVariants(query) {
  const half = query.trim().replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
  const compact = half.replace(/\s+/g, '');
  const stripped = compact.replace(/(分店|門市|旗艦店|店|餐廳)$/, '');
  return [...new Set([half, compact, stripped].filter((q) => q.length >= 2))].slice(0, 2);
}

async function photonSearch(query, signal, center) {
  const [[s, w], [n, e]] = TAIWAN_BOUNDS;
  let url = `${PHOTON}?q=${encodeURIComponent(query)}&limit=20&lang=default&bbox=${w},${s},${e},${n}`;
  if (center) url += `&lat=${center.lat.toFixed(4)}&lon=${center.lng.toFixed(4)}&location_bias_scale=0.3`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('地點搜尋失敗，請稍後再試');
  const data = await res.json();
  return (data.features || [])
    .filter((f) => f.properties?.countrycode === 'TW' && f.geometry?.coordinates)
    .map((f) => {
      const p = f.properties;
      const [lng, lat] = f.geometry.coordinates;
      const address = joinAddress(p.county, p.city, p.district, p.street, withHao(p.housenumber));
      return {
        title: p.name || joinAddress(p.street, withHao(p.housenumber)) || p.city || '新地點',
        address,
        lat,
        lng,
      };
    });
}

export async function searchPlaces(query, signal, center) {
  const variants = searchVariants(query);
  const batches = [];
  for (const variant of variants) {
    const rows = await photonSearch(variant, signal, center);
    batches.push(...rows);
    if (batches.length >= 8) break;
  }
  const unique = batches.filter((r, i, arr) => arr.findIndex((x) => x.title === r.title && Math.abs(x.lat - r.lat) < 1e-4) === i);
  // 行程附近（40 公里內）的結果排前面，其餘維持原本的相關度順序
  const NEAR_KM = 40;
  const near = center ? unique.filter((r) => distanceKm(center, r) <= NEAR_KM) : [];
  const far = center ? unique.filter((r) => distanceKm(center, r) > NEAR_KM) : unique;
  return [...near, ...far].slice(0, 8);
}

/* ---------- 貼上座標或 Google 地圖連結 ---------- */

// 「25.0339, 121.5645」這種座標
export function parseCoordinates(text) {
  const m = String(text).trim().match(/^(-?\d{1,2}\.\d+)\s*[,，\s]\s*(-?\d{2,3}\.\d+)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

const GOOGLE_URL = /^https?:\/\/((www\.|maps\.)?google\.[a-z.]+\/maps|maps\.google\.[a-z.]+\/?\?|maps\.app\.goo\.gl\/|goo\.gl\/maps\/|g\.co\/kgs\/)/i;
export const isGoogleMapsUrl = (text) => GOOGLE_URL.test(String(text).trim());
export const isShortGoogleUrl = (text) => /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl|g\.co)\//i.test(String(text).trim());

/**
 * 從 Google 地圖的完整網址讀出名稱與座標
 * 座標優先用地點本身的 !3d…!4d…，其次是畫面中心 @lat,lng，再其次是 q= / query= 參數
 * @returns {{ title: string, lat?: number, lng?: number } | null}
 */
export function placeFromGoogleUrl(url) {
  let text = String(url);
  try {
    text = decodeURIComponent(text);
  } catch {
    // 編碼不完整時用原字串
  }
  const pick = (re) => {
    const m = text.match(re);
    return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null;
  };
  const point = pick(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
    || pick(/[?&](?:q|query|ll|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/)
    || pick(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  const nameMatch = text.match(/\/place\/([^/@?]+)/) || text.match(/[?&](?:q|query)=([^&]+)/);
  let title = nameMatch ? nameMatch[1].replace(/\+/g, ' ').trim() : '';
  if (parseCoordinates(title)) title = '';
  if (!point && !title) return null;
  return { title: title || '新地點', ...(point || {}) };
}

/* ---------- 交通方式與路線 ----------
 * 道路類：沿實際道路規劃
 *   開車 / 腳踏車 / 步行：OSRM（routing.openstreetmap.de，FOSSGIS 免費服務）
 *   機車：Valhalla motor_scooter（valhalla1.openstreetmap.de），會避開國道、以機車速度估算
 * 軌道類（高鐵 / 火車 / 捷運）：沿 OpenStreetMap 免費軌道畫線。沒有班表，時間依軌道長度估算。
 * 查不到軌道時改畫直線，並提供 Google 地圖查班次
 */
export const TRAVEL_MODES = [
  // fallbackSpeed：查不到這種交通方式的路線、改用汽車道路估算時的時速
  { key: 'car', label: '開車', emoji: '🚗', kind: 'road', engine: 'osrm', profile: 'routed-car/route/v1/driving', gmaps: 'driving', fallbackSpeed: 45 },
  { key: 'scooter', label: '機車', emoji: '🛵', kind: 'road', engine: 'valhalla', costing: 'motor_scooter', gmaps: 'driving', fallbackSpeed: 32 },
  { key: 'bike', label: '腳踏車', emoji: '🚲', kind: 'road', engine: 'osrm', profile: 'routed-bike/route/v1/bike', gmaps: 'bicycling', fallbackSpeed: 15 },
  { key: 'foot', label: '步行', emoji: '🚶', kind: 'road', engine: 'osrm', profile: 'routed-foot/route/v1/foot', gmaps: 'walking', fallbackSpeed: 4.5 },
  // speed：直線後備的時速。trackSpeed：沿著軌道時的時速（含停靠）
  { key: 'hsr', label: '高鐵', emoji: '🚄', kind: 'rail', speed: 165, trackSpeed: 180, gmaps: 'transit' },
  { key: 'train', label: '火車', emoji: '🚆', kind: 'rail', speed: 60, trackSpeed: 80, gmaps: 'transit' },
  { key: 'mrt', label: '捷運', emoji: '🚇', kind: 'rail', speed: 25, trackSpeed: 34, gmaps: 'transit' },
  { key: 'straight', label: '直線', emoji: '📏', kind: 'line', gmaps: 'driving' },
];
// 行程預設只能選道路類與直線（高鐵 / 火車 / 捷運只用在單一路段）
export const DEFAULT_TRAVEL_MODES = TRAVEL_MODES.filter((m) => m.kind !== 'rail');
export const travelModeInfo = (key) => TRAVEL_MODES.find((m) => m.key === key) || TRAVEL_MODES[0];

// Valhalla 的路線使用 polyline（精度 6 位）編碼
function decodePolyline(str, precision = 6) {
  const factor = 10 ** precision;
  const coords = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const next = () => {
    let result = 0;
    let shift = 0;
    let byte;
    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (index < str.length) {
    lat += next();
    lng += next();
    coords.push([lat / factor, lng / factor]);
  }
  return coords;
}

/* ---------- 免費路線服務的保護：排隊、重試、記住結果 ----------
 * Valhalla 公用伺服器大約每秒只接受 1 個請求，同時送太多會回 429（太忙），
 * 而且一次查詢的總距離上限 200 公里；這兩個是機車路線有時出不來的主因。
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const queues = {
  valhalla: { tail: Promise.resolve(), gap: 1100 },
  osrm: { tail: Promise.resolve(), gap: 200 },
};
// 同一個服務一次只送一個請求，且間隔 gap 毫秒
function enqueue(engine, task) {
  const q = queues[engine];
  const run = q.tail.then(task);
  q.tail = run.catch(() => {}).then(() => sleep(q.gap));
  return run;
}

// 伺服器忙碌（429 / 5xx）、逾時或連線失敗時等一下再試，最多 3 次；其他錯誤（例如查不到路）直接回傳內容
async function requestJson(engine, url) {
  const delays = [0, 2500, 6000];
  for (let i = 0; ; i += 1) {
    if (delays[i]) await sleep(delays[i]);
    try {
      const res = await enqueue(engine, () => fetch(url, { signal: AbortSignal.timeout(20000) }));
      if (res.status === 429 || res.status >= 500) throw Object.assign(new Error('路線服務忙碌'), { retry: true });
      return await res.json();
    } catch (e) {
      const retry = e.retry || e.name === 'TimeoutError' || e.name === 'TypeError';
      if (!retry || i === delays.length - 1) throw e;
    }
  }
}

// 查過的路線記在瀏覽器（重新整理不必再查），最多 80 筆、14 天
const ROUTE_STORE = 'planner_route_cache_v1';
const ROUTE_STORE_MAX = 80;
const ROUTE_STORE_DAYS = 14;
const routeCache = new Map();

function encodePolyline(coords) {
  let out = '';
  let pLat = 0;
  let pLng = 0;
  const enc = (v) => {
    let n = v < 0 ? ~(v << 1) : v << 1;
    let str = '';
    while (n >= 0x20) {
      str += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
      n >>= 5;
    }
    return str + String.fromCharCode(n + 63);
  };
  for (const [lat, lng] of coords) {
    const a = Math.round(lat * 1e5);
    const b = Math.round(lng * 1e5);
    out += enc(a - pLat) + enc(b - pLng);
    pLat = a;
    pLng = b;
  }
  return out;
}
function readStore() {
  try {
    return JSON.parse(localStorage.getItem(ROUTE_STORE) || '{}') || {};
  } catch {
    return {};
  }
}
function writeStore(store) {
  try {
    localStorage.setItem(ROUTE_STORE, JSON.stringify(store));
  } catch {
    // 空間不足或無法使用瀏覽器儲存時略過，只用記憶體快取
  }
}
// route：{ coords?, legs: [{ distance, duration, coords? }] }
const packRoute = (r) => ({
  c: r.coords ? encodePolyline(r.coords) : undefined,
  l: r.legs.map((l) => [l.distance, l.duration, l.coords ? encodePolyline(l.coords) : 0]),
});
const unpackRoute = (x) => ({
  coords: x.c ? decodePolyline(x.c, 5) : undefined,
  legs: x.l.map(([distance, duration, c]) => ({ distance, duration, coords: c ? decodePolyline(c, 5) : undefined })),
});

async function cachedRoute(key, request) {
  if (routeCache.has(key)) return routeCache.get(key);
  const store = readStore();
  const hit = store[key];
  if (hit && Date.now() - hit.t < ROUTE_STORE_DAYS * 86400000) {
    const route = unpackRoute(hit);
    routeCache.set(key, route);
    return route;
  }
  const route = await request();
  routeCache.set(key, route); // 查不到（null）也記在記憶體，避免同一頁一直重查
  if (route) {
    const next = readStore();
    next[key] = { t: Date.now(), ...packRoute(route) };
    const keys = Object.keys(next);
    if (keys.length > ROUTE_STORE_MAX) keys.sort((a, b) => next[a].t - next[b].t).slice(0, keys.length - ROUTE_STORE_MAX).forEach((k) => delete next[k]);
    writeStore(next);
  }
  return route;
}
const pointsKey = (points) => points.map((p) => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`).join(';');

// Valhalla：回傳每一段各自的路線（查不到時回傳 null）
function valhallaRoute(costing, points) {
  return cachedRoute(`v|${costing}|${pointsKey(points)}`, async () => {
    const body = {
      locations: points.map((p) => ({ lat: p.lat, lon: p.lng })),
      costing,
      directions_options: { units: 'kilometers' },
    };
    const data = await requestJson('valhalla', `https://valhalla1.openstreetmap.de/route?json=${encodeURIComponent(JSON.stringify(body))}`);
    if (!data.trip?.legs?.length) return null; // 例如離島沒有道路、超過距離上限
    return { legs: data.trip.legs.map((l) => ({ distance: l.summary.length, duration: l.summary.time, coords: decodePolyline(l.shape) })) };
  });
}

// OSRM：整段一條線，加上每段的距離與時間
function osrmRoute(profile, points) {
  return cachedRoute(`o|${profile}|${pointsKey(points)}`, async () => {
    const coordStr = points.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
    const data = await requestJson('osrm', `https://routing.openstreetmap.de/${profile}/${coordStr}?overview=full&geometries=geojson`);
    if (data.code !== 'Ok' || !data.routes?.length) return null;
    return {
      coords: data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      legs: data.routes[0].legs.map((l) => ({ distance: l.distance / 1000, duration: l.duration })),
    };
  });
}

// Valhalla 一次查詢總長不能超過 200 公里：依直線距離把連續的點分段（每段約 120 公里以內）
function chunkByDistance(points, maxKm = 120) {
  const chunks = [];
  let startIdx = 0;
  let km = 0;
  for (let i = 1; i < points.length; i += 1) {
    const d = distanceKm(points[i - 1], points[i]);
    if (i - 1 > startIdx && km + d > maxKm) {
      chunks.push([startIdx, i - 1]);
      startIdx = i - 1;
      km = 0;
    }
    km += d;
  }
  chunks.push([startIdx, points.length - 1]);
  return chunks;
}

/**
 * 依序經過各點的道路路線（同一種道路交通方式）
 * 機車（Valhalla）分段查詢；仍查不到的段改用汽車道路、以該交通方式的速度估算時間；連汽車都到不了（例如離島）才畫直線
 * @returns {{ lines: { mode, coords }[], legs: { mode, distance, duration, estimated, approx?, failed? }[] }}
 */
async function routeRoadRun(mode, points) {
  const info = travelModeInfo(mode);
  const n = points.length - 1;
  const legs = new Array(n).fill(null);
  let wholeLine = null;
  const safe = (promise) => promise.catch(() => null);

  if (info.engine === 'valhalla') {
    for (const [a, b] of chunkByDistance(points)) {
      const r = await safe(valhallaRoute(info.costing, points.slice(a, b + 1)));
      if (r) {
        r.legs.forEach((l, k) => { legs[a + k] = l; });
      } else if (b - a > 1) {
        // 整段查不到時一段一段查，只有真的不通的那段才改用其他方式
        for (let k = a; k < b; k += 1) {
          const one = await safe(valhallaRoute(info.costing, [points[k], points[k + 1]]));
          if (one) [legs[k]] = one.legs;
        }
      }
    }
  } else {
    const r = await safe(osrmRoute(info.profile, points));
    if (r) {
      wholeLine = r.coords;
      r.legs.forEach((l, k) => { legs[k] = l; });
    }
  }

  // 查不到的段：改用汽車道路估算（本身就是開車就不重試）
  if (mode !== 'car') {
    const car = travelModeInfo('car');
    for (let k = 0; k < n; k += 1) {
      if (legs[k]) continue;
      const r = await safe(osrmRoute(car.profile, [points[k], points[k + 1]]));
      if (!r) continue;
      const distance = r.legs[0].distance;
      legs[k] = { distance, duration: (distance / info.fallbackSpeed) * 3600, coords: r.coords, approx: true };
      wholeLine = null; // 混用不同來源時改為逐段畫線
    }
  }

  const straight = (k) => [points[k], points[k + 1]].map((pt) => [pt.lat, pt.lng]);
  const lines = wholeLine && legs.every(Boolean)
    ? [{ mode, coords: wholeLine }]
    : legs.map((l, k) => (l?.coords ? { mode, coords: l.coords } : { mode: 'straight', coords: straight(k) }));
  return {
    lines,
    legs: legs.map((l, k) => (l
      ? { mode, distance: l.distance, duration: l.duration, estimated: !!l.approx, approx: !!l.approx }
      : { mode, distance: distanceKm(points[k], points[k + 1]), duration: null, failed: true })),
  };
}

/** 取得依序經過各點的道路路線（舊介面，保留給其他地方使用） */
export async function fetchRoute(mode, points) {
  const info = travelModeInfo(mode);
  if (info.kind !== 'road' || points.length < 2) return null;
  const r = await routeRoadRun(mode, points);
  if (r.legs.some((l) => l.failed)) return null;
  return { coords: r.lines.flatMap((l) => l.coords), legs: r.legs.map(({ distance, duration }) => ({ distance, duration })) };
}

/**
 * 規劃一天的路線：每一段可有不同交通方式（地點的 arriveMode，空值用行程預設）
 * 連續相同的道路類交通方式會合併成一次查詢
 * @returns {{
 *   lines: { mode: string, coords: [lat, lng][] }[],   // 地圖上要畫的線
 *   legs: { mode, distance, duration, estimated, approx, failed }[], // 每一段（第 i 段 = 第 i 個地點 → 第 i+1 個）
 * } | null}
 */
export async function planDayRoute(stops, defaultMode) {
  if (stops.length < 2) return null;
  const segs = stops.slice(1).map((to, i) => ({ from: stops[i], to, mode: to.arriveMode || defaultMode }));

  const runs = [];
  segs.forEach((seg, i) => {
    const last = runs[runs.length - 1];
    if (travelModeInfo(seg.mode).kind === 'road' && last?.mode === seg.mode && last.end === i) {
      last.segs.push(seg);
      last.end = i + 1;
    } else {
      runs.push({ mode: seg.mode, segs: [seg], start: i, end: i + 1 });
    }
  });

  await Promise.all(runs.map(async (run) => {
    const info = travelModeInfo(run.mode);
    const straightLeg = (seg) => [seg.from, seg.to].map((p) => [p.lat, p.lng]);
    if (info.kind === 'road') {
      const r = await routeRoadRun(run.mode, [run.segs[0].from, ...run.segs.map((seg) => seg.to)]);
      run.lines = r.lines;
      run.legs = r.legs;
      return;
    }
    if (info.kind === 'rail') {
      // 先用直線估時，軌道改由 upgradeRailLegs 在背景補上，避免整段行程卡住
      const lines = [];
      const legs = [];
      run.segs.forEach((seg, j) => {
        const straightKm = distanceKm(seg.from, seg.to);
        const routed = cachedRailRoute(run.mode, seg.from, seg.to);
        const segIndex = run.start + j;
        if (routed) {
          lines.push({ mode: run.mode, coords: routed.coords, segIndex });
          legs.push({
            mode: run.mode,
            distance: routed.distance,
            duration: (routed.distance / (info.trackSpeed || info.speed)) * 3600,
            estimated: true,
            alongTrack: true,
            coords: routed.coords,
          });
          return;
        }
        lines.push({ mode: run.mode, coords: straightLeg(seg), segIndex });
        legs.push({
          mode: run.mode,
          distance: straightKm,
          duration: (straightKm / info.speed) * 3600,
          estimated: true,
          alongTrack: false,
        });
      });
      run.lines = lines;
      run.legs = legs;
      return;
    }
    run.lines = run.segs.map((seg) => ({ mode: run.mode, coords: straightLeg(seg) }));
    run.legs = run.segs.map((seg) => ({ mode: run.mode, distance: distanceKm(seg.from, seg.to), duration: null, estimated: false }));
  }));

  return { lines: runs.flatMap((r) => r.lines), legs: runs.flatMap((r) => r.legs) };
}

/** 背景補上軌道。每一段完成就呼叫 onLeg，呼叫端可先顯示直線。 */
export function upgradeRailLegs(stops, defaultMode, onLeg) {
  if (stops.length < 2) return Promise.resolve();
  const jobs = stops.slice(1).flatMap((to, index) => {
    const mode = to.arriveMode || defaultMode;
    if (travelModeInfo(mode).kind !== 'rail' || cachedRailRoute(mode, stops[index], to)) return [];
    return [{ index, from: stops[index], to, mode }];
  });
  // 免費的軌道服務偶爾忙碌：失敗時等一下再試，最多 3 次
  const fetchWithRetry = async (job) => {
    const delays = [0, 6000, 15000];
    for (let i = 0; i < delays.length; i += 1) {
      if (delays[i]) await new Promise((r) => setTimeout(r, delays[i]));
      try {
        return await fetchRailRoute(job.mode, job.from, job.to);
      } catch (e) {
        if (i === delays.length - 1) throw e;
      }
    }
    return null;
  };
  return Promise.all(jobs.map(async (job) => {
    try {
      const routed = await fetchWithRetry(job);
      if (!routed) return;
      const info = travelModeInfo(job.mode);
      onLeg(job.index, {
        mode: job.mode,
        distance: routed.distance,
        duration: (routed.distance / (info.trackSpeed || info.speed)) * 3600,
        estimated: true,
        alongTrack: true,
        coords: routed.coords,
      });
    } catch {
      // 軌道服務忙碌時保留直線
    }
  }));
}

export function fmtDuration(sec) {
  const m = Math.max(1, Math.round(sec / 60));
  if (m < 60) return `${m} 分`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} 小時 ${m % 60} 分` : `${h} 小時`;
}

/* ---------- Google 地圖連結（免費，不需要 API 金鑰） ---------- */

const ll = (p) => `${p.lat},${p.lng}`;
// 只用座標時 Google 地圖只會放一個圖釘，不會選到店家；改成「在這個座標附近搜尋地點名稱」，就會直接開到那間店
const GENERIC_TITLES = /^(座標位置|新地點|地點|未命名)$/;
export function googlePlaceUrl(stop) {
  const name = String(stop.title || '').trim();
  if (!name || GENERIC_TITLES.test(name)) return `https://www.google.com/maps/search/?api=1&query=${ll(stop)}`;
  return `https://www.google.com/maps/search/${encodeURIComponent(name)}/@${ll(stop)},17z`;
}

// 單一路段（高鐵 / 火車 / 捷運會用大眾運輸，可查實際班次）
export function googleSegmentUrl(from, to, mode) {
  const params = new URLSearchParams({
    api: '1', origin: ll(from), destination: ll(to), travelmode: travelModeInfo(mode).gmaps,
  });
  return `https://www.google.com/maps/dir/?${params}`;
}

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

/* ---------- 自動排時間 ---------- */

// 各類地點預設停留時間（分鐘）。住宿 0 = 只記抵達／出發時間
export const DEFAULT_STAY = { sight: 90, food: 60, hotel: 0, transport: 15, shopping: 60, activity: 120, other: 60 };
const DAY_END = 24 * 60 - 1;
const STRAIGHT_SPEED = 40; // 沒有道路時間時（直線、規劃失敗）用的估算時速，距離再乘 1.3 當作繞路

export const timeToMin = (t) => (t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : null);
export const minToTime = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** 某一段的交通時間（秒）；沒有道路／軌道時間時以直線距離估算 */
export function legSeconds(leg, from, to) {
  if (leg?.duration) return leg.duration;
  const km = leg && !leg.failed && leg.distance ? leg.distance : distanceKm(from, to) * 1.3;
  return (km / STRAIGHT_SPEED) * 3600;
}

/**
 * 依出發時間、交通時間與停留時間，算出每個地點的開始／結束時間
 * @param {object[]} dayStops 當天地點（已排序）
 * @param {object[]} legs 當天路段（第 i 段 = 第 i 個地點 → 第 i+1 個），可為空
 * @param {{ start: string, buffer: number, keepStay: boolean, stays: object }} options
 * @returns {{ stop, travel: number|null, startTime: string|null, endTime: string|null, overflow: boolean }[]}
 */
export function planSchedule(dayStops, legs, { start, buffer = 0, keepStay = true, stays = DEFAULT_STAY }) {
  let t = timeToMin(start) ?? 9 * 60;
  let overflow = false;
  return dayStops.map((stop, i) => {
    let travel = null;
    if (i > 0) {
      travel = Math.ceil(legSeconds(legs?.[i - 1], dayStops[i - 1], stop) / 60);
      t = Math.ceil((t + travel + buffer) / 5) * 5; // 抵達時間取到 5 分鐘
    }
    const own = timeToMin(stop.endTime) - timeToMin(stop.startTime);
    const stay = keepStay && stop.startTime && stop.endTime && own > 0 ? own : (stays[stop.category] ?? 60);
    if (overflow || t > DAY_END) {
      overflow = true;
      return { stop, travel, startTime: null, endTime: null, overflow };
    }
    const row = { stop, travel, startTime: minToTime(t), endTime: stay > 0 ? minToTime(Math.min(DAY_END, t + stay)) : null, overflow: false };
    t += stay;
    return row;
  });
}

/* ---------- 最佳順序 ----------
 * 用 OSRM table（同一個免費路線服務）取得各地點之間的道路行車時間，再找出總時間最短的順序。
 * 起點固定為當天第一個地點，可選擇終點也固定（例如最後回到住宿）。
 */
const TABLE_PROFILES = {
  car: 'routed-car/table/v1/driving',
  scooter: 'routed-car/table/v1/driving', // Valhalla 的矩陣服務限制較多，機車用汽車道路時間比較順序即可
  bike: 'routed-bike/table/v1/bike',
  foot: 'routed-foot/table/v1/foot',
};
const MAX_TABLE_POINTS = 25;

const straightMatrix = (points) => points.map((a) => points.map((b) => ((distanceKm(a, b) * 1.3) / STRAIGHT_SPEED) * 3600));

/**
 * 各點之間的移動時間矩陣（秒）
 * @returns {Promise<{ durations: number[][], byRoad: boolean }>}
 */
export async function travelMatrix(mode, points, signal) {
  const profile = TABLE_PROFILES[mode];
  if (profile && points.length <= MAX_TABLE_POINTS) {
    try {
      const coordStr = points.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
      const res = await fetch(`https://routing.openstreetmap.de/${profile}/${coordStr}?annotations=duration`, { signal });
      const data = res.ok ? await res.json() : null;
      if (data?.code === 'Ok' && data.durations) {
        // 到不了的組合（例如離島）以直線估算補上
        const fallback = straightMatrix(points);
        return { durations: data.durations.map((row, i) => row.map((v, j) => v ?? fallback[i][j] * 3)), byRoad: true };
      }
    } catch (e) {
      if (e.name === 'AbortError') throw e;
    }
  }
  return { durations: straightMatrix(points), byRoad: false };
}

export const orderCost = (matrix, order) => order.slice(1).reduce((sum, j, k) => sum + matrix[order[k]][j], 0);

// 動態規劃求精確解（地點少時）。起點 0；fixEnd 時終點為最後一個
function exactOrder(matrix, fixEnd) {
  const n = matrix.length;
  const end = fixEnd ? n - 1 : -1;
  const mids = [];
  for (let i = 1; i < n; i += 1) if (i !== end) mids.push(i);
  const m = mids.length;
  const full = (1 << m) - 1;
  const cost = Array.from({ length: 1 << m }, () => new Float64Array(m).fill(Infinity));
  const from = Array.from({ length: 1 << m }, () => new Int8Array(m).fill(-1));
  for (let k = 0; k < m; k += 1) cost[1 << k][k] = matrix[0][mids[k]];
  for (let mask = 1; mask <= full; mask += 1) {
    for (let k = 0; k < m; k += 1) {
      const c = cost[mask][k];
      if (!(mask & (1 << k)) || c === Infinity) continue;
      for (let nk = 0; nk < m; nk += 1) {
        if (mask & (1 << nk)) continue;
        const next = mask | (1 << nk);
        const v = c + matrix[mids[k]][mids[nk]];
        if (v < cost[next][nk]) {
          cost[next][nk] = v;
          from[next][nk] = k;
        }
      }
    }
  }
  let bestK = 0;
  let best = Infinity;
  for (let k = 0; k < m; k += 1) {
    const v = cost[full][k] + (fixEnd ? matrix[mids[k]][end] : 0);
    if (v < best) {
      best = v;
      bestK = k;
    }
  }
  const order = [];
  let mask = full;
  for (let k = bestK; k >= 0;) {
    order.push(mids[k]);
    const prev = from[mask][k];
    mask &= ~(1 << k);
    k = prev;
  }
  return [0, ...order.reverse(), ...(fixEnd ? [end] : [])];
}

// 地點多時：最近鄰居法 + 2-opt 改善
function heuristicOrder(matrix, fixEnd) {
  const n = matrix.length;
  const end = fixEnd ? n - 1 : -1;
  const left = new Set([...Array(n).keys()].filter((i) => i !== 0 && i !== end));
  const order = [0];
  while (left.size) {
    const cur = order[order.length - 1];
    let next = null;
    for (const j of left) if (next === null || matrix[cur][j] < matrix[cur][next]) next = j;
    order.push(next);
    left.delete(next);
  }
  if (fixEnd) order.push(end);
  const last = fixEnd ? n - 2 : n - 1;
  for (let improved = true, round = 0; improved && round < 50; round += 1) {
    improved = false;
    for (let i = 1; i < last; i += 1) {
      for (let k = i + 1; k <= last; k += 1) {
        const candidate = [...order.slice(0, i), ...order.slice(i, k + 1).reverse(), ...order.slice(k + 1)];
        if (orderCost(matrix, candidate) < orderCost(matrix, order) - 1) {
          order.splice(0, n, ...candidate);
          improved = true;
        }
      }
    }
  }
  return order;
}

/** 總移動時間最短的順序（回傳原陣列的索引） */
export function bestOrder(matrix, { fixEnd = false } = {}) {
  const n = matrix.length;
  if (n <= 2 || (fixEnd && n <= 3)) return [...Array(n).keys()];
  return n <= 13 ? exactOrder(matrix, fixEnd) : heuristicOrder(matrix, fixEnd);
}

/* ---------- 預算 ----------
 * 地點的「預估花費」依地點類別歸類；路段的「交通費」（記在抵達的地點上）一律算交通
 */
export const BUDGET_GROUPS = [
  { key: 'transport', label: '交通', emoji: '🚆', color: '#0f6cbd', categories: ['transport'] },
  { key: 'hotel', label: '住宿', emoji: '🏨', color: '#8764b8', categories: ['hotel'] },
  { key: 'food', label: '餐飲', emoji: '🍜', color: '#ca5010', categories: ['food'] },
  { key: 'ticket', label: '門票・活動', emoji: '🎟️', color: '#107c10', categories: ['sight', 'activity'] },
  { key: 'shopping', label: '購物', emoji: '🛍️', color: '#c239b3', categories: ['shopping'] },
  { key: 'other', label: '其他', emoji: '📌', color: '#8a8886', categories: ['other'] },
];
export const budgetGroupOf = (category) => BUDGET_GROUPS.find((g) => g.categories.includes(category)) || BUDGET_GROUPS[BUDGET_GROUPS.length - 1];

/** 某地點的花費合計（地點花費 + 到這裡的交通費） */
export const stopTotal = (s) => (s.cost || 0) + (s.arriveCost || 0);

/**
 * 依類別、日期與成員加總（只算已排入行程的地點；備選另外加總，不算進總額）
 * 分頭路線（各自出發 / 回程）的花費算在該成員身上，其餘為共同花費（平分）
 * @returns {{
 *   total, shared, groups: { ...group, amount, items: { id, label, sub, amount, fare? }[] }[],
 *   days: { date, title, subtitle, color, amount }[], backup: number, personal: Record<number, number>,
 * }}
 */
export function computeBudget(stops, days, members = []) {
  const groups = BUDGET_GROUPS.map((g) => ({ ...g, amount: 0, items: [] }));
  const byKey = Object.fromEntries(groups.map((g) => [g.key, g]));
  const dayList = days.map((d) => ({ date: d.date, title: d.title, subtitle: d.subtitle, color: d.color, amount: 0 }));
  const dayOf = Object.fromEntries(dayList.map((d) => [d.date, d]));
  const nameOf = Object.fromEntries(members.map((m) => [m.id, m.displayName]));
  const backup = stops.filter(isBackup).reduce((sum, s) => sum + stopTotal(s), 0);
  const personal = {};

  const addCost = (s, sub) => {
    if (!s.cost) return;
    const g = byKey[budgetGroupOf(s.category).key];
    g.amount += s.cost;
    g.items.push({ id: s.id, label: `${stopCategory(s).emoji} ${s.title}`, sub, amount: s.cost });
  };
  const addFare = (s, from, to, sub) => {
    if (!s.arriveCost) return;
    const mode = s.arriveMode ? travelModeInfo(s.arriveMode) : null;
    byKey.transport.amount += s.arriveCost;
    byKey.transport.items.push({
      id: s.id, label: `${mode ? mode.emoji : '🧭'} ${from} → ${to}`, sub: `${sub}${mode ? `・${mode.label}` : ''}`, amount: s.arriveCost, fare: true,
    });
  };

  // 共同行程
  const shared = stops.filter(isShared).sort((a, b) => a.date.localeCompare(b.date) || byStopOrder(a, b));
  shared.forEach((s, i) => {
    const day = dayOf[s.date];
    const when = day ? day.title : s.date;
    addCost(s, when);
    const prev = shared[i - 1];
    addFare(s, prev?.date ? prev.title : '上一站', s.title, when); // 當天第一站接前一天的最後一站
    if (day) day.amount += stopTotal(s);
  });

  // 分頭路線：花費算在成員身上
  for (const lane of groupLanes(stops, members)) {
    const day = dayOf[lane.date];
    const ofDay = shared.filter((x) => x.date === lane.date);
    const meeting = lane.phase === 'depart' ? ofDay[0] : ofDay[ofDay.length - 1];
    const who = nameOf[lane.memberId] || '成員';
    const sub = `${day ? day.title : lane.date}・${who}`;
    lane.stops.forEach((s, i) => {
      addCost(s, sub);
      if (lane.phase === 'depart') addFare(s, s.title, lane.stops[i + 1]?.title || meeting?.title || '會合點', sub);
      else addFare(s, lane.stops[i - 1]?.title || meeting?.title || '出發點', s.title, sub);
      personal[lane.memberId] = (personal[lane.memberId] || 0) + stopTotal(s);
      if (day) day.amount += stopTotal(s);
    });
  }

  groups.forEach((g) => g.items.sort((a, b) => b.amount - a.amount));
  const total = groups.reduce((sum, g) => sum + g.amount, 0);
  return {
    total, shared: total - Object.values(personal).reduce((a, b) => a + b, 0), groups, days: dayList, backup, personal,
  };
}

/* ---------- 分頭路線（各自出發 / 各自回程） ----------
 * 屬於某位成員的地點（memberId + phase），用在大家從不同地方出發、或散場後各自回家。
 * depart：成員的地點依序走到當天第一個共同地點（會合點）；地點的 arriveMode / arriveCost 代表「從這裡前往下一站」。
 * return：從當天最後一個共同地點出發，依序走到成員的地點；arriveMode / arriveCost 代表「到達這裡」。
 * 兩種情況下，每個成員地點都「擁有」一段交通，設定交通方式與交通費都記在它身上。
 */
export const LANE_PHASES = [
  { key: 'depart', label: '各自出發' },
  { key: 'return', label: '各自回程' },
];
export const isShared = (s) => isPlanned(s) && !s.memberId;
const LANE_BUFFER = 10; // 每段轉乘、等車預留（分鐘）

/** 規劃路線用的地點序列（含會合點），每個元素的 arriveMode 是「到達它」的交通 */
export function laneSequence(phase, laneStops, meeting) {
  if (phase === 'depart') {
    const seq = laneStops.map((s, i) => ({ ...s, arriveMode: i ? laneStops[i - 1].arriveMode : null }));
    if (meeting && laneStops.length) seq.push({ ...meeting, arriveMode: laneStops[laneStops.length - 1].arriveMode || null });
    return seq;
  }
  return meeting ? [{ ...meeting, arriveMode: null }, ...laneStops] : laneStops;
}

/** 序列中第 i 段（seq[i] → seq[i+1]）屬於哪個成員地點 */
export const laneLegOwner = (phase, laneStops, hasMeeting, i) => laneStops[phase === 'return' && !hasMeeting ? i + 1 : i];

/**
 * 估算時間（分鐘，null = 無法估算）
 * depart：從會合點的開始時間往回推，times[i] = 從 seq[i] 出發的時間
 * return：從會合點的結束（或開始）時間往後推，times[i] = 抵達 seq[i] 的時間
 */
export function laneTimes(phase, seq, legs, meeting) {
  const times = seq.map(() => null);
  const n = seq.length;
  if (!meeting || n < 2) return times;
  const secOf = (i) => legSeconds(legs?.[i], seq[i], seq[i + 1]);
  if (phase === 'depart') {
    let t = timeToMin(meeting.startTime);
    if (t == null) return times;
    times[n - 1] = t;
    for (let i = n - 2; i >= 0; i -= 1) {
      t -= Math.ceil(secOf(i) / 60) + LANE_BUFFER;
      times[i] = Math.floor(t / 5) * 5;
    }
    return times;
  }
  let t = timeToMin(meeting.endTime) ?? timeToMin(meeting.startTime);
  if (t == null) return times;
  times[0] = t;
  for (let i = 0; i < n - 1; i += 1) {
    t += Math.ceil(secOf(i) / 60) + LANE_BUFFER;
    times[i + 1] = Math.ceil(t / 5) * 5;
  }
  return times;
}

/** 一段路的顯示文字（主行程與分頭路線共用） */
export function segmentInfo(modeKey, custom, leg, from, to, fare) {
  const info = travelModeInfo(modeKey);
  const straight = fmtDistance(distanceKm(from, to));
  let r;
  if (!leg) r = { detail: '計算路線中…' };
  else if (info.kind === 'line') r = { detail: `直線 ${straight}` };
  else if (leg.failed) r = { detail: `查不到道路（離島可能要搭船），以直線顯示 ${straight}`, failed: true };
  else if (leg.approx) r = { detail: `約 ${fmtDuration(leg.duration)} · ${fmtDistance(leg.distance)}（${info.label}路線暫時查不到，以汽車道路估算）` };
  else if (info.kind === 'rail') r = { detail: `約 ${fmtDuration(leg.duration)} · ${leg.alongTrack ? `軌道 ${fmtDistance(leg.distance)}` : `直線 ${straight}`}` };
  else r = { detail: `${fmtDuration(leg.duration)} · ${fmtDistance(leg.distance)}` };
  return {
    info, custom, failed: !!r.failed, detail: fare ? `${r.detail} · ${fmtCost(fare)}` : r.detail,
  };
}

/** 把行程地點整理成每天、每位成員、每個階段的分頭路線 */
export function groupLanes(stops, members) {
  const order = new Map(members.map((m, i) => [m.id, i]));
  const map = new Map();
  for (const s of stops) {
    if (!isPlanned(s) || !s.memberId) continue;
    const key = `${s.date}|${s.memberId}|${s.phase}`;
    if (!map.has(key)) map.set(key, { key, date: s.date, memberId: s.memberId, phase: s.phase, stops: [] });
    map.get(key).stops.push(s);
  }
  const lanes = [...map.values()];
  lanes.forEach((l) => l.stops.sort(byStopOrder));
  return lanes.sort((a, b) => (order.get(a.memberId) ?? 99) - (order.get(b.memberId) ?? 99));
}
