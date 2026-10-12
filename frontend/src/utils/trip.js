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
  { key: 'car', label: '開車', emoji: '🚗', kind: 'road', engine: 'osrm', profile: 'routed-car/route/v1/driving', gmaps: 'driving' },
  { key: 'scooter', label: '機車', emoji: '🛵', kind: 'road', engine: 'valhalla', costing: 'motor_scooter', gmaps: 'driving' },
  { key: 'bike', label: '腳踏車', emoji: '🚲', kind: 'road', engine: 'osrm', profile: 'routed-bike/route/v1/bike', gmaps: 'bicycling' },
  { key: 'foot', label: '步行', emoji: '🚶', kind: 'road', engine: 'osrm', profile: 'routed-foot/route/v1/foot', gmaps: 'walking' },
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

const routeCache = new Map();

/**
 * 取得依序經過各點的道路路線
 * @returns {{ coords: [lat, lng][], legs: { distance: number, duration: number }[] } | null}
 */
export async function fetchRoute(mode, points) {
  const info = travelModeInfo(mode);
  if (info.kind !== 'road' || points.length < 2) return null;
  const key = `${mode}|${points.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';')}`;
  if (routeCache.has(key)) return routeCache.get(key);

  let route;
  if (info.engine === 'valhalla') {
    const body = {
      locations: points.map((p) => ({ lat: p.lat, lon: p.lng })),
      costing: info.costing,
      directions_options: { units: 'kilometers' },
    };
    const res = await fetch(`https://valhalla1.openstreetmap.de/route?json=${encodeURIComponent(JSON.stringify(body))}`);
    if (!res.ok) throw new Error('路線規劃失敗');
    const data = await res.json();
    if (!data.trip?.legs?.length) return null;
    route = {
      coords: data.trip.legs.flatMap((l) => decodePolyline(l.shape)),
      legs: data.trip.legs.map((l) => ({ distance: l.summary.length, duration: l.summary.time })),
    };
  } else {
    const coordStr = points.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
    const res = await fetch(`https://routing.openstreetmap.de/${info.profile}/${coordStr}?overview=full&geometries=geojson`);
    if (!res.ok) throw new Error('路線規劃失敗');
    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes?.length) return null;
    route = {
      coords: data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      legs: data.routes[0].legs.map((l) => ({ distance: l.distance / 1000, duration: l.duration })),
    };
  }
  routeCache.set(key, route);
  return route;
}

/**
 * 規劃一天的路線：每一段可有不同交通方式（地點的 arriveMode，空值用行程預設）
 * 連續相同的道路類交通方式會合併成一次查詢
 * @returns {{
 *   lines: { mode: string, coords: [lat, lng][] }[],   // 地圖上要畫的線
 *   legs: { mode, distance, duration, estimated, failed }[], // 每一段（第 i 段 = 第 i 個地點 → 第 i+1 個）
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
      try {
        const route = await fetchRoute(run.mode, [run.segs[0].from, ...run.segs.map((seg) => seg.to)]);
        if (route) {
          run.lines = [{ mode: run.mode, coords: route.coords }];
          run.legs = route.legs.map((l) => ({ mode: run.mode, ...l, estimated: false }));
          return;
        }
      } catch {
        // 路線服務失敗時以直線顯示
      }
      run.lines = run.segs.map((seg) => ({ mode: 'straight', coords: straightLeg(seg) }));
      run.legs = run.segs.map((seg) => ({ mode: run.mode, distance: distanceKm(seg.from, seg.to), duration: null, failed: true }));
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
export const googlePlaceUrl = (stop) => `https://www.google.com/maps/search/?api=1&query=${ll(stop)}`;

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
 * 依類別與日期加總（只算已排入行程的地點；備選另外加總，不算進總額）
 * @returns {{ total, groups: { ...group, amount, items: { id, label, sub, amount, fare? }[] }[], days: { date, title, subtitle, color, amount }[], backup: number }}
 */
export function computeBudget(stops, days) {
  const groups = BUDGET_GROUPS.map((g) => ({ ...g, amount: 0, items: [] }));
  const byKey = Object.fromEntries(groups.map((g) => [g.key, g]));
  const dayList = days.map((d) => ({ date: d.date, title: d.title, subtitle: d.subtitle, color: d.color, amount: 0 }));
  const dayOf = Object.fromEntries(dayList.map((d) => [d.date, d]));
  const backup = stops.filter(isBackup).reduce((sum, s) => sum + stopTotal(s), 0);

  const ordered = stops.filter(isPlanned).sort((a, b) => a.date.localeCompare(b.date) || byStopOrder(a, b));
  ordered.forEach((s, i) => {
    const day = dayOf[s.date];
    const when = day ? day.title : s.date;
    if (s.cost) {
      const g = byKey[budgetGroupOf(s.category).key];
      g.amount += s.cost;
      g.items.push({ id: s.id, label: `${stopCategory(s).emoji} ${s.title}`, sub: when, amount: s.cost });
    }
    if (s.arriveCost) {
      const prev = ordered[i - 1];
      const fromLabel = prev?.date && s.date ? prev.title : '上一站'; // 當天第一站接前一天的最後一站
      const mode = s.arriveMode ? travelModeInfo(s.arriveMode) : null;
      byKey.transport.amount += s.arriveCost;
      byKey.transport.items.push({
        id: s.id,
        label: `${mode ? mode.emoji : '🧭'} ${fromLabel} → ${s.title}`,
        sub: `${when}${mode ? `・${mode.label}` : ''}`,
        amount: s.arriveCost,
        fare: true,
      });
    }
    if (day) day.amount += stopTotal(s);
  });
  groups.forEach((g) => g.items.sort((a, b) => b.amount - a.amount));
  return {
    total: groups.reduce((sum, g) => sum + g.amount, 0), groups, days: dayList, backup,
  };
}
