/**
 * 產生全台灣鐵路軌道資料（高鐵 / 台鐵 / 捷運與輕軌），輸出到 public/rail/taiwan-rail.json
 * 資料來源：OpenStreetMap（經 Overpass API），授權 ODbL 1.0，© OpenStreetMap contributors
 *
 * 用法：npm run rail:update（軌道很少變動，偶爾更新即可）
 *       npm run rail:update -- train   只重新產生指定的交通方式（hsr / mrt / train），其餘沿用現有檔案
 *
 * 處理方式：
 *  1. 依交通方式分區塊向 Overpass 查詢（避免單次查詢過大而逾時）
 *  2. 在「多條軌道共用的節點」（分岔、轉接處）切開，確保簡化後仍然相連
 *  3. 以 Douglas-Peucker 簡化（約 10 公尺誤差），再用 polyline 編碼壓縮
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../public/rail/taiwan-rail.json');
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const UA = 'planner-trip-map/1.0 (rail data build script)';

// 台灣本島（離島沒有鐵路），由北到南切成區塊，相鄰區塊重疊一點以免切斷
const TILES = [
  [24.6, 120.6, 25.4, 122.1],
  [23.8, 120.1, 24.7, 122.0],
  [22.9, 119.9, 23.9, 121.8],
  [21.8, 119.9, 23.0, 121.5],
];
const SELECT = {
  hsr: (b) => `way["railway"="rail"]["highspeed"="yes"](${b});`,
  // 不在查詢中排除 service：部分主線經過車站或車輛基地時被標成 service=yard / siding（但有 usage=main），由 keepWay 判斷
  train: (b) => `(way["railway"="rail"][!"highspeed"](${b});way["railway"="rail"]["highspeed"="no"](${b}););`,
  mrt: (b) => `way["railway"~"^(subway|light_rail)$"][!"service"](${b});`,
};
const SKIP_USAGE = /^(industrial|military)$/;
// 調車場、側線、渡線等不是旅客路線；但標了 usage=main / branch 的仍是主線（例如潮州車輛基地內的屏東線）
const keepWay = (tags = {}) => !SKIP_USAGE.test(tags.usage || '')
  && (!tags.service || /^(main|branch)$/.test(tags.usage || ''));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function overpass(query) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const url = ENDPOINTS[attempt % ENDPOINTS.length];
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(180000),
      });
      const text = await res.text();
      if (res.ok && text.startsWith('{')) return JSON.parse(text);
      console.log(`  ${new URL(url).host} ${res.status}，稍後重試`);
    } catch (e) {
      console.log(`  ${new URL(url).host} ${e.message}，稍後重試`);
    }
    await sleep(Math.min(60000, 5000 * (attempt + 1)));
  }
  throw new Error('Overpass 一直無法回應，請稍後再執行');
}

// polyline 編碼（精度 5 位，約 1 公尺）
function encode(coords) {
  let out = '';
  let pLat = 0;
  let pLng = 0;
  const enc = (v) => {
    let n = v < 0 ? ~(v << 1) : v << 1;
    let s = '';
    while (n >= 0x20) {
      s += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
      n >>= 5;
    }
    return s + String.fromCharCode(n + 63);
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

function simplify(coords, tolKm) {
  if (coords.length <= 2) return coords;
  const cos = Math.cos((coords[0][0] * Math.PI) / 180);
  const xy = coords.map(([lat, lng]) => [lng * 111.32 * cos, lat * 110.57]);
  const keep = new Uint8Array(coords.length);
  keep[0] = 1;
  keep[coords.length - 1] = 1;
  const stack = [[0, coords.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = xy[a];
    const dx = xy[b][0] - ax;
    const dy = xy[b][1] - ay;
    const len2 = dx * dx + dy * dy;
    let max = 0;
    let idx = -1;
    for (let i = a + 1; i < b; i += 1) {
      const t = len2 ? Math.max(0, Math.min(1, ((xy[i][0] - ax) * dx + (xy[i][1] - ay) * dy) / len2)) : 0;
      const d = Math.hypot(xy[i][0] - (ax + t * dx), xy[i][1] - (ay + t * dy));
      if (d > max) {
        max = d;
        idx = i;
      }
    }
    if (max > tolKm && idx > 0) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return coords.filter((_, i) => keep[i]);
}

async function buildMode(mode) {
  const ways = new Map();
  for (const t of TILES) {
    console.log(`${mode}：查詢區塊 ${t.join(',')}`);
    const data = await overpass(`[out:json][timeout:170];${SELECT[mode](t.join(','))}out geom;`);
    for (const w of data.elements || []) {
      if (w.type === 'way' && w.geometry?.length >= 2 && keepWay(w.tags)) ways.set(w.id, w);
    }
    await sleep(3000); // 對免費服務客氣一點
  }

  // 被兩條以上軌道共用的節點 = 分岔／相接處，必須保留
  const useCount = new Map();
  for (const w of ways.values()) for (const id of w.nodes) useCount.set(id, (useCount.get(id) || 0) + 1);

  const out = [];
  let points = 0;
  for (const w of ways.values()) {
    const penalty = w.tags?.usage === 'branch' ? 1.45 : w.tags?.usage === 'tourism' ? 2 : 1;
    let piece = [];
    w.nodes.forEach((id, i) => {
      const g = w.geometry[i];
      piece.push([g.lat, g.lon]);
      const split = i > 0 && i < w.nodes.length - 1 && useCount.get(id) > 1;
      if (split || i === w.nodes.length - 1) {
        const simple = simplify(piece, 0.01);
        points += simple.length;
        out.push(penalty === 1 ? encode(simple) : [encode(simple), penalty]);
        piece = [[g.lat, g.lon]];
      }
    });
  }
  console.log(`${mode}：${ways.size} 條軌道 → ${out.length} 段、${points} 個點`);
  return out;
}

const only = process.argv.slice(2).filter((m) => SELECT[m]);
const previous = only.length && fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
const result = {
  generated: new Date().toISOString().slice(0, 10),
  source: 'OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright)',
  format: 'modes.<mode> = 軌道段的 polyline（精度 5）；陣列形式 [polyline, 支線權重]',
  modes: { ...(previous?.modes || {}) },
};
for (const mode of only.length ? only : ['hsr', 'mrt', 'train']) result.modes[mode] = await buildMode(mode);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(result));
console.log(`完成：${OUT}（${(fs.statSync(OUT).size / 1024).toFixed(0)} KB）`);
