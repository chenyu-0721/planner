import { HttpError } from './errors.js';

// 各欄位長度上限（資料表 CHECK 與前端輸入框使用相同數值）
export const LIMITS = {
  username: 50,
  displayName: 50,
  email: 100,
  planName: 100,
  planDescription: 500,
  labelName: 50,
  labelNamesJson: 1500,
  bucketName: 100,
  taskTitle: 200,
  taskNotes: 10000,
  checklistTitle: 100,
  attachmentName: 200,
  attachmentUrl: 1000,
  comment: 2000,
  tripName: 100,
  tripDescription: 500,
  stopTitle: 100,
  stopAddress: 200,
  stopNotes: 1000,
  categoryEmoji: 16, // 一個 emoji 可能由多個字元組成（例如國旗、膚色）
  categoryLabel: 20,
};
export const MAX_CUSTOM_CATEGORIES = 60;
export const LANE_PHASES = ['depart', 'return'];

export const USERNAME_RE = /^[A-Za-z0-9_.-]{3,50}$/;
export const MIN_PASSWORD = 6;
export const PROGRESS_VALUES = [0, 50, 100];
export const PRIORITY_VALUES = [1, 3, 5, 9];
export const STOP_CATEGORIES = ['sight', 'food', 'hotel', 'transport', 'shopping', 'activity', 'other'];
export const MAX_TRIP_DAYS = 60;
// 交通方式：每一段可個別設定；行程預設只能選道路類（高鐵 / 火車 / 捷運只適用於單一路段）
export const TRAVEL_MODES = ['car', 'scooter', 'bike', 'foot', 'hsr', 'train', 'mrt', 'straight'];
export const DEFAULT_TRAVEL_MODES = ['car', 'scooter', 'bike', 'foot', 'straight'];
export const PREVIEW_TYPES = ['automatic', 'noPreview', 'checklist', 'description', 'reference'];

// 檢查必填與長度，回傳 trim 後的字串
export function requireText(value, max, label) {
  const s = String(value ?? '').trim();
  if (!s) throw new HttpError(400, `請輸入${label}`);
  if (s.length > max) throw new HttpError(400, `${label}不可超過 ${max} 個字`);
  return s;
}

export function optionalText(value, max, label) {
  if (value == null) return null;
  const s = String(value);
  if (s.length > max) throw new HttpError(400, `${label}不可超過 ${max} 個字`);
  return s;
}

export function checkPassword(pw) {
  if (!pw || String(pw).length < MIN_PASSWORD) throw new HttpError(400, `密碼至少 ${MIN_PASSWORD} 個字元`);
  return String(pw);
}
