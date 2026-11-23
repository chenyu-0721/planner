/**
 * 幣別與匯率
 * 匯率來源：ExchangeRate-API 的免費開放端點（https://www.exchangerate-api.com，不需要金鑰，每天更新一次），
 * 依規定需在畫面上標示來源。匯率只用來估算合計，實際以刷卡或換匯當下為準。
 */
import { reactive } from 'vue';

// 常用幣別（台灣出國常去的地方排前面）
export const CURRENCIES = [
  { code: 'TWD', name: '新台幣', symbol: 'NT$', digits: 0, flag: '🇹🇼' },
  { code: 'JPY', name: '日圓', symbol: '¥', digits: 0, flag: '🇯🇵' },
  { code: 'KRW', name: '韓元', symbol: '₩', digits: 0, flag: '🇰🇷' },
  { code: 'USD', name: '美元', symbol: 'US$', digits: 2, flag: '🇺🇸' },
  { code: 'EUR', name: '歐元', symbol: '€', digits: 2, flag: '🇪🇺' },
  { code: 'HKD', name: '港幣', symbol: 'HK$', digits: 1, flag: '🇭🇰' },
  { code: 'MOP', name: '澳門幣', symbol: 'MOP$', digits: 1, flag: '🇲🇴' },
  { code: 'CNY', name: '人民幣', symbol: 'CN¥', digits: 1, flag: '🇨🇳' },
  { code: 'THB', name: '泰銖', symbol: '฿', digits: 0, flag: '🇹🇭' },
  { code: 'VND', name: '越南盾', symbol: '₫', digits: 0, flag: '🇻🇳' },
  { code: 'SGD', name: '新加坡幣', symbol: 'S$', digits: 2, flag: '🇸🇬' },
  { code: 'MYR', name: '馬來西亞令吉', symbol: 'RM', digits: 2, flag: '🇲🇾' },
  { code: 'PHP', name: '菲律賓披索', symbol: '₱', digits: 0, flag: '🇵🇭' },
  { code: 'IDR', name: '印尼盾', symbol: 'Rp', digits: 0, flag: '🇮🇩' },
  { code: 'GBP', name: '英鎊', symbol: '£', digits: 2, flag: '🇬🇧' },
  { code: 'CHF', name: '瑞士法郎', symbol: 'CHF', digits: 2, flag: '🇨🇭' },
  { code: 'AUD', name: '澳幣', symbol: 'A$', digits: 2, flag: '🇦🇺' },
  { code: 'NZD', name: '紐西蘭幣', symbol: 'NZ$', digits: 2, flag: '🇳🇿' },
  { code: 'CAD', name: '加幣', symbol: 'C$', digits: 2, flag: '🇨🇦' },
  { code: 'TRY', name: '土耳其里拉', symbol: '₺', digits: 0, flag: '🇹🇷' },
  { code: 'AED', name: '阿聯酋迪拉姆', symbol: 'AED', digits: 2, flag: '🇦🇪' },
];
export const currencyInfo = (code) => CURRENCIES.find((c) => c.code === code)
  || { code, name: code, symbol: `${code} `, digits: 2, flag: '💱' };

/** 金額加上幣別符號，例如 NT$1,200、¥3,500、€12.50 */
export function fmtMoney(value, code = 'TWD') {
  if (value == null || value === '') return '';
  const info = currencyInfo(code || 'TWD');
  const n = Number(value);
  const digits = Number.isInteger(n) ? 0 : info.digits;
  return `${info.symbol}${n.toLocaleString('zh-TW', { minimumFractionDigits: digits, maximumFractionDigits: Math.max(digits, 0) })}`;
}

/* ---------- 匯率 ---------- */
const RATE_API = 'https://open.er-api.com/v6/latest/';
const RATE_STORE = 'planner_fx_v1';
const RATE_MS = 12 * 3600 * 1000;

// rates[base] = { at, updated, rates: { USD: 0.031, ... } }（1 base = x 外幣）
export const fx = reactive({ rates: {}, loading: false, error: '' });

function readStore() {
  try {
    return JSON.parse(localStorage.getItem(RATE_STORE) || '{}') || {};
  } catch {
    return {};
  }
}

const pending = new Map();
/** 載入以 base 為基準的匯率（12 小時內不重查） */
export function loadRates(base = 'TWD') {
  const cached = fx.rates[base] || readStore()[base];
  if (cached && Date.now() - cached.at < RATE_MS) {
    fx.rates[base] = cached;
    return Promise.resolve(cached);
  }
  if (pending.has(base)) return pending.get(base);
  fx.loading = true;
  const job = fetch(`${RATE_API}${encodeURIComponent(base)}`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('無法取得匯率'))))
    .then((data) => {
      if (data.result !== 'success' || !data.rates) throw new Error('無法取得匯率');
      const entry = { at: Date.now(), updated: data.time_last_update_unix * 1000, rates: data.rates };
      fx.rates[base] = entry;
      fx.error = '';
      try {
        localStorage.setItem(RATE_STORE, JSON.stringify({ ...readStore(), [base]: entry }));
      } catch {
        // 無法使用瀏覽器儲存時只放記憶體
      }
      return entry;
    })
    .catch((e) => {
      fx.error = e.message;
      if (cached) fx.rates[base] = cached; // 舊匯率總比沒有好
      return cached || null;
    })
    .finally(() => {
      fx.loading = false;
      pending.delete(base);
    });
  pending.set(base, job);
  return job;
}

/**
 * 換算成 base 幣別；查不到匯率時回傳 null
 * （同幣別直接回傳原值）
 */
export function toBase(amount, from, base) {
  if (amount == null) return null;
  if (!from || from === base) return amount;
  const rate = fx.rates[base]?.rates?.[from];
  return rate ? amount / rate : null;
}

/** 1 外幣 = ? base，例如 1 JPY ≈ NT$0.21 */
export function rateText(from, base) {
  const rate = fx.rates[base]?.rates?.[from];
  if (!rate) return '';
  const v = 1 / rate;
  const shown = v >= 100 ? v.toFixed(0) : v >= 1 ? v.toFixed(2) : v.toFixed(4);
  return `1 ${from} ≈ ${currencyInfo(base).symbol}${shown}`;
}
