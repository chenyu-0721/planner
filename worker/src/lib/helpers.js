import { drizzle } from 'drizzle-orm/d1';
import {
  and, eq, inArray, count, sql,
} from 'drizzle-orm';
import * as schema from '../db/schema.js';
import { HttpError } from './errors.js';

const {
  plans, planMembers, buckets, tasks, taskAssignees, checklistItems, attachments, comments, myDayItems,
} = schema;

export function getDb(c) {
  let db = c.get('db');
  if (!db) {
    db = drizzle(c.env.DB, { schema });
    c.set('db', db);
  }
  return db;
}

export const nowIso = () => new Date().toISOString();

// 依設定的時區取得今天日期（Workers 執行環境為 UTC）
export function today(c) {
  const tz = c.env.TIMEZONE || 'Asia/Taipei';
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function safeUser(u) {
  if (!u) return null;
  const {
    id, username, displayName, email, role, color, isActive,
  } = u;
  return {
    id, username, displayName, email, role, color, isActive,
  };
}

export const toId = (v) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, '參數不正確');
  return n;
};

/* ---------- 一次送出多個查詢 ----------
 * D1 每次查詢都要經過網路來回；用 batch 把同一個請求需要的查詢合併成一趟
 * named: { key: query }，回傳 { key: rows }
 */
export async function runBatch(db, named) {
  const keys = Object.keys(named);
  const results = await db.batch(keys.map((k) => named[k]));
  return Object.fromEntries(keys.map((k, i) => [k, results[i]]));
}

/* ---------- 權限 ----------
 * 計劃與成員資格用一個 JOIN 查詢取得（原本要兩趟）
 * 注意：batch 中的 JOIN 若有同名欄位會互相覆蓋，重名欄位一律用 alias() 取別名
 */
export const alias = (column, name) => sql`${column}`.mapWith(column).as(name);

export const planAccessQuery = (db, planId, userId) => db
  .select({ plan: plans, memberId: alias(planMembers.id, 'member_id'), pinned: planMembers.pinned })
  .from(plans)
  .leftJoin(planMembers, and(eq(planMembers.planId, plans.id), eq(planMembers.userId, userId)))
  .where(eq(plans.id, planId));

export function checkPlanAccess(user, row) {
  if (!row) throw new HttpError(404, '找不到計劃');
  if (user.role !== 'admin' && !row.memberId) throw new HttpError(403, '你不是此計劃的成員');
  return row.plan;
}

// 確認使用者可存取該計劃（成員或管理員）
export async function assertPlanAccess(c, planId) {
  const user = c.get('user');
  const [row] = await planAccessQuery(getDb(c), toId(planId), user.id);
  return checkPlanAccess(user, row);
}

export const taskAccessQuery = (db, taskId, userId) => db
  .select({ task: tasks, memberId: alias(planMembers.id, 'member_id') })
  .from(tasks)
  .leftJoin(planMembers, and(eq(planMembers.planId, tasks.planId), eq(planMembers.userId, userId)))
  .where(eq(tasks.id, taskId));

export function checkTaskAccess(user, row) {
  if (!row) throw new HttpError(404, '找不到工作');
  if (user.role !== 'admin' && !row.memberId) throw new HttpError(403, '你不是此計劃的成員');
  return row.task;
}

// 工作與權限一次查詢（原本要三趟）
export async function loadTaskWithAccess(c, taskId) {
  const user = c.get('user');
  const [row] = await taskAccessQuery(getDb(c), toId(taskId), user.id);
  return checkTaskAccess(user, row);
}

// 使用者參與的計劃 id（子查詢，避免 D1 參數數量上限）
export const myPlanIdsQuery = (db, userId) => db.select({ id: planMembers.planId }).from(planMembers).where(eq(planMembers.userId, userId));

/* ---------- 工作摘要 ---------- */

/**
 * 卡片需要的工作摘要所用的查詢（可和其他查詢放進同一個 batch）
 * @param where 工作的篩選條件
 * @param withPlanBucket 是否附上計劃與貯體名稱（我的工作 / 我的一天）
 */
