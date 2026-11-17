import { Hono } from 'hono';
import { HttpError } from '../lib/errors.js';
import { requireAuth } from '../lib/auth.js';

// 颱風與地面天氣圖走日本氣象廳公開資料。瀏覽器直接抓會被 CORS / X-Frame-Options 擋住，
// 所以由 Worker 代抓。只放 Worker Cache，不寫進 D1。
const UA = 'planner-weather/1.0 (personal itinerary)';
const JMA = 'https://www.jma.go.jp/bosai/typhoon/data';
const CWA_KML = 'https://www.cwa.gov.tw/Data/typhoon/PTA_KMZ/fifows_typhoon.kml';
const CHART_URL = 'https://www.data.jma.go.jp/yoho/data/wxchart/quick/ASAS_COLOR.pdf';
const STORM_TTL = 600;
const CHART_TTL = 1800;
const PRESSURE_TTL = 3600;

const CATEGORY = {
  TY: '颱風',
  STS: '強烈熱帶風暴',
  TS: '熱帶風暴',
  TD: '熱帶低氣壓',
};

const router = new Hono();
router.use('*', requireAuth);

function cacheKey(url) {
  const keyUrl = new URL(url);
  keyUrl.search = '';
  return new Request(keyUrl.toString(), { method: 'GET' });
}

async function readCache(url) {
  return caches.default.match(cacheKey(url));
}

async function writeCache(url, response) {
  try {
    await caches.default.put(cacheKey(url), response);
  } catch {
    // 快取寫入失敗時仍回傳這次抓到的資料
  }
}

async function getJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new HttpError(502, '氣象資料暫時無法取得');
  return res.json();
}

