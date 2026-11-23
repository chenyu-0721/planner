/**
 * 預訂（機票、住宿、車票…）與出發前準備清單
 */
import { parseDate } from './planner';

export const BOOKING_KINDS = [
  {
    key: 'flight', label: '機票', emoji: '✈️', budget: 'transport',
    title: '航班，例如 CI100 中華航空', from: '出發機場，例如 桃園 TPE', to: '抵達機場，例如 成田 NRT', start: '起飛', end: '抵達',
  },
  {
    key: 'hotel', label: '住宿', emoji: '🏨', budget: 'hotel',
    title: '飯店名稱', from: '地址', to: null, start: '入住', end: '退房',
  },
  {
    key: 'train', label: '車票', emoji: '🚄', budget: 'transport',
    title: '車次，例如 高鐵 0603、JR 新幹線', from: '出發站', to: '抵達站', start: '出發', end: '抵達',
  },
  {
    key: 'car', label: '租車', emoji: '🚗', budget: 'transport',
    title: '租車公司、車型', from: '取車地點', to: '還車地點', start: '取車', end: '還車',
  },
  {
    key: 'ticket', label: '門票・活動', emoji: '🎟️', budget: 'ticket',
    title: '名稱，例如 環球影城門票', from: '地點', to: null, start: '時間', end: '結束',
  },
  {
    key: 'other', label: '其他', emoji: '📎', budget: 'other',
    title: '名稱，例如 旅平險、網卡', from: '地點', to: null, start: '開始', end: '結束',
  },
];
export const bookingKind = (key) => BOOKING_KINDS.find((k) => k.key === key) || BOOKING_KINDS[BOOKING_KINDS.length - 1];

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
/** 2026-11-23T07:30 → 11/23（一）07:30 */
export function fmtBookingTime(value, withDay = true) {
  if (!value) return '';
  const [date, time] = value.split('T');
  const d = parseDate(date);
  const day = `${d.getMonth() + 1}/${d.getDate()}（${WEEKDAYS[d.getDay()]}）`;
  return withDay ? `${day} ${time || ''}`.trim() : time || '';
}

/** 某天要顯示的預訂：當天開始的，以及住宿期間的每一晚 */
export function bookingsOnDay(bookings, date) {
  const rows = [];
  for (const b of bookings) {
    const start = b.startAt?.slice(0, 10);
    const end = b.endAt?.slice(0, 10);
    if (start === date) rows.push({ booking: b, role: 'start' });
    else if (b.kind === 'hotel' && start && end && date > start && date < end) rows.push({ booking: b, role: 'stay' });
    else if (end === date && b.kind !== 'ticket') rows.push({ booking: b, role: 'end' });
  }
  return rows.sort((a, b) => (timeOf(a) || '99').localeCompare(timeOf(b) || '99'));
}
function timeOf(row) {
  const v = row.role === 'end' ? row.booking.endAt : row.role === 'start' ? row.booking.startAt : '';
  return v?.slice(11, 16) || '';
}

/* ---------- 出發前準備 ---------- */
export const CHECKLIST_SECTIONS = [
  { key: 'docs', label: '證件・入境', emoji: '🛂' },
  { key: 'money', label: '錢・通訊・保險', emoji: '💳' },
  { key: 'booking', label: '訂票・訂房', emoji: '🎫' },
  { key: 'packing', label: '行李', emoji: '🧳' },
  { key: 'other', label: '其他', emoji: '📝' },
];
export const checklistSection = (key) => CHECKLIST_SECTIONS.find((s) => s.key === key) || CHECKLIST_SECTIONS[CHECKLIST_SECTIONS.length - 1];

// 範本：一鍵加入常用項目（已有同名項目會略過）
export const CHECKLIST_TEMPLATES = [
  {
    key: 'abroad',
    label: '出國基本',
    emoji: '🌏',
    items: [
      ['docs', '護照（效期 6 個月以上）'],
      ['docs', '簽證 / 電子入境許可（ESTA、K-ETA 等）'],
      ['docs', '入境申報（例如 Visit Japan Web）'],
      ['docs', '護照、機票電子檔備份'],
      ['money', '換外幣 / 開通海外刷卡'],
      ['money', '網卡、eSIM 或漫遊'],
      ['money', '旅平險、不便險'],
      ['booking', '機票、選位'],
      ['booking', '住宿確認信'],
      ['booking', '機場交通（去程 / 回程）'],
      ['packing', '萬用轉接頭、行動電源（隨身帶上機）'],
      ['packing', '常備藥品'],
      ['packing', '當地天氣對應的衣物'],
    ],
  },
  {
    key: 'domestic',
    label: '國內旅遊',
    emoji: '🚗',
    items: [
      ['docs', '身分證、健保卡'],
      ['booking', '車票 / 租車'],
      ['booking', '住宿確認'],
      ['money', '悠遊卡 / 一卡通儲值'],
      ['packing', '充電器、行動電源'],
      ['packing', '雨具'],
      ['packing', '常備藥品'],
    ],
  },
];