export function taskSummaryQueries(c, where, { withPlanBucket = false, prefix = '' } = {}) {
  const db = getDb(c);
  const user = c.get('user');
  const ids = db.select({ id: tasks.id }).from(tasks).where(where);
  const q = {
    tasks: db.select().from(tasks).where(where).orderBy(tasks.sortOrder, tasks.id),
    assignees: db.select().from(taskAssignees).where(inArray(taskAssignees.taskId, ids)),
    checklist: db.select().from(checklistItems).where(inArray(checklistItems.taskId, ids)).orderBy(checklistItems.sortOrder, checklistItems.id),
    attachments: db.select({
      id: attachments.id, taskId: attachments.taskId, type: attachments.type, name: attachments.name, url: attachments.url, mimeType: attachments.mimeType,
    }).from(attachments).where(inArray(attachments.taskId, ids)).orderBy(attachments.id),
    commentCounts: db.select({ taskId: comments.taskId, cnt: count() }).from(comments).where(inArray(comments.taskId, ids)).groupBy(comments.taskId),
    myDay: db.select({ taskId: myDayItems.taskId }).from(myDayItems)
      .where(and(inArray(myDayItems.taskId, ids), eq(myDayItems.userId, user.id), eq(myDayItems.date, today(c)))),
  };
  if (withPlanBucket) {
    q.plans = db.select({
      id: plans.id, name: plans.name, color: plans.color, labelNames: plans.labelNames,
    }).from(plans).where(inArray(plans.id, db.select({ id: tasks.planId }).from(tasks).where(where)));
    q.buckets = db.select({ id: buckets.id, name: buckets.name }).from(buckets)
      .where(inArray(buckets.id, db.select({ id: tasks.bucketId }).from(tasks).where(where)));
  }
  return Object.fromEntries(Object.entries(q).map(([k, v]) => [prefix + k, v]));
}

// 把 taskSummaryQueries 的結果組成卡片資料
export function buildTaskSummaries(r, { withPlanBucket = false, prefix = '' } = {}) {
  const get = (k) => r[prefix + k] || [];
  const group = (list) => list.reduce((m, row) => (m.get(row.taskId)?.push(row) ?? m.set(row.taskId, [row]), m), new Map());
  const assignMap = group(get('assignees'));
  const checkMap = group(get('checklist'));
  const attMap = group(get('attachments'));
  const commentMap = new Map(get('commentCounts').map((row) => [row.taskId, Number(row.cnt)]));
  const myDaySet = new Set(get('myDay').map((row) => row.taskId));
  const planMap = new Map(get('plans').map((p) => [p.id, p]));
  const bucketMap = new Map(get('buckets').map((b) => [b.id, b]));

  return get('tasks').map((t) => {
    const checklist = (checkMap.get(t.id) || []).map(({
      id, title, isChecked, sortOrder,
    }) => ({
      id, title, isChecked, sortOrder,
    }));
    const data = {
      id: t.id,
      planId: t.planId,
      bucketId: t.bucketId,
      title: t.title,
      notes: t.notes || '',
      progress: t.progress,
      priority: t.priority,
      startDate: t.startDate,
      dueDate: t.dueDate,
      sortOrder: t.sortOrder,
      previewType: t.previewType,
      labels: t.labels || [],
      completedAt: t.completedAt,
      completedById: t.completedById,
      createdById: t.createdById,
      createdAt: t.createdAt,
      assigneeIds: (assignMap.get(t.id) || []).map((a) => a.userId),
      checklist,
      checklistTotal: checklist.length,
      checklistDone: checklist.filter((i) => i.isChecked).length,
      attachments: (attMap.get(t.id) || []).map(({ taskId, ...a }) => a),
      commentCount: commentMap.get(t.id) || 0,
      inMyDay: myDaySet.has(t.id),
    };
    if (withPlanBucket) {
      data.plan = planMap.get(t.planId) || null;
      data.bucket = bucketMap.get(t.bucketId) || null;
    }
    return data;
  });
}

export async function loadTaskSummaries(c, where, opts = {}) {
  const r = await runBatch(getDb(c), taskSummaryQueries(c, where, opts));
  return buildTaskSummaries(r, opts);
}

export async function loadTaskSummary(c, taskId) {
  const [task] = await loadTaskSummaries(c, eq(tasks.id, taskId));
  return task;
}

// 是否啟用檔案上傳（wrangler.jsonc 有綁定 R2 才會啟用）
export const fileUploadEnabled = (c) => !!c.env.UPLOADS;

// 刪除 R2 中的附件檔案
export async function deleteStoredFiles(c, where) {
  if (!fileUploadEnabled(c)) return;
  const rows = await getDb(c).select({ key: attachments.storageKey }).from(attachments)
    .where(and(eq(attachments.type, 'file'), where));
  const keys = rows.map((r) => r.key).filter(Boolean);
  for (let i = 0; i < keys.length; i += 1000) await c.env.UPLOADS.delete(keys.slice(i, i + 1000));
}

