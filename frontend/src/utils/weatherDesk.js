export const CITIES = [
  { id: 'taipei', name: '臺北', lat: 25.037, lng: 121.564 },
  { id: 'newtaipei', name: '新北', lat: 25.017, lng: 121.463 },
  { id: 'taoyuan', name: '桃園', lat: 24.994, lng: 121.301 },
  { id: 'hsinchu', name: '新竹', lat: 24.814, lng: 120.968 },
  { id: 'taichung', name: '臺中', lat: 24.147, lng: 120.674 },
  { id: 'chiayi', name: '嘉義', lat: 23.480, lng: 120.449 },
  { id: 'tainan', name: '臺南', lat: 22.999, lng: 120.227 },
  { id: 'kaohsiung', name: '高雄', lat: 22.627, lng: 120.301 },
  { id: 'pingtung', name: '屏東', lat: 22.552, lng: 120.548 },
  { id: 'yilan', name: '宜蘭', lat: 24.757, lng: 121.753 },
  { id: 'hualien', name: '花蓮', lat: 23.977, lng: 121.604 },
  { id: 'taitung', name: '臺東', lat: 22.761, lng: 121.145 },
  { id: 'penghu', name: '澎湖', lat: 23.571, lng: 119.579 },
  { id: 'kinmen', name: '金門', lat: 24.449, lng: 118.376 },
  { id: 'matsu', name: '馬祖', lat: 26.160, lng: 119.951 },
];

const WMO = {
  0: ['晴朗', '☀️'],
  1: ['大致晴', '🌤️'],
  2: ['多雲', '⛅'],
  3: ['陰天', '☁️'],
  45: ['有霧', '🌫️'],
  48: ['霧凇', '🌫️'],
  51: ['毛毛雨', '🌦️'],
  53: ['毛毛雨', '🌦️'],
  55: ['毛毛雨', '🌦️'],
  61: ['小雨', '🌧️'],
  63: ['下雨', '🌧️'],
  65: ['大雨', '🌧️'],
  71: ['下雪', '🌨️'],
  73: ['下雪', '🌨️'],
  75: ['大雪', '🌨️'],
  80: ['陣雨', '🌦️'],
  81: ['陣雨', '🌦️'],
  82: ['強陣雨', '⛈️'],
  95: ['雷雨', '⛈️'],
  96: ['雷雨', '⛈️'],
  99: ['雷雨', '⛈️'],
};

export const weatherOf = (code) => WMO[code] || ['多變', '🌡️'];

const DIRS = ['北', '東北', '東', '東南', '南', '西南', '西', '西北'];
export const windDir = (deg) => DIRS[Math.round((((Number(deg) % 360) + 360) % 360) / 45) % 8];

export function pressureHint(now, later) {
  if (now == null || later == null) return '氣壓資料不足';
  const delta = Math.round(later - now);
  if (delta >= 3) return `未來一天氣壓上升 ${delta} hPa，高氣壓增強的機會較高`;
  if (delta <= -3) return `未來一天氣壓下降 ${Math.abs(delta)} hPa，低氣壓或鋒面接近的機會較高`;
  return '未來一天氣壓變化不大';
}

