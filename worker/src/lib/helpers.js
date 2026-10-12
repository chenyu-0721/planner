import { drizzle } from 'drizzle-orm/d1';
import {
  and, eq, inArray, count,
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

// 確認使用者可存取該計劃（成員或管理員）
export async function assertPlanAccess(c, planId) {
  const db = getDb(c);
  const user = c.get('user');
  const plan = await db.select().from(plans).where(eq(plans.id, toId(planId))).get();
  if (!plan) throw new HttpError(404, '找不到計劃');
  if (user.role === 'admin') return plan;
  const member = await db.select({ id: planMembers.id }).from(planMembers)
    .where(and(eq(planMembers.planId, plan.id), eq(planMembers.userId, user.id))).get();
  if (!member) throw new HttpError(403, '你不是此計劃的成員');
  return plan;
}

export async function loadTaskWithAccess(c, taskId) {
  const task = await getDb(c).select().from(tasks).where(eq(tasks.id, toId(taskId))).get();
  if (!task) throw new HttpError(404, '找不到工作');
  await assertPlanAccess(c, task.planId);
  return task;
}

// 使用者參與的計劃 id（子查詢，避免 D1 參數數量上限）
export const myPlanIdsQuery = (db, userId) => db.select({ id: planMembers.planId }).from(planMembers).where(eq(planMembers.userId, userId));

/**
 * 取得卡片需要的工作摘要
 * @param where 工作的篩選條件
 * @param withPlanBucket 是否附上計劃與貯體名稱（我的工作 / 我的一天）
 */
export async function loadTaskSummaries(c, where, { withPlanBucket = false } = {}) {
  const db = getDb(c);
  const user = c.get('user');
  const rows = await db.select().from(tasks).where(where).orderBy(tasks.sortOrder, tasks.id);
  if (!rows.length) return [];

  const ids = db.select({ id: tasks.id }).from(tasks).where(where);
  const [assignRows, checkRows, attRows, commentRows, myDayRows, planRows, bucketRows] = await Promise.all([
    db.select().from(taskAssignees).where(inArray(taskAssignees.taskId, ids)),
    db.select().from(checklistItems).where(inArray(checklistItems.taskId, ids)).orderBy(checklistItems.sortOrder, checklistItems.id),
    db.select({
      id: attachments.id, taskId: attachments.taskId, type: attachments.type, name: attachments.name, url: attachments.url, mimeType: attachments.mimeType,
    }).from(attachments).where(inArray(attachments.taskId, ids)).orderBy(attachments.id),
    db.select({ taskId: comments.taskId, cnt: count() }).from(comments).where(inArray(comments.taskId, ids)).groupBy(comments.taskId),
    db.select({ taskId: myDayItems.taskId }).from(myDayItems)
      .where(and(inArray(myDayItems.taskId, ids), eq(myDayItems.userId, user.id), eq(myDayItems.date, today(c)))),
    withPlanBucket
      ? db.select({
        id: plans.id, name: plans.name, color: plans.color, labelNames: plans.labelNames,
      }).from(plans).where(inArray(plans.id, db.select({ id: tasks.planId }).from(tasks).where(where)))
      : [],
    withPlanBucket
      ? db.select({ id: buckets.id, name: buckets.name }).from(buckets).where(inArray(buckets.id, db.select({ id: tasks.bucketId }).from(tasks).where(where)))
      : [],
  ]);

  const group = (list, key = 'taskId') => list.reduce((m, r) => (m.get(r[key])?.push(r) ?? m.set(r[key], [r]), m), new Map());
  const assignMap = group(assignRows);
  const checkMap = group(checkRows);
  const attMap = group(attRows);
  const commentMap = new Map(commentRows.map((r) => [r.taskId, Number(r.cnt)]));
  const myDaySet = new Set(myDayRows.map((r) => r.taskId));
  const planMap = new Map(planRows.map((p) => [p.id, p]));
  const bucketMap = new Map(bucketRows.map((b) => [b.id, b]));

  return rows.map((t) => {
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

