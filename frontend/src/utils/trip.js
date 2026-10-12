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
 * Photon（OpenStreetMap 資料，允許邊打字邊搜尋），限定台灣範圍
 * lang=default：使用當地名稱（台灣即中文）。不指定時 Photon 會依瀏覽器語言回傳，
 * 但它不支援中文，會改用英文名稱（例如「Taipei 101」）
 */
const PHOTON = 'https://photon.komoot.io/api/';

const withHao = (n) => (n ? (/[號号]$/.test(n) ? n : `${n}號`) : '');
const joinAddress = (...parts) => parts.filter(Boolean).filter((p, i, arr) => arr.indexOf(p) === i).join('');

export async function searchPlaces(query, signal) {
  const [[s, w], [n, e]] = TAIWAN_BOUNDS;
  const url = `${PHOTON}?q=${encodeURIComponent(query)}&limit=8&lang=default&bbox=${w},${s},${e},${n}`;
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

/* ---------- 交通方式與路線 ----------
 * 道路類：沿實際道路規劃
 *   開車 / 腳踏車 / 步行：OSRM（routing.openstreetmap.de，FOSSGIS 免費服務）
 *   機車：Valhalla motor_scooter（valhalla1.openstreetmap.de），會避開國道、以機車速度估算
 * 鐵路類（高鐵 / 火車）：沒有免費的班次資料，依兩站直線距離估算時間，並提供 Google 地圖查班次
 */
export const TRAVEL_MODES = [
  { key: 'car', label: '開車', emoji: '🚗', kind: 'road', engine: 'osrm', profile: 'routed-car/route/v1/driving', gmaps: 'driving' },
  { key: 'scooter', label: '機車', emoji: '🛵', kind: 'road', engine: 'valhalla', costing: 'motor_scooter', gmaps: 'driving' },
  { key: 'bike', label: '腳踏車', emoji: '🚲', kind: 'road', engine: 'osrm', profile: 'routed-bike/route/v1/bike', gmaps: 'bicycling' },
  { key: 'foot', label: '步行', emoji: '🚶', kind: 'road', engine: 'osrm', profile: 'routed-foot/route/v1/foot', gmaps: 'walking' },
  // speed：以「直線距離」換算的平均時速（含停靠站），依實際班次校正
  { key: 'hsr', label: '高鐵', emoji: '🚄', kind: 'rail', speed: 165, gmaps: 'transit' },
  { key: 'train', label: '火車', emoji: '🚆', kind: 'rail', speed: 60, gmaps: 'transit' },
  { key: 'straight', label: '直線', emoji: '📏', kind: 'line', gmaps: 'driving' },
];
// 行程預設只能選道路類與直線（高鐵 / 火車只用在單一路段）
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
      runs.push({ mode: seg.mode, segs: [seg], end: i + 1 });
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
    run.lines = run.segs.map((seg) => ({ mode: run.mode, coords: straightLeg(seg) }));
    run.legs = run.segs.map((seg) => {
      const km = distanceKm(seg.from, seg.to);
      return {
        mode: run.mode,
        distance: km,
        duration: info.kind === 'rail' ? (km / info.speed) * 3600 : null,
        estimated: info.kind === 'rail',
      };
    });
  }));

  return { lines: runs.flatMap((r) => r.lines), legs: runs.flatMap((r) => r.legs) };
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

// 單一路段（高鐵 / 火車會用大眾運輸，可查實際班次）
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