export async function fetchForecast(lat, lng) {
  const q = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,visibility,is_day',
    hourly: 'temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,relative_humidity_2m,cloud_cover,uv_index,visibility,dew_point_2m,is_day',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,uv_index_max,sunrise,sunset',
    timezone: 'Asia/Taipei',
    forecast_days: '10',
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`);
  if (!res.ok) throw new Error('天氣預報暫時無法取得');
  return res.json();
}

const COMPASS = ['北', '北北東', '東北', '東北東', '東', '東南東', '東南', '南南東', '南', '南南西', '西南', '西南西', '西', '西北西', '西北', '北北西'];
export const compass = (deg) => COMPASS[Math.round((((Number(deg) % 360) + 360) % 360) / 22.5) % 16];

function placeOf(point) {
  if (!point) return null;
  if (Array.isArray(point)) return { lat: point[0], lng: point[1] };
  return { lat: point.lat, lng: point.lng };
}

function kmBetween(a, b) {
  const R = 6371;
  const rad = (value) => (value * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function bearingOf(from, to) {
  const rad = (value) => (value * Math.PI) / 180;
  const y = Math.sin(rad(to.lng - from.lng)) * Math.cos(rad(to.lat));
  const x = Math.cos(rad(from.lat)) * Math.sin(rad(to.lat))
    - Math.sin(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.cos(rad(to.lng - from.lng));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function turnBetween(a, b) {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

function nearest(origin, points) {
  return points.reduce((best, point) => {
    const distance = kmBetween(origin, point);
    if (!best || distance < best.distance) return { point, distance };
    return best;
  }, null);
}

function intensityOf(storm) {
  const wind = Number(storm?.wind) || 0;
  const pressure = Number(storm?.pressure) || 1000;
  const gale = Number(storm?.galeKm) || 180;
  let score = 0.35;
  if (wind >= 51 || pressure <= 920) score = 1;
  else if (wind >= 33 || pressure <= 970) score = 0.75;
  else if (wind >= 17 || pressure <= 992) score = 0.5;
  return { wind, pressure, gale, score };
}

export function impactOf(storm) {
  const galeKm = Number(storm?.galeKm) || null;
  const stormKm = Number(storm?.stormKm) || (galeKm ? Math.max(40, Math.round(galeKm * 0.45)) : null);
  const areaKm2 = galeKm ? Math.round(Math.PI * galeKm * galeKm) : null;
  return { galeKm, stormKm, areaKm2 };
}

export function formatArea(km2) {
  if (!km2) return '';
  if (km2 >= 10000) return `${(km2 / 10000).toFixed(1)} 萬平方公里`;
  return `${km2.toLocaleString('zh-TW')} 平方公里`;
}

export function taiwanOutlook(storm) {
  const here = placeOf(storm?.center);
  if (!here) return '';
  const island = { lat: 23.7, lng: 121.0 };
  const dist = Math.round(kmBetween(here, island));
  const gale = impactOf(storm).galeKm || 0;
  const speed = Math.max(8, Number(storm.speed) || observedMotion(storm).speed);
  const heading = storm.course || compass(observedMotion(storm).bearing);
  const gap = Math.max(0, dist - gale - 160);
  const hours = Math.round(gap / speed);
  if (dist - gale <= 160) {
    return `強風圈已接近或可能影響台灣，中心距本島約 ${dist} 公里。`;
  }
  if (hours <= 72) {
    return `以目前約 ${Math.round(speed)} km/h 移速，強風圈大約 ${hours} 小時後可能靠近台灣（中心距本島 ${dist} 公里）。`;
  }
  return `目前中心距台灣約 ${dist} 公里，朝${heading}移動，短時間內對本島影響較低。`;
}

export function formatLatLng(center) {
  const point = placeOf(center);
  if (!point) return '—';
  const ns = point.lat >= 0 ? '北緯' : '南緯';
  const ew = point.lng >= 0 ? '東經' : '西經';
  return `${ns} ${Math.abs(point.lat).toFixed(1)} 度、${ew} ${Math.abs(point.lng).toFixed(1)} 度`;
}

export function uvLabel(value) {
  const uv = Number(value);
  if (!Number.isFinite(uv)) return '';
  if (uv < 3) return '低';
  if (uv < 6) return '中等';
  if (uv < 8) return '高';
  if (uv < 11) return '甚高';
  return '極高';
}

export function visibilityKm(meters) {
  const value = Number(meters);
  if (!Number.isFinite(value)) return null;
  return Math.round(value / 100) / 10;
}

export function msToKmh(ms) {
  const value = Number(ms);
  return Number.isFinite(value) ? Math.round(value * 3.6) : null;
}

export function intensityClass(storm) {
  const label = `${storm?.intensity || ''} ${storm?.category || ''}`;
  const wind = Number(storm?.wind) || 0;
  if (/強烈|Violent|Very Strong/i.test(label) || wind >= 51) {
    return { text: '強烈颱風', tone: 'severe' };
  }
  if (/中度|Strong(?!ly)/i.test(label) || wind >= 33) {
    return { text: /STS|強烈熱帶/i.test(label) ? '強烈熱帶風暴' : '中度颱風', tone: 'strong' };
  }
  if (/輕度|颱風|TY|TS/i.test(label) || wind >= 17) {
    return { text: /輕度|TY|颱風/.test(label) ? '輕度颱風' : '熱帶風暴', tone: 'mild' };
  }
  return { text: storm?.intensity || storm?.category || '熱帶性低氣壓', tone: 'td' };
}

export function cityThreats(storm) {
  const here = placeOf(storm?.center);
  if (!here) return [];
  const impact = impactOf(storm);
  return CITIES.map((city) => {
    const dist = Math.round(kmBetween(here, city));
    let level = 'safe';
    if (impact.stormKm && dist <= impact.stormKm) level = 'storm';
    else if (impact.galeKm && dist <= impact.galeKm) level = 'gale';
    else if (impact.galeKm && dist <= impact.galeKm + 250) level = 'watch';
    return { ...city, dist, level };
  }).sort((a, b) => a.dist - b.dist);
}

export function warnLevel(storm) {
  const threats = cityThreats(storm);
  if (threats.some((item) => item.level === 'storm' || item.level === 'gale')) {
    return { level: 'land', text: '強風圈可能影響台灣本島或離島，請注意陸上強風、豪雨與交通。' };
  }
  if (threats.some((item) => item.level === 'watch')) {
    return { level: 'sea', text: '接近台灣附近海域，請注意海上強風、長浪與沿海觀浪風險。' };
  }
  return { level: 'none', text: '目前對台灣無直接陸上影響，請持續追蹤最新路徑。' };
}

function nearestForecast(points, hour) {
  const list = (points || []).filter((point) => point?.center);
  if (!list.length) return null;
  return list.reduce((best, point) => {
    const hours = Number(point.hours) || 0;
    if (!best || Math.abs(hours - hour) < Math.abs((Number(best.hours) || 0) - hour)) return point;
    return best;
  }, null);
}

export function historyPoints(storm) {
  const round = (value) => Math.round(value * 10) / 10;
  const now = placeOf(storm?.center);
  const raw = [];
  for (const item of storm?.track || []) {
    const point = placeOf(item);
    if (!point) continue;
    const last = raw[raw.length - 1];
    if (!last || kmBetween(last, point) >= 35) raw.push(point);
  }
  if (now) {
    const last = raw[raw.length - 1];
    if (!last) raw.push(now);
    else if (kmBetween(last, now) < 8) raw[raw.length - 1] = now;
    else raw.push(now);
  }
  if (!raw.length) return [];
  const speed = Math.max(10, Number(storm.speed) || observedMotion(storm).speed || 20);
  const remain = Array(raw.length).fill(0);
  for (let index = raw.length - 2; index >= 0; index -= 1) {
    remain[index] = remain[index + 1] + kmBetween(raw[index], raw[index + 1]);
  }
  return raw.map((point, index) => ({
    hours: index === raw.length - 1 ? 0 : -Math.max(6, Math.round(remain[index] / speed / 6) * 6),
    center: [round(point.lat), round(point.lng)],
    kind: index === raw.length - 1 ? 'now' : 'past',
  }));
}

export function trackCompare(cwa, jma, aiPoints) {
  const lists = [cwa, jma, aiPoints];
  const past = [];
  for (const list of lists) {
    for (const point of list || []) {
      const hours = Number(point.hours);
      if (Number.isFinite(hours) && hours < 0) past.push(hours);
    }
  }
  const hours = [];
  if (past.length) {
    const oldest = Math.min(...past);
    const start = Math.ceil(oldest / 24) * 24;
    for (let hour = start; hour < 0; hour += 24) hours.push(hour);
  }
  hours.push(0, 12, 24, 36, 48, 72, 96, 120, 168, 240);
  return hours.map((hour) => ({
    hours: hour,
    cwa: nearestForecast(cwa, hour),
    jma: nearestForecast(jma, hour),
    ai: nearestForecast(aiPoints, hour),
  })).filter((row) => {
    const slack = row.hours < 0 ? 18 : row.hours >= 120 ? 36 : 12;
    const hit = (point) => point && Math.abs((Number(point.hours) || 0) - row.hours) <= slack;
    return hit(row.cwa) || hit(row.jma) || hit(row.ai);
  });
}

function steeringHighs(highs) {
  return (highs || []).filter((high) => Number(high.pressure) >= 1015);
}

function ridgeFlow(lat, lng, highs) {
  const useful = steeringHighs(highs);
  if (!useful.length) return null;
  const here = { lat, lng };
  const parts = [];
  for (const high of useful) {
    const distance = kmBetween(here, high);
    if (distance < 500 || distance > 3400) continue;
    const toHigh = bearingOf(here, high);
    const fromHigh = bearingOf(high, here);
    const east = Math.cos(((toHigh - 90) * Math.PI) / 180);
    const north = Math.cos((toHigh * Math.PI) / 180);
    if (east < -0.55 && distance < 900) continue;
    const strength = Math.max(0.5, (Number(high.pressure) || 1020) - 1012);
    const weight = strength * (1600 / (distance + 400)) ** 2 * (0.55 + 0.55 * Math.max(0, east) + 0.25 * Math.max(0, north));
    parts.push({ bearing: (fromHigh + 90) % 360, weight });
  }
  const bearing = mixBearings(parts);
  if (bearing == null) return null;
  const weight = parts.reduce((sum, part) => sum + part.weight, 0);
  return { bearing, weight };
}

function interpolateOfficial(storm, hour) {
  const pts = [];
  const now = placeOf(storm?.center);
  if (now) pts.push({ hours: 0, lat: now.lat, lng: now.lng });
  for (const item of storm?.forecast || []) {
    const center = placeOf(item.center);
    if (!center || item.hours == null) continue;
    pts.push({ hours: Number(item.hours), lat: center.lat, lng: center.lng });
  }
  pts.sort((a, b) => a.hours - b.hours);
  if (pts.length < 2) return null;
  const end = pts[pts.length - 1];
  if (hour > end.hours) {
    return {
      lat: end.lat,
      lng: end.lng,
      bearing: bearingOf(pts[pts.length - 2], end),
      expired: hour - end.hours,
      lastHour: end.hours,
    };
  }
  let from = pts[0];
  let to = end;
  for (let index = 0; index < pts.length - 1; index += 1) {
    if (hour >= pts[index].hours && hour <= pts[index + 1].hours) {
      from = pts[index];
      to = pts[index + 1];
      break;
    }
  }
  const t = (hour - from.hours) / Math.max(1, to.hours - from.hours);
  return {
    lat: from.lat + (to.lat - from.lat) * t,
    lng: from.lng + (to.lng - from.lng) * t,
    bearing: bearingOf(from, to),
    expired: 0,
    lastHour: end.hours,
  };
}

function fujiwharaFlow(lat, lng, lows, selfPressure) {
  const parts = [];
  for (const low of lows || []) {
    const distance = kmBetween({ lat, lng }, low);
    if (distance < 500 || distance > 1400) continue;
    if (Math.abs((Number(low.pressure) || 1000) - (selfPressure || 1000)) < 2 && distance < 250) continue;
    const toward = bearingOf(low, { lat, lng });
    const strength = Math.max(1, 1012 - (Number(low.pressure) || 1000));
    parts.push({
      bearing: (toward + 270) % 360,
      weight: strength * (900 / distance) ** 2,
    });
  }
  const bearing = mixBearings(parts);
  if (bearing == null) return null;
  return { bearing, weight: Math.min(0.28, parts.reduce((sum, part) => sum + part.weight, 0) / 40) };
}

/** 北半球高氣壓順時針、低壓互繞、環境氣壓梯度交錯判斷。 */
export function steerStorm(storm, pressure) {
  const here = placeOf(storm?.center);
  if (!here) return null;
  const high = nearest(here, pressure?.highs || []);
  const ridge = ridgeFlow(here.lat, here.lng, pressure?.highs || []);
  const fuji = fujiwharaFlow(here.lat, here.lng, pressure?.lows || [], storm.pressure);
  const env = steeringBearing(here.lat, here.lng, pressure?.samples || [], [here]);
  const motion = observedMotion(storm);
  const intensity = intensityOf(storm);
  const ahead = (storm.forecast || []).filter((point) => point.center).find((point) => point.hours >= 18)
    || (storm.forecast || []).find((point) => point.center);
  const official = ahead ? bearingOf(here, placeOf(ahead.center)) : null;
  const heading = mixBearings([
    { bearing: official, weight: official == null ? 0 : 0.4 },
    { bearing: ridge?.bearing, weight: ridge ? 0.2 : 0 },
    { bearing: env, weight: env == null ? 0 : 0.16 },
    { bearing: fuji?.bearing, weight: fuji?.weight || 0 },
    { bearing: motion.bearing, weight: 0.18 },
    { bearing: 315, weight: 0.04 + 0.06 * intensity.score },
  ]);
  if (heading == null) return null;
  const name = storm.title || '這個颱風';
  const bits = [];
  if (high && high.distance < 3200) {
    bits.push(`在 ${high.point.pressure} hPa 高壓的${compass(bearingOf(high.point, here))}側`);
  }
  if (intensity.wind) bits.push(`近中心 ${intensity.wind} m/s`);
  if (storm.pressure) bits.push(`中心氣壓 ${storm.pressure} hPa`);
  let text = `${name}${bits.length ? `（${bits.join('，')}）` : ''}。`;
  text += official != null
    ? `近期待合官方動向，再交錯副高引導與氣壓場，判斷往${compass(heading)}。`
    : `交錯副高引導、環境氣壓梯度與路徑慣性後，判斷往${compass(heading)}。`;
  if (pressure?.frames?.length > 1) {
    text += `之後會依未來 10 天氣壓場的變化調整路徑。`;
  }
  if (fuji) text += `附近還有其他低壓，兩個系統會互相牽引。`;
  if (official != null) {
    text += turnBetween(heading, official) <= 40
      ? `官方未來約一天也是往${compass(official)}。`
      : `官方未來約一天是往${compass(official)}，仍以官方為準。`;
  }
  return { bearing: heading, text, label: `AI 判斷　往${compass(heading)}` };
}

function solve3(matrix, vector) {
  const det = (rows) => rows[0][0] * (rows[1][1] * rows[2][2] - rows[1][2] * rows[2][1])
    - rows[0][1] * (rows[1][0] * rows[2][2] - rows[1][2] * rows[2][0])
    + rows[0][2] * (rows[1][0] * rows[2][1] - rows[1][1] * rows[2][0]);
  const base = det(matrix);
  if (Math.abs(base) < 1e-8) return null;
  const replaced = (column) => matrix.map((row, index) => row.map((value, col) => (col === column ? vector[index] : value)));
  return [0, 1, 2].map((column) => det(replaced(column)) / base);
}

function shiftBy(lat, lng, bearing, km) {
  const rad = Math.PI / 180;
  return [
    lat + (km / 111.32) * Math.cos(bearing * rad),
    lng + (km / (111.32 * Math.max(0.25, Math.cos(lat * rad)))) * Math.sin(bearing * rad),
  ];
}

function farFromStorms(lat, lng, cores, km) {
  return cores.every((core) => kmBetween({ lat, lng }, core) >= km);
}

function steeringBearing(lat, lng, samples, cores) {
  const near = [];
  for (const sample of samples) {
    if (!farFromStorms(sample[0], sample[1], cores, 900)) continue;
    const distance = kmBetween({ lat, lng }, { lat: sample[0], lng: sample[1] });
    if (distance >= 900 && distance <= 2400) near.push({ x: sample[0] - lat, y: sample[1] - lng, z: sample[2] });
  }
  if (near.length < 10) return null;
  let count = 0;
  let sx = 0;
  let sy = 0;
  let sz = 0;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  let sxz = 0;
  let syz = 0;
  for (const point of near) {
    count += 1;
    sx += point.x;
    sy += point.y;
    sz += point.z;
    sxx += point.x * point.x;
    syy += point.y * point.y;
    sxy += point.x * point.y;
    sxz += point.x * point.z;
    syz += point.y * point.z;
  }
  const solved = solve3(
    [[count, sx, sy], [sx, sxx, sxy], [sy, sxy, syy]],
    [sz, sxz, syz],
  );
  if (!solved) return null;
  const east = -solved[1];
  const north = solved[2] / Math.max(0.25, Math.cos(lat * Math.PI / 180));
  if (east * east + north * north < 1e-8) return null;
  return (Math.atan2(east, north) * 180 / Math.PI + 360) % 360;
}

function mixBearings(parts) {
  let x = 0;
  let y = 0;
  for (const { bearing, weight } of parts) {
    if (bearing == null || weight <= 0) continue;
    const rad = (bearing * Math.PI) / 180;
    x += weight * Math.sin(rad);
    y += weight * Math.cos(rad);
  }
  if (x === 0 && y === 0) return null;
  return (Math.atan2(x, y) * 180 / Math.PI + 360) % 360;
}

function limitTurn(prev, next, maxDeg) {
  let delta = ((next - prev + 540) % 360) - 180;
  if (delta > maxDeg) delta = maxDeg;
  if (delta < -maxDeg) delta = -maxDeg;
  return (prev + delta + 360) % 360;
}

function observedMotion(storm) {
  const points = [...(storm.track || [])];
  if (storm.center) points.push(storm.center);
  const speed = Math.min(32, Math.max(14, Number(storm.speed) || 20));
  if (points.length < 2) return { bearing: 315, speed };
  const from = placeOf(points[Math.max(0, points.length - 4)]);
  const to = placeOf(points[points.length - 1]);
  const dist = kmBetween(from, to);
  const hours = Math.max(6, (points.length - 1 - Math.max(0, points.length - 4)) * 6);
  return {
    bearing: bearingOf(from, to),
    speed: Math.min(32, Math.max(14, dist / hours || speed)),
  };
}

function envStrength(lat, lng, samples, cores) {
  const near = [];
  for (const sample of samples) {
    if (!farFromStorms(sample[0], sample[1], cores, 900)) continue;
    const distance = kmBetween({ lat, lng }, { lat: sample[0], lng: sample[1] });
    if (distance >= 900 && distance <= 2400) near.push(sample[2]);
  }
  if (near.length < 8) return 0;
  const max = Math.max(...near);
  const min = Math.min(...near);
  return Math.max(0, max - min);
}

function unpackSamples(field, frame) {
  if (!frame?.p || !field?.grid) return field.samples || [];
  const { lat0, lng0, dLat, dLng, rows, cols, latitudes, longitudes } = field.grid;
  const out = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const packed = frame.p[row * cols + col];
      if (packed == null) continue;
      const lat = latitudes?.[row] ?? (lat0 + row * dLat);
      const lng = longitudes?.[col] ?? (lng0 + col * dLng);
      out.push([lat, lng, packed / 10]);
    }
  }
  return out.length ? out : (field.samples || []);
}

function fieldAtHour(field, hour) {
  const frames = field?.frames;
  if (!frames?.length) {
    return {
      samples: field?.samples || [],
      highs: field?.highs || [],
      lows: field?.lows || [],
    };
  }
  const step = field.stepHours || 6;
  const index = Math.min(frames.length - 1, Math.max(0, Math.round(hour / step)));
  const frame = frames[index];
  return {
    samples: unpackSamples(field, frame),
    highs: frame.highs || field.highs || [],
    lows: frame.lows || [],
  };
}

/**
 * AI 路徑：近程貼近官方預報，再依該時刻副高與氣壓梯度延伸到 10 日。
 * 實況段沿用官方觀測，避免和氣象署／日本氣象廳的歷史路徑脫節。
 */
export function aiTrack(storm, samples, others = [], field = {}) {
  const start = placeOf(storm?.center);
  if (!start) return null;
  const history = historyPoints(storm);
  const round = (value) => Math.round(value * 10) / 10;
  const points = history.length
    ? history.map((point) => ({ ...point, center: [round(point.center[0]), round(point.center[1])] }))
    : [{ hours: 0, center: [round(start.lat), round(start.lng)], kind: 'now' }];
  if (!samples?.length) {
    return points.length >= 2 ? { points, label: 'AI 計算判斷路徑（含實況）' } : null;
  }
  const companions = others.map(placeOf).filter(Boolean);
  const motion = observedMotion(storm);
  const intensity = intensityOf(storm);
  let lat = start.lat;
  let lng = start.lng;
  let heading = motion.bearing;
  let persist = 0.46 + 0.1 * intensity.score;
  const horizon = field.frames?.length
    ? Math.min(240, (field.frames.length - 1) * (field.stepHours || 6))
    : 120;
  for (let hour = 6; hour <= horizon; hour += 6) {
    const snapshot = fieldAtHour(field, hour);
    const cores = [{ lat, lng }, ...companions];
    const highs = snapshot.highs;
    const lows = (snapshot.lows || []).filter((low) => kmBetween({ lat, lng }, low) > 500);
    const envSamples = snapshot.samples?.length ? snapshot.samples : samples;
    const ridge = ridgeFlow(lat, lng, highs);
    const env = steeringBearing(lat, lng, envSamples, cores);
    const fuji = fujiwharaFlow(lat, lng, lows, storm.pressure);
    const guide = interpolateOfficial(storm, hour);
    let officialWeight = 0;
    let officialBearing = null;
    if (guide && !guide.expired) {
      officialBearing = mixBearings([
        { bearing: bearingOf({ lat, lng }, guide), weight: 0.7 },
        { bearing: guide.bearing, weight: 0.3 },
      ]);
      officialWeight = hour <= 24 ? 0.52 : hour <= 48 ? 0.4 : hour <= 72 ? 0.26 : 0.12;
    } else if (guide?.expired) {
      officialBearing = guide.bearing;
      officialWeight = Math.max(0, 0.16 - guide.expired / 420);
    }
    const beta = lat < 24 ? 315 : lat < 30 ? 350 : 20;
    const mixed = mixBearings([
      { bearing: heading, weight: persist },
      { bearing: officialBearing, weight: officialWeight },
      { bearing: ridge?.bearing, weight: ridge ? (hour <= 48 ? 0.16 : 0.28) : 0 },
      { bearing: env, weight: env == null ? 0 : (hour <= 48 ? 0.1 : 0.2) },
      { bearing: fuji?.bearing, weight: Math.min(0.12, fuji?.weight || 0) },
      { bearing: beta, weight: lat < 26 ? 0.04 + 0.05 * intensity.score : 0.02 },
    ]);
    if (mixed == null) break;
    const maxTurn = hour <= 48 ? 10 : hour <= 96 ? 14 : 20;
    heading = limitTurn(heading, mixed, maxTurn);
    persist *= hour <= 72 ? 0.92 : 0.84;
    const envKmh = 8 + envStrength(lat, lng, envSamples, cores) * 0.35;
    let speed = Math.min(36, Math.max(10,
      (Number(storm.speed) || motion.speed) * 0.7
      + motion.speed * 0.15
      + envKmh * 0.15,
    ));
    if (guide && !guide.expired) {
      const prev = interpolateOfficial(storm, hour - 6);
      if (prev) {
        const officialKmh = kmBetween(prev, guide) / 6;
        if (officialKmh > 4) speed = speed * (1 - officialWeight) + officialKmh * officialWeight;
      }
    }
    let [nextLat, nextLng] = shiftBy(lat, lng, heading, speed * 6);
    if (guide && !guide.expired && hour <= 48) {
      const pull = hour <= 24 ? 0.32 : 0.18;
      nextLat += (guide.lat - nextLat) * pull;
      nextLng += (guide.lng - nextLng) * pull;
    }
    if (nextLat < 3 || nextLat > 54 || nextLng < 95 || nextLng > 165) break;
    lat = nextLat;
    lng = nextLng;
    points.push({ hours: hour, center: [round(lat), round(lng)], kind: 'forecast' });
  }
  if (points.length < 2) return null;
  return { points, label: 'AI 計算判斷路徑（實況＋10 日）' };
}

export async function fetchRadarFrames() {
  const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
  if (!res.ok) throw new Error('降雨雷達暫時無法取得');
  const data = await res.json();
  const frames = [...(data.radar?.past || []), ...(data.radar?.nowcast || [])].slice(-10);
  return { host: data.host, frames };
}