function point(pair) {
  if (!Array.isArray(pair) || pair.length < 2) return null;
  const lat = Number(pair[0]);
  const lng = Number(pair[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return [lat, lng];
}

function titleOf(meta, specTitle) {
  const num = String(meta.typhoonNumber || '');
  const named = /^\d{4}$/.test(num) ? `第${Number(num.slice(2))}號` : '';
  const kind = CATEGORY[meta.category] || '熱帶系統';
  const name = specTitle?.name?.jp || '';
  return [named, kind, name].filter(Boolean).join(' ');
}

function shapeStorm(meta, forecast, spec) {
  if (!Array.isArray(forecast)) return null;
  const specTitle = Array.isArray(spec) ? spec.find((p) => p.part === 'title') : null;
  const live = Array.isArray(spec) ? spec.find((p) => p.part?.jp === '実況') : null;
  const analysis = forecast.find((p) => p.part?.en === 'Analysis' && Array.isArray(p.center));
  const center = point(analysis?.center);
  const track = [
    ...(analysis?.track?.preTyphoon || []),
    ...(analysis?.track?.typhoon || []),
  ].map(point).filter(Boolean);

  const forecastPts = forecast
    .filter((p) => p.advancedHours > 0 && Array.isArray(p.center))
    .map((p) => ({
      hours: p.advancedHours,
      time: p.validtime?.JST || null,
      center: point(p.center),
      radiusKm: p.probabilityCircle?.radius ? Math.round(p.probabilityCircle.radius / 1000) : null,
      pressure: p.pressure ? Number(p.pressure) : null,
      wind: p.maximumWind?.sustained?.['m/s'] ? Number(p.maximumWind.sustained['m/s']) : null,
      gust: p.maximumWind?.gust?.['m/s'] ? Number(p.maximumWind.gust['m/s']) : null,
      category: CATEGORY[p.class?.category] || p.class?.intensity || null,
    }))
    .filter((p) => p.center);

  const wind = live?.maximumWind?.sustained?.['m/s'];
  return {
    id: meta.tropicalCyclone,
    title: titleOf(meta, specTitle),
    category: CATEGORY[meta.category] || meta.category,
    intensity: live?.intensity && live.intensity !== '-' ? String(live.intensity).replace(/な$/, '') : '',
    issue: meta.issue || specTitle?.issue?.JST || null,
    time: live?.validtime?.JST || analysis?.validtime?.JST || null,
    center,
    pressure: live?.pressure ? Number(live.pressure) : null,
    wind: wind ? Number(wind) : null,
    gust: live?.maximumWind?.gust?.['m/s'] ? Number(live.maximumWind.gust['m/s']) : null,
    course: live?.course || '',
    speed: live?.speed?.['km/h'] ? Number(live.speed['km/h']) : null,
    location: live?.location || '',
    galeKm: analysis?.galeWarningArea?.radius ? Math.round(analysis.galeWarningArea.radius / 1000) : null,
    stormKm: analysis?.stormWarningArea?.radius ? Math.round(analysis.stormWarningArea.radius / 1000) : null,
    track,
    forecast: forecastPts,
    source: 'jma',
    sourceLabel: '日本氣象廳',
  };
}

function kmlCoords(text) {
  return String(text || '').trim().split(/\s+/).map((token) => {
    const [lng, lat] = token.split(',').map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return [Math.round(lat * 100) / 100, Math.round(lng * 100) / 100];
  }).filter(Boolean);
}

function hoursFromLabel(issue, label) {
  const matched = String(label || '').match(/(\d{1,2})月(\d{1,2})日(\d{1,2})時/);
  if (!matched || !issue) return null;
  const base = new Date(issue);
  if (Number.isNaN(base.getTime())) return null;
  const pad = (value) => String(value).padStart(2, '0');
  const at = (year) => new Date(`${year}-${pad(matched[1])}-${pad(matched[2])}T${pad(matched[3])}:00:00+08:00`);
  let target = at(base.getFullYear());
  if (target.getTime() + 6 * 3600000 < base.getTime()) target = at(base.getFullYear() + 1);
  return Math.round((target.getTime() - base.getTime()) / 3600000);
}

function stormFolders(kml) {
  const re = /<Folder>|<\/Folder>/g;
  const storms = [];
  const stack = [];
  let match = re.exec(kml);
  while (match) {
    if (match[0] === '<Folder>') {
      const name = (kml.slice(match.index, match.index + 80).match(/^<Folder>\s*<name>([^<]+)<\/name>/) || [])[1] || '';
      stack.push({ name, start: match.index });
    } else {
      const opened = stack.pop();
      if (opened && stack.length === 1 && opened.name && opened.name !== '颱風消息') {
        storms.push({ name: opened.name, body: kml.slice(opened.start, re.lastIndex) });
      }
    }
    match = re.exec(kml);
  }
  return storms;
}

function parseCwa(kml) {
  const issue = (kml.match(/<name>颱風消息<\/name>\s*<description>([^<]+)<\/description>/) || [])[1] || null;
  const folders = stormFolders(kml);
  return folders.map(({ name: rawName, body }) => {
    const name = String(rawName || '').trim().slice(0, 20);
    const marks = [...body.matchAll(/<Placemark>([\s\S]*?)<\/Placemark>/g)].map((item) => {
      const block = item[1];
      const description = ((block.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || '')
        .replace(/<!\[CDATA\[|\]\]>/g, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return {
        name: (block.match(/<name>([^<]*)<\/name>/) || [])[1] || '',
        style: (block.match(/<styleUrl>#([^<]+)<\/styleUrl>/) || [])[1] || '',
        coordinates: kmlCoords((block.match(/<coordinates>\s*([^<]*?)\s*<\/coordinates>/) || [])[1] || ''),
        description,
      };
    });
    const current = marks.find((mark) => mark.style === 'current' && mark.coordinates.length === 1);
    if (!current) return null;
    const text = current.description;
    const named = (text.match(/國際命名\s*([A-Z][A-Z-]{1,20})/) || [])[1] || '';
    const number = (text.match(/編號第\s*(\d{1,3})\s*號/) || [])[1] || '';
    const intensity = (text.match(/強烈颱風|中度颱風|輕度颱風|熱帶性低氣壓/) || [])[0] || '';
    const forecast = marks
      .filter((mark) => mark.style === 'fcst' && mark.coordinates.length === 1)
      .map((mark) => ({
        hours: hoursFromLabel(issue, mark.name),
        time: mark.name,
        center: mark.coordinates[0],
        radiusKm: null,
      }));
    return {
      id: `cwa-${named || name}`,
      title: [number ? `第${Number(number)}號` : '', intensity, name].filter(Boolean).join(' '),
      category: intensity || '熱帶系統',
      intensity,
      issue,
      time: issue,
      center: current.coordinates[0],
      pressure: Number((text.match(/中心氣壓\s*(\d{3,4})/) || [])[1]) || null,
      wind: Number((text.match(/最大風速每秒\s*(\d{1,3})/) || [])[1]) || null,
      gust: Number((text.match(/最大陣風每秒\s*(\d{1,3})/) || [])[1]) || null,
      course: (text.match(/向([^，。]{1,12})進行/) || [])[1] || '',
      speed: Number((text.match(/每小時\s*(\d{1,3})\s*公里/) || [])[1]) || null,
      location: (text.match(/中心位置在([^。]+)/) || text.match(/位置在([^。]+)/) || [])[1] || '',
      galeKm: Number((text.match(/七級風半徑\s*(\d{2,4})/) || [])[1]) || null,
      stormKm: Number((text.match(/十級風半徑\s*(\d{2,4})/) || [])[1]) || null,
      track: marks.find((mark) => mark.style === 'past-track')?.coordinates || [],
      forecast,
      cone: marks.find((mark) => mark.style === 'pta')?.coordinates || [],
      source: 'cwa',
      sourceLabel: '中央氣象署',
    };
  }).filter(Boolean).slice(0, 6);
}

async function fetchJmaStorms() {
  const list = await getJson(`${JMA}/targetTc.json`);
  const metas = (Array.isArray(list) ? list : []).slice(0, 6);
  return (await Promise.all(metas.map(async (meta) => {
    const id = String(meta.tropicalCyclone || '');
    if (!/^TC[A-Za-z0-9]{2,12}$/.test(id)) return null;
    const [forecast, spec] = await Promise.all([
      getJson(`${JMA}/${id}/forecast.json`),
      getJson(`${JMA}/${id}/specifications.json`).catch(() => null),
    ]);
    return shapeStorm(meta, forecast, spec);
  }))).filter(Boolean);
}

async function fetchCwaStorms() {
  const res = await fetch(CWA_KML, {
    headers: { 'User-Agent': UA, Accept: 'application/vnd.google-earth.kml+xml, application/xml, text/xml, */*' },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new HttpError(502, '氣象資料暫時無法取得');
  const text = await res.text();
  if (text.length > 2_000_000 || !text.includes('<kml')) return [];
  return parseCwa(text);
}

function buildGrid(list, rows, cols, hour) {
  if (!Array.isArray(list) || list.length !== rows * cols) {
    throw new HttpError(502, '氣壓資料暫時無法取得');
  }
  const grid = Array.from({ length: rows }, () => Array(cols));
  list.forEach((loc, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const pressure = hour == null
      ? Number(loc?.current?.pressure_msl ?? loc?.hourly?.pressure_msl?.[0])
      : Number(loc?.hourly?.pressure_msl?.[hour]);
    grid[row][col] = {
      lat: Math.round(Number(loc.latitude) * 100) / 100,
      lng: Math.round(Number(loc.longitude) * 100) / 100,
      pressure,
    };
  });
  return grid;
}

function kmApart(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function pruneCenters(points, minKm, stronger) {
  const ranked = [...points].sort(stronger);
  const kept = [];
  for (const point of ranked) {
    if (kept.some((other) => kmApart(point, other) < minKm)) continue;
    kept.push(point);
  }
  return kept.slice(0, 28);
}

function detectCenters(grid) {
  const rows = grid.length;
  const cols = grid[0].length;
  const rad = 1;
  const highs = [];
  const lows = [];
  for (let row = rad; row < rows - rad; row += 1) {
    for (let col = rad; col < cols - rad; col += 1) {
      const values = [];
      for (let dr = -rad; dr <= rad; dr += 1) {
        for (let dc = -rad; dc <= rad; dc += 1) values.push(grid[row + dr][col + dc].pressure);
      }
      if (values.some((value) => !Number.isFinite(value))) continue;
      const cell = grid[row][col];
      const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
      const max = Math.max(...values);
      const min = Math.min(...values);
      const highDelta = cell.pressure - mean;
      const lowDelta = mean - cell.pressure;
      if (cell.pressure >= max - 0.05 && (cell.pressure >= 1012 || highDelta >= 0.7) && highDelta >= 0.45) {
        highs.push({
          lat: cell.lat,
          lng: cell.lng,
          pressure: Math.round(cell.pressure),
          delta: Math.round(highDelta * 10) / 10,
        });
      }
      if (cell.pressure <= min + 0.05 && (cell.pressure <= 1012 || lowDelta >= 0.8) && lowDelta >= 0.5) {
        lows.push({
          lat: cell.lat,
          lng: cell.lng,
          pressure: Math.round(cell.pressure),
          delta: Math.round(lowDelta * 10) / 10,
        });
      }
    }
  }
  const samples = [];
  const packed = [];
  for (const row of grid) {
    for (const cell of row) {
      packed.push(Math.round((Number(cell.pressure) || 0) * 10));
      if (!Number.isFinite(cell.pressure)) continue;
      samples.push([
        Math.round(cell.lat * 100) / 100,
        Math.round(cell.lng * 100) / 100,
        Math.round(cell.pressure * 10) / 10,
      ]);
    }
  }
  return {
    highs: pruneCenters(highs, 280, (a, b) => (b.delta - a.delta) || (b.pressure - a.pressure)),
    lows: pruneCenters(lows, 280, (a, b) => (b.delta - a.delta) || (a.pressure - b.pressure)),
    samples,
    p: packed,
  };
}

function findCenters(list, rows, cols, hour) {
  const grid = buildGrid(list, rows, cols, hour);
  const found = detectCenters(grid);
  return {
    highs: found.highs,
    lows: found.lows,
    contours: buildContours(grid),
    samples: found.samples,
    p: found.p,
    source: 'Open-Meteo',
  };
}

function edgePoint(corners, edge, level) {
  const pair = { top: [0, 1], right: [1, 2], bottom: [2, 3], left: [3, 0] }[edge];
  const [from, to] = pair;
  const start = corners[from];
  const end = corners[to];
  const span = end.pressure - start.pressure || 1e-6;
  const t = Math.min(1, Math.max(0, (level - start.pressure) / span));
  return [
    Math.round((start.lat + (end.lat - start.lat) * t) * 100) / 100,
    Math.round((start.lng + (end.lng - start.lng) * t) * 100) / 100,
  ];
}

function contourSegments(grid, level) {
  const rows = grid.length;
  const cols = grid[0].length;
  const segments = [];
  const pairsFor = (mask, center) => {
    if (mask === 5) return center >= level ? [['left', 'bottom'], ['top', 'right']] : [['left', 'top'], ['right', 'bottom']];
    if (mask === 10) return center >= level ? [['left', 'top'], ['right', 'bottom']] : [['left', 'bottom'], ['top', 'right']];
    const table = {
      1: [['left', 'top']],
      2: [['top', 'right']],
      3: [['left', 'right']],
      4: [['right', 'bottom']],
      6: [['top', 'bottom']],
      7: [['left', 'bottom']],
      8: [['left', 'bottom']],
      9: [['top', 'bottom']],
      11: [['right', 'bottom']],
      12: [['left', 'right']],
      13: [['top', 'right']],
      14: [['left', 'top']],
    };
    return table[mask] || [];
  };
  for (let row = 0; row < rows - 1; row += 1) {
    for (let col = 0; col < cols - 1; col += 1) {
      const corners = [grid[row][col], grid[row][col + 1], grid[row + 1][col + 1], grid[row + 1][col]];
      if (corners.some((cell) => !Number.isFinite(cell.pressure))) continue;
      let mask = 0;
      corners.forEach((cell, index) => {
        if (cell.pressure >= level) mask |= (1 << index);
      });
      if (mask === 0 || mask === 15) continue;
      const center = corners.reduce((sum, cell) => sum + cell.pressure, 0) / 4;
      pairsFor(mask, center).forEach(([left, right]) => {
        segments.push([edgePoint(corners, left, level), edgePoint(corners, right, level)]);
      });
    }
  }
  return segments;
}

function samePoint(a, b) {
  return Math.abs(a[0] - b[0]) < 0.05 && Math.abs(a[1] - b[1]) < 0.05;
}

function stitchSegments(segments) {
  const unused = segments.map((segment) => segment.map((point) => [point[0], point[1]]));
  const lines = [];
  while (unused.length) {
    let line = unused.pop();
    let grew = true;
    while (grew) {
      grew = false;
      for (let index = 0; index < unused.length; index += 1) {
        const segment = unused[index];
        const head = line[0];
        const tail = line[line.length - 1];
        const start = segment[0];
        const end = segment[segment.length - 1];
        if (samePoint(tail, start)) line = line.concat(segment.slice(1));
        else if (samePoint(tail, end)) line = line.concat(segment.slice(0, -1).reverse());
        else if (samePoint(head, end)) line = segment.slice(0, -1).concat(line);
        else if (samePoint(head, start)) line = segment.slice(1).reverse().concat(line);
        else continue;
        unused.splice(index, 1);
        grew = true;
        break;
      }
    }
    if (line.length >= 3) lines.push(line);
  }
  return lines;
}

function buildContours(grid) {
  const levels = [];
  for (let level = 988; level <= 1040; level += 2) levels.push(level);
  return levels.map((level) => ({
    level,
    lines: stitchSegments(contourSegments(grid, level)),
  })).filter((item) => item.lines.length);
}

router.get('/typhoons', async (c) => {
  const hit = await readCache(c.req.url);
  if (hit) {
    return c.json(await hit.json(), 200, { 'Cache-Control': 'private, max-age=60' });
  }

  const [jmaResult, cwaResult] = await Promise.allSettled([fetchJmaStorms(), fetchCwaStorms()]);
  if (jmaResult.status === 'rejected' && cwaResult.status === 'rejected') {
    throw new HttpError(502, '氣象資料暫時無法取得');
  }
  const storms = [
    ...(cwaResult.status === 'fulfilled' ? cwaResult.value : []),
    ...(jmaResult.status === 'fulfilled' ? jmaResult.value : []),
  ];
  const data = { storms };
  const stored = new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${STORM_TTL}`,
    },
  });
  await writeCache(c.req.url, stored);
  return c.json(data, 200, { 'Cache-Control': 'private, max-age=60' });
});

async function fetchPressureBand(latitudes, longitudes) {
  const pointsLat = [];
  const pointsLng = [];
  latitudes.forEach((lat) => {
    longitudes.forEach((lng) => {
      pointsLat.push(lat);
      pointsLng.push(lng);
    });
  });
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${pointsLat.join(',')}&longitude=${pointsLng.join(',')}&hourly=pressure_msl&forecast_hours=241`;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new HttpError(502, '氣壓資料暫時無法取得');
  const json = await res.json();
  const list = Array.isArray(json) ? json : [json];
  if (list.length !== pointsLat.length || !list[0]?.hourly?.pressure_msl) {
    throw new HttpError(502, '氣壓資料暫時無法取得');
  }
  return list;
}

router.get('/pressure', async (c) => {
  const keyUrl = new URL(c.req.url);
  keyUrl.search = 'field=6';
  const key = new Request(keyUrl.toString(), { method: 'GET' });
  const hit = await caches.default.match(key);
  if (hit) {
    return c.json(await hit.json(), 200, { 'Cache-Control': 'private, max-age=300' });
  }

  const latitudes = [];
  for (let lat = 3; lat <= 54; lat += 3) latitudes.push(lat);
  const west = [];
  const east = [];
  for (let lng = 95; lng <= 128; lng += 3) west.push(lng);
  for (let lng = 131; lng <= 164; lng += 3) east.push(lng);
  const longitudes = [...west, ...east];
  const [left, right] = await Promise.all([
    fetchPressureBand(latitudes, west),
    fetchPressureBand(latitudes, east),
  ]);
  const rows = latitudes.length;
  const cols = longitudes.length;
  const hourCount = Math.min(
    left[0].hourly.pressure_msl.length,
    right[0].hourly.pressure_msl.length,
  );
  const timesAll = left[0].hourly.time;
  const step = 6;
  const merged = [];
  latitudes.forEach((_, row) => {
    west.forEach((_, col) => merged.push(left[row * west.length + col]));
    east.forEach((_, col) => merged.push(right[row * east.length + col]));
  });
  const now = findCenters(merged, rows, cols, 0);
  const frames = [];
  const times = [];
  for (let hour = 0; hour <= 240; hour += step) {
    const index = Math.min(hour, hourCount - 1);
    if (index < 0 || !Number.isFinite(Number(merged[0]?.hourly?.pressure_msl?.[index]))) break;
    const grid = buildGrid(merged, rows, cols, index);
    const found = detectCenters(grid);
    times.push(timesAll[index]);
    frames.push({ highs: found.highs, lows: found.lows, p: found.p });
  }
  const { p: _packedNow, ...nowField } = now;
  const data = {
    ...nowField,
    stepHours: step,
    times,
    frames,
    grid: {
      lat0: latitudes[0],
      lng0: longitudes[0],
      dLat: 3,
      dLng: 3,
      rows,
      cols,
      latitudes,
      longitudes,
    },
  };
  const stored = new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${PRESSURE_TTL}`,
    },
  });
  try {
    await caches.default.put(key, stored);
  } catch {
    // 快取寫入失敗時仍回傳這次抓到的資料
  }
  return c.json(data, 200, { 'Cache-Control': 'private, max-age=300' });
});

async function fetchWindBand(latitudes, longitudes) {
  const pointsLat = [];
  const pointsLng = [];
  latitudes.forEach((lat) => {
    longitudes.forEach((lng) => {
      pointsLat.push(lat);
      pointsLng.push(lng);
    });
  });
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${pointsLat.join(',')}&longitude=${pointsLng.join(',')}&hourly=wind_speed_10m,wind_direction_10m&forecast_hours=49&timezone=Asia/Taipei&wind_speed_unit=ms`;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new HttpError(502, '風場暫時無法取得');
  const json = await res.json();
  const list = Array.isArray(json) ? json : [json];
  if (list.length !== pointsLat.length || !list[0]?.hourly?.time) {
    throw new HttpError(502, '風場暫時無法取得');
  }
  return list;
}

router.get('/wind', async (c) => {
  const keyUrl = new URL(c.req.url);
  keyUrl.search = 'wind=1';
  const key = new Request(keyUrl.toString(), { method: 'GET' });
  const hit = await caches.default.match(key);
  if (hit) return c.json(await hit.json(), 200, { 'Cache-Control': 'private, max-age=300' });

  const latitudes = [];
  for (let lat = 8; lat <= 46; lat += 1) latitudes.push(lat);
  const west = [];
  const east = [];
  for (let lng = 108; lng <= 132; lng += 1) west.push(lng);
  for (let lng = 133; lng <= 156; lng += 1) east.push(lng);
  const longitudes = [...west, ...east];
  const [left, right] = await Promise.all([
    fetchWindBand(latitudes, west),
    fetchWindBand(latitudes, east),
  ]);
  const timesAll = left[0].hourly.time;
  const times = [];
  const frames = [];
  const cols = longitudes.length;
  for (let hour = 0; hour < timesAll.length; hour += 3) {
    times.push(timesAll[hour]);
    const u = [];
    const v = [];
    const write = (list, lngs, offset) => {
      list.forEach((loc, index) => {
        const row = Math.floor(index / lngs.length);
        const col = offset + (index % lngs.length);
        const speed = Number(loc.hourly.wind_speed_10m[hour]) || 0;
        const dir = (Number(loc.hourly.wind_direction_10m[hour]) || 0) * Math.PI / 180;
        const at = row * cols + col;
        u[at] = Math.round(-speed * Math.sin(dir) * 10);
        v[at] = Math.round(-speed * Math.cos(dir) * 10);
      });
    };
    write(left, west, 0);
    write(right, east, west.length);
    frames.push({ u, v });
  }
  const data = {
    lat0: latitudes[0],
    lng0: longitudes[0],
    dLat: 1,
    dLng: 1,
    rows: latitudes.length,
    cols,
    times,
    frames,
  };
  const stored = new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
  try {
    await caches.default.put(key, stored);
  } catch {
    // 快取寫入失敗時仍回傳這次抓到的資料
  }
  return c.json(data, 200, { 'Cache-Control': 'private, max-age=300' });
});

router.get('/chart', async (c) => {
  const hit = await readCache(c.req.url);
  if (hit) {
    const headers = new Headers(hit.headers);
    headers.set('Cache-Control', 'private, max-age=300');
    headers.set('Content-Disposition', 'inline; filename="asia-surface.pdf"');
    return new Response(hit.body, { status: 200, headers });
  }

  const upstream = await fetch(CHART_URL, {
    headers: { 'User-Agent': UA, Accept: 'application/pdf' },
    signal: AbortSignal.timeout(20000),
  });
  if (!upstream.ok) throw new HttpError(502, '天氣圖暫時無法取得');
  const body = await upstream.arrayBuffer();
  if (body.byteLength < 1000 || body.byteLength > 8 * 1024 * 1024) {
    throw new HttpError(502, '天氣圖暫時無法取得');
  }

  const stored = new Response(body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Cache-Control': `public, max-age=${CHART_TTL}`,
    },
  });
  await writeCache(c.req.url, stored.clone());
  return new Response(body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="asia-surface.pdf"',
      'Cache-Control': 'private, max-age=300',
    },
  });
});

export default router;
