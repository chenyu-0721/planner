// Planner 共用常數與工具

export const LABELS = [
  { id: 1, name: '粉紅色', bg: '#f7d1e5', fg: '#7b1450', dot: '#e3008c' },
  { id: 2, name: '紅色', bg: '#f6cdd0', fg: '#8e1b20', dot: '#d13438' },
  { id: 3, name: '黃色', bg: '#fbefb5', fg: '#6b5300', dot: '#fde300' },
  { id: 4, name: '綠色', bg: '#d0e9c6', fg: '#2a5a12', dot: '#13a10e' },
  { id: 5, name: '藍色', bg: '#cbe1f6', fg: '#0b4a85', dot: '#0078d4' },
  { id: 6, name: '紫色', bg: '#e0d4f2', fg: '#4b2a85', dot: '#8764b8' },
  { id: 7, name: '青銅色', bg: '#ecd8c4', fg: '#6b3d17', dot: '#a74109' },
  { id: 8, name: '萊姆綠', bg: '#e3f2bd', fg: '#4b5e0e', dot: '#8cbd18' },
  { id: 9, name: '水藍色', bg: '#c4eaf0', fg: '#0d5d6a', dot: '#00b7c3' },
  { id: 10, name: '灰色', bg: '#e1dfdd', fg: '#3b3a39', dot: '#7a7574' },
  { id: 11, name: '銀色', bg: '#e9edf0', fg: '#4a5560', dot: '#859599' },
  { id: 12, name: '棕色', bg: '#e6d6cb', fg: '#5c3b28', dot: '#8e562e' },
  { id: 13, name: '小紅莓色', bg: '#f3cbd5', fg: '#7a1530', dot: '#c50f1f' },
  { id: 14, name: '橙色', bg: '#fbd8c0', fg: '#8a3a08', dot: '#f7630c' },
  { id: 15, name: '桃色', bg: '#fde2cf', fg: '#8a4a1b', dot: '#ff8c00' },
  { id: 16, name: '金盞花色', bg: '#fde5ad', fg: '#7a5100', dot: '#eaa300' },
  { id: 17, name: '淺綠色', bg: '#d7f2cf', fg: '#26631b', dot: '#00cc6a' },
  { id: 18, name: '深綠色', bg: '#bddfc3', fg: '#0b4d1d', dot: '#0b6a0b' },
  { id: 19, name: '藍綠色', bg: '#c3e7e2', fg: '#0b5a52', dot: '#038387' },
  { id: 20, name: '淺藍色', bg: '#d8ebfa', fg: '#155a96', dot: '#3a96dd' },
  { id: 21, name: '深藍色', bg: '#c7d0ec', fg: '#1b2f73', dot: '#004e8c' },
  { id: 22, name: '薰衣草色', bg: '#e6def8', fg: '#4f3c8a', dot: '#7160e8' },
  { id: 23, name: '梅紫色', bg: '#eecde5', fg: '#6b1c5a', dot: '#77004d' },
  { id: 24, name: '淺灰色', bg: '#edebe9', fg: '#484644', dot: '#b3b0ad' },
  { id: 25, name: '深灰色', bg: '#cfcdcb', fg: '#252423', dot: '#3b3a39' },
];

export const labelInfo = (id) => LABELS[id - 1] || LABELS[0];
export const labelName = (labelNames, id) => (labelNames && labelNames[id]) || labelInfo(id).name;

export const PRIORITIES = [
  { value: 1, label: '緊急' },
  { value: 3, label: '重要' },
  { value: 5, label: '中' },
  { value: 9, label: '低' },
];
export const priorityLabel = (v) => PRIORITIES.find((p) => p.value === v)?.label || '中';

export const PROGRESS = [
  { value: 0, label: '未開始' },
  { value: 50, label: '進行中' },
  { value: 100, label: '已完成' },
];
export const progressLabel = (v) => PROGRESS.find((p) => p.value === v)?.label || '未開始';

export const PLAN_COLORS = [
  '#c239b3', '#0078d4', '#038387', '#498205', '#ca5010', '#8764b8',
  '#d13438', '#004e8c', '#986f0b', '#5c2e91', '#00a383', '#e3008c',
];
export const planColor = (i) => PLAN_COLORS[(Number(i) || 0) % PLAN_COLORS.length];

