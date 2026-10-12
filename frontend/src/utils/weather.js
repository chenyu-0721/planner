/**
 * 天氣預報：Open-Meteo（https://open-meteo.com/，免費、不需要 API 金鑰，非商業使用）
 * 一次查詢行程中所有地點（相近的地點合併），取得每天概況與每小時預報。
 * 只能查到「約 3 個月前 ～ 今天起 16 天內」，超出範圍的日期不顯示。
 */
import { addDays } from './planner';

const API = 'https://api.open-meteo.com/v1/forecast';
export const FORECAST_DAYS = 16;
const PAST_DAYS = 90;
const MAX_LOCATIONS = 40;
const CACHE_MS = 30 * 60 * 1000;

// WMO 天氣代碼
const CODES = [
  [[0], '☀️', '晴'],
  [[1], '🌤️', '晴時多雲'],
  [[2], '⛅', '多雲'],
  [[3], '☁️', '陰'],
  [[45, 48], '🌫️', '有霧'],
  [[51, 53, 55], '🌦️', '毛毛雨'],
  [[56, 57, 66, 67], '🌧️', '凍雨'],
  [[61], '🌧️', '小雨'],
  [[63], '🌧️', '中雨'],
  [[65], '🌧️', '大雨'],
  [[71, 73, 75, 77, 85, 86], '🌨️', '降雪'],
  [[80], '🌦️', '短暫陣雨'],
  [[81], '🌧️', '陣雨'],
  [[82], '🌧️', '強陣雨'],
  [[95], '⛈️', '雷雨'],
  [[96, 99], '⛈️', '雷雨伴隨冰雹'],
];
export function weatherInfo(code) {
  const found = CODES.find(([codes]) => codes.includes(code));
  return found ? { emoji: found[1], label: found[2] } : { emoji: '🌡️', label: '—' };
}

// 台灣時間的今天（YYYY-MM-DD）
export const todayInTaiwan = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });

/** 可以查到天氣的日期範圍 */
export function weatherRange() {
  const today = todayInTaiwan();
  return { from: addDays(today, -PAST_DAYS), to: addDays(today, FORECAST_DAYS - 1) };
}

// 相距約 5 公里內的地點視為同一處（減少查詢量）
export const weatherKey = (p) => `${(Math.round(p.lat * 20) / 20).toFixed(2)},${(Math.round(p.lng * 20) / 20).toFixed(2)}`;

const cache = new Map();

/**
 * @param {{ lat: number, lng: number }[]} points
 * @param {string} startDate
 * @param {string} endDate
 * @returns {Promise<Map<string, { daily: Record<string, object>, hourly: Record<string, object> }>>}
 *   key 為 weatherKey；daily[YYYY-MM-DD] = { code, max, min, rain }；hourly['YYYY-MM-DDTHH:00'] = { code, temp, rain }
 */
export async function fetchWeather(points, startDate, endDate, signal) {
  const range = weatherRange();
  const from = startDate > range.from ? startDate : range.from;
  const to = endDate < range.to ? endDate : range.to;
  const keys = [...new Set(points.map(weatherKey))].slice(0, MAX_LOCATIONS);
  const result = new Map();
  if (!keys.length || from > to) return result;

  const cacheKey = `${from}|${to}|${keys.join(';')}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const params = new URLSearchParams({
    latitude: keys.map((k) => k.split(',')[0]).join(','),
    longitude: keys.map((k) => k.split(',')[1]).join(','),
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    hourly: 'temperature_2m,precipitation_probability,weather_code',
    timezone: 'Asia/Taipei',
    start_date: from,
    end_date: to,
  });
  const res = await fetch(`${API}?${params}`, { signal });
  if (!res.ok) throw new Error('無法取得天氣預報');
  const json = await res.json();
  const list = Array.isArray(json) ? json : [json];

  list.forEach((loc, i) => {
    const daily = {};
    const hourly = {};
    const d = loc.daily || {};
    (d.time || []).forEach((date, j) => {
      if (d.weather_code[j] == null) return;
      daily[date] = {
        code: d.weather_code[j],
        max: d.temperature_2m_max[j],
        min: d.temperature_2m_min[j],
        rain: d.precipitation_probability_max[j],
      };
    });
    const h = loc.hourly || {};
    (h.time || []).forEach((time, j) => {
      if (h.weather_code[j] == null) return;
      hourly[time] = { code: h.weather_code[j], temp: h.temperature_2m[j], rain: h.precipitation_probability[j] };
    });
    result.set(keys[i], { daily, hourly });
  });
  cache.set(cacheKey, { at: Date.now(), data: result });
  return result;
}

/** 某時間（HH:MM）所在整點的預報，30 分以後取下一個整點 */
export function hourlyAt(data, date, time) {
  if (!data || !time) return null;
  let hour = Number(time.slice(0, 2)) + (Number(time.slice(3, 5)) >= 30 ? 1 : 0);
  let day = date;
  if (hour >= 24) {
    hour = 0;
    day = addDays(date, 1);
  }
  return data.hourly[`${day}T${String(hour).padStart(2, '0')}:00`] || null;
}

export const fmtTemp = (v) => (v == null ? '' : `${Math.round(v)}°`);
