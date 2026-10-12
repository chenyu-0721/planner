/**
 * 沿著實際軌道，把高鐵 / 火車 / 捷運兩站之間的路線畫出來。
 *
 * 軌道資料是預先產生的靜態檔 public/rail/taiwan-rail.json（npm run rail:update），
 * 來自 OpenStreetMap（© OpenStreetMap contributors，ODbL）。執行時不呼叫任何外部服務，
 * 由瀏覽器在本機建立軌道網路並找出最短路徑。沒有班表，時間仍是依軌道長度估算。
 * 找不到路徑時回傳 null，呼叫端改畫直線。
 */

// 測試時可設定 globalThis.__PLANNER_API__ 指向本機伺服器
const base = () => globalThis.__PLANNER_API__ || '';
const DATA_URL = '/rail/taiwan-rail.json';

// 起訖點離軌道多遠以內才算「在這條線上」
const SNAP_KM = { hsr: 2.5, train: 2, mrt: 0.8 };
// 轉乘：不同軌道相距多近可以互通，以及轉乘的額外成本（公里）
const TRANSFER = { hsr: [0.4, 1.5], train: [0.4, 1.5], mrt: [0.25, 0.8] };

let networkPromise = null;
const graphs = new Map();
const routeCache = new Map();

const kmBetween = (a, b) => {
  const R = 6371;
  const rad = (v) => (v * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

const nodeKey = (lat, lng) => `${lat.toFixed(5)},${lng.toFixed(5)}`;
const routeKey = (mode, from, to) => `${mode}|${from.lat.toFixed(4)},${from.lng.toFixed(4)}|${to.lat.toFixed(4)},${to.lng.toFixed(4)}`;

function decodePolyline(str) {
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
    coords.push([lat / 1e5, lng / 1e5]);
  }
  return coords;
}

function loadNetwork() {
  if (!networkPromise) {
    networkPromise = fetch(`${base()}${DATA_URL}`)
      .then((res) => {
        if (!res.ok) throw new Error('無法載入軌道資料');
        return res.json();
      })
      .catch((e) => {
        networkPromise = null; // 下次再試
        throw e;
      });
  }
  return networkPromise;
}

// 由軌道段建立圖：節點 = 座標點，相同座標（分岔處）自動相連
function buildGraph(pieces) {
  const nodes = new Map();
  const touch = (lat, lng) => {
    const key = nodeKey(lat, lng);
    if (!nodes.has(key)) nodes.set(key, { lat, lng, edges: [] });
    return key;
  };
  for (const piece of pieces) {
    const [encoded, penalty = 1] = Array.isArray(piece) ? piece : [piece];
    const coords = decodePolyline(encoded);
    let prev = touch(coords[0][0], coords[0][1]);
    for (let i = 1; i < coords.length; i += 1) {
      const key = touch(coords[i][0], coords[i][1]);
      if (key === prev) continue;
      const a = nodes.get(prev);
      const b = nodes.get(key);
      const w = kmBetween(a, b) * penalty;
      a.edges.push({ to: key, w });
      b.edges.push({ to: prev, w });
      prev = key;
    }
  }
  return nodes;
}

/**
 * 轉乘連結：OpenStreetMap 裡不同路線（或上下行軌道）是各自獨立的軌道，在轉乘站不會相連。
 * 把「不同連通區塊、相距 maxKm 以內」的點用一條帶轉乘成本的邊接起來，才能跨線找路
 * （例如台北車站板南線 ↔ 淡水信義線、忠孝復興站轉文湖線）。
 */
function addTransferEdges(nodes, maxKm, penaltyKm) {
  const comp = new Map();
  let compId = 0;
  for (const key of nodes.keys()) {
    if (comp.has(key)) continue;
    compId += 1;
    const stack = [key];
    comp.set(key, compId);
    while (stack.length) {
      const cur = stack.pop();
      for (const e of nodes.get(cur).edges) {
        if (!comp.has(e.to)) {
          comp.set(e.to, compId);
          stack.push(e.to);
        }
      }
    }
  }
  if (compId < 2) return;

  // 用格子加速找附近的點（每格約 0.0025 度 ≈ 250~280 公尺）
  const CELL = 0.0025;
  const cellOf = (n) => [Math.floor(n.lat / CELL), Math.floor(n.lng / CELL)];
  const grid = new Map();
  for (const [key, n] of nodes) {
    const [r, c] = cellOf(n);
    const k = `${r},${c}`;
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(key);
  }

  for (const [key, n] of nodes) {
    const [r, c] = cellOf(n);
    const myComp = comp.get(key);
    const best = new Map(); // 對每個其他區塊只連最近的一個點
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        for (const other of grid.get(`${r + dr},${c + dc}`) || []) {
          const oc = comp.get(other);
          if (oc === myComp || other <= key) continue; // 每對只處理一次
          const d = kmBetween(n, nodes.get(other));
          if (d <= maxKm && d < (best.get(oc)?.d ?? Infinity)) best.set(oc, { other, d });
        }
      }
    }
    for (const { other, d } of best.values()) {
      const w = d + penaltyKm;
      n.edges.push({ to: other, w });
      nodes.get(other).edges.push({ to: key, w });
    }
  }
}

/**
 * 補資料上的小缺口：軌道的盡頭（只連到一個點）如果附近 maxKm 內有其他軌道，就直接接上。
 * 轉乘連結只處理「互不相通」的區塊，但火車路網整圈相通，像南迴線在枋山斷開 14 公尺時，
 * 兩端其實能經台北繞一圈相連，就不會被補上，必須另外處理。
 */