// 使用者：中文取後兩字（名字）；計劃：中文取前兩字
export function initials(name = '', fromStart = false) {
  const s = String(name).replace(/[\s()（）[\]【】「」『』,，.。:：;；!！?？'"、/\\-]+/g, ' ').trim();
  if (!s) return '?';
  if (/[一-鿿]/.test(s[0])) {
    const cjk = s.replace(/\s+/g, '');
    if (cjk.length <= 2) return cjk;
    return fromStart ? cjk.slice(0, 2) : cjk.slice(-2);
  }
  const parts = s.split(/[\s._-]+/).filter(Boolean);
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

/* ---------- 日期 ---------- */

const pad = (n) => String(n).padStart(2, '0');
export const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseDate = (s) => {
  if (!s) return null;
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const todayStr = () => toDateStr(new Date());
export const addDays = (s, n) => {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
};
export const diffDays = (a, b) => Math.round((parseDate(a) - parseDate(b)) / 86400000);

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
export function fmtShort(s) {
  const d = parseDate(s);
  if (!d) return '';
  const now = new Date();
  if (d.getFullYear() !== now.getFullYear()) return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
export function fmtLong(s) {
  const d = parseDate(s);
  if (!d) return '';
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 (週${WEEKDAYS[d.getDay()]})`;
}
export function fmtDateTime(v) {
  if (!v) return '';
  const d = new Date(v);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const isLate = (t) => t.progress !== 100 && t.dueDate && t.dueDate < todayStr();

// 本週（週日~週六）
function weekRange(offsetWeeks = 0) {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + offsetWeeks * 7);
  const start = toDateStr(d);
  return [start, addDays(start, 6)];
}

export const DUE_GROUPS = [
  { key: 'late', label: '逾期' },
  { key: 'today', label: '今天' },
  { key: 'tomorrow', label: '明天' },
  { key: 'thisWeek', label: '本週' },
  { key: 'nextWeek', label: '下週' },
  { key: 'future', label: '未來' },
  { key: 'none', label: '無日期' },
];

export function dueCategory(t) {
  if (!t.dueDate) return 'none';
  const today = todayStr();
  if (t.dueDate < today) return t.progress === 100 ? 'thisWeek' : 'late';
  if (t.dueDate === today) return 'today';
  if (t.dueDate === addDays(today, 1)) return 'tomorrow';
  const [, thisEnd] = weekRange(0);
  if (t.dueDate <= thisEnd) return 'thisWeek';
  const [, nextEnd] = weekRange(1);
  if (t.dueDate <= nextEnd) return 'nextWeek';
  return 'future';
}

// 拖曳到到期日群組時要設定的日期
export function dateForDueCategory(key) {
  const today = todayStr();
  switch (key) {
    case 'late': return addDays(today, -1);
    case 'today': return today;
    case 'tomorrow': return addDays(today, 1);
    case 'thisWeek': {
      const [, end] = weekRange(0);
      return end > addDays(today, 1) ? end : addDays(today, 1);
    }
    case 'nextWeek': return weekRange(1)[1];
    case 'future': return addDays(weekRange(1)[1], 7);
    default: return null;
  }
}

/* ---------- 篩選 ---------- */

export const emptyFilters = () => ({
  keyword: '',
  due: [],
  priority: [],
  progress: [],
  labels: [],
  assignees: [],
  buckets: [],
});

export function countFilters(f) {
  return (f.keyword ? 1 : 0) + f.due.length + f.priority.length + f.progress.length
    + f.labels.length + f.assignees.length + f.buckets.length;
}

export function applyFilters(tasks, f) {
  const kw = f.keyword.trim().toLowerCase();
  return tasks.filter((t) => {
    if (kw && !t.title.toLowerCase().includes(kw)) return false;
    if (f.due.length && !f.due.includes(dueCategory(t))) return false;
    if (f.priority.length && !f.priority.includes(t.priority)) return false;
    if (f.progress.length && !f.progress.includes(t.progress)) return false;
    if (f.labels.length && !t.labels.some((l) => f.labels.includes(l))) return false;
    if (f.buckets.length && !f.buckets.includes(t.bucketId)) return false;
    if (f.assignees.length) {
      const ok = f.assignees.some((a) => (a === 0 ? t.assigneeIds.length === 0 : t.assigneeIds.includes(a)));
      if (!ok) return false;
    }
    return true;
  });
}

/* ---------- 排序 ---------- */

// 依插入位置計算新的 sortOrder
export function sortOrderAt(list, index) {
  const before = list[index - 1];
  const after = list[index];
  if (before && after) return (before.sortOrder + after.sortOrder) / 2;
  if (before) return before.sortOrder + 1;
  if (after) return after.sortOrder - 1;
  return 0;
}

export const bySort = (a, b) => a.sortOrder - b.sortOrder || a.id - b.id;