function bridgeDeadEnds(nodes, maxKm) {
  const CELL = 0.0025;
  const cellOf = (n) => [Math.floor(n.lat / CELL), Math.floor(n.lng / CELL)];
  const grid = new Map();
  for (const [key, n] of nodes) {
    const [r, c] = cellOf(n);
    const k = `${r},${c}`;
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(key);
  }
  const deadEnds = [...nodes].filter(([, n]) => n.edges.length === 1);
  for (const [key, n] of deadEnds) {
    const neighbor = n.edges[0].to;
    const [r, c] = cellOf(n);
    let best = null;
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        for (const other of grid.get(`${r + dr},${c + dc}`) || []) {
          if (other === key || other === neighbor) continue;
          const d = kmBetween(n, nodes.get(other));
          if (d <= maxKm && (!best || d < best.d)) best = { other, d };
        }
      }
    }
    if (best) {
      n.edges.push({ to: best.other, w: best.d });
      nodes.get(best.other).edges.push({ to: key, w: best.d });
    }
  }
}

async function graphFor(mode) {
  if (graphs.has(mode)) return graphs.get(mode);
  const network = await loadNetwork();
  const graph = buildGraph(network.modes?.[mode] || []);
  bridgeDeadEnds(graph, 0.3);
  addTransferEdges(graph, ...TRANSFER[mode]);
  graphs.set(mode, graph);
  return graph;
}

function nearestKey(nodes, point, maxKm) {
  let best = null;
  let bestKm = maxKm;
  for (const [key, node] of nodes) {
    const d = kmBetween(point, node);
    if (d < bestKm) {
      bestKm = d;
      best = key;
    }
  }
  return best;
}

function heapPush(heap, item) {
  heap.push(item);
  let i = heap.length - 1;
  while (i > 0) {
    const parent = (i - 1) >> 1;
    if (heap[parent].f <= heap[i].f) break;
    [heap[parent], heap[i]] = [heap[i], heap[parent]];
    i = parent;
  }
}

function heapPop(heap) {
  const top = heap[0];
  const last = heap.pop();
  if (!heap.length || !last) return top;
  heap[0] = last;
  let i = 0;
  for (;;) {
    const left = i * 2 + 1;
    const right = left + 1;
    let small = i;
    if (left < heap.length && heap[left].f < heap[small].f) small = left;
    if (right < heap.length && heap[right].f < heap[small].f) small = right;
    if (small === i) break;
    [heap[small], heap[i]] = [heap[i], heap[small]];
    i = small;
  }
  return top;
}

// A* 最短路徑
function routeKeys(nodes, start, goal) {
  const goalNode = nodes.get(goal);
  const gScore = new Map([[start, 0]]);
  const prev = new Map();
  const heap = [];
  heapPush(heap, { key: start, g: 0, f: kmBetween(nodes.get(start), goalNode) });
  while (heap.length) {
    const cur = heapPop(heap);
    if (cur.g !== gScore.get(cur.key)) continue;
    if (cur.key === goal) break;
    const node = nodes.get(cur.key);
    for (const edge of node.edges) {
      const next = cur.g + edge.w;
      if (next >= (gScore.get(edge.to) ?? Infinity)) continue;
      gScore.set(edge.to, next);
      prev.set(edge.to, cur.key);
      heapPush(heap, { key: edge.to, g: next, f: next + kmBetween(nodes.get(edge.to), goalNode) });
    }
  }
  if (!prev.has(goal)) return null;
  const keys = [goal];
  let cursor = goal;
  while (cursor !== start) {
    cursor = prev.get(cursor);
    if (!cursor) return null;
    keys.push(cursor);
  }
  keys.reverse();
  return keys;
}

/** 已經算過的軌道路線（同步取得，沒有就回傳 null） */
export function cachedRailRoute(mode, from, to) {
  if (!from || !to || !SNAP_KM[mode]) return null;
  return routeCache.get(routeKey(mode, from, to)) || null;
}

/**
 * 沿軌道找兩點之間的路線
 * @returns {Promise<{ coords: [number, number][], distance: number } | null>}
 */
export async function fetchRailRoute(mode, from, to) {
  if (!from || !to || !SNAP_KM[mode]) return null;
  const straight = kmBetween(from, to);
  if (straight < 0.05) return null;
  const key = routeKey(mode, from, to);
  if (routeCache.has(key)) return routeCache.get(key);

  const graph = await graphFor(mode);
  const start = nearestKey(graph, from, SNAP_KM[mode]);
  const goal = nearestKey(graph, to, SNAP_KM[mode]);
  let route = null;
  if (start && goal && start !== goal) {
    const keys = routeKeys(graph, start, goal);
    if (keys?.length >= 2) {
      const coords = keys.map((k) => [graph.get(k).lat, graph.get(k).lng]);
      let distance = 0;
      for (let i = 1; i < coords.length; i += 1) {
        distance += kmBetween({ lat: coords[i - 1][0], lng: coords[i - 1][1] }, { lat: coords[i][0], lng: coords[i][1] });
      }
      // 過短或繞得太誇張的結果不採用（多半是起訖點吸附到錯的軌道）
      if (distance >= Math.max(0.12, straight * 0.35) && !(straight > 3 && distance > straight * 3.2)) {
        route = { coords, distance };
      }
    }
  }
  routeCache.set(key, route);
  return route;
}
