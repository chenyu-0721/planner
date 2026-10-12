import { Hono } from 'hono';
import {
  and, eq, inArray, desc, max,
} from 'drizzle-orm';
import {
  buckets, planMembers, taskAssignees, checklistItems, attachments, comments, myDayItems, users, tasks,
} from '../db/schema.js';
import { HttpError } from '../lib/errors.js';
import {
  getDb, toId, nowIso, today, loadTaskWithAccess, loadTaskSummary, deleteStoredFiles, fileUploadEnabled,
} from '../lib/helpers.js';
import { requireAuth } from '../lib/auth.js';
import {
  LIMITS, PROGRESS_VALUES, PRIORITY_VALUES, PREVIEW_TYPES, requireText, optionalText,
} from '../lib/limits.js';

const router = new Hono();
router.use('*', requireAuth);

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const isDate = (v) => v === null || v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v);

// 過長的名稱截斷（檔名保留副檔名）
function clipName(name, max = LIMITS.attachmentName) {
  if (name.length <= max) return name;
  const dot = name.lastIndexOf('.');
  const ext = dot > 0 ? name.slice(dot, dot + 10) : '';
  return `${name.slice(0, max - ext.length - 1)}…${ext}`;
}

const commentJson = (row) => ({
  id: row.id,
  content: row.content,
  createdAt: row.createdAt,
  userId: row.userId,
  user: row.user?.id ? row.user : null,
});

// 工作詳細資料（含意見）
router.get('/:id', async (c) => {
  const task = await loadTaskWithAccess(c, c.req.param('id'));
  const [summary, rows] = await Promise.all([
    loadTaskSummary(c, task.id),
    getDb(c).select({
      id: comments.id,
      content: comments.content,
      createdAt: comments.createdAt,
      userId: comments.userId,
      user: { id: users.id, displayName: users.displayName, color: users.color },
    }).from(comments).leftJoin(users, eq(users.id, comments.userId))
      .where(eq(comments.taskId, task.id)).orderBy(desc(comments.createdAt), desc(comments.id)),
  ]);
  return c.json({ ...summary, comments: rows.map(commentJson) });
});

router.put('/:id', async (c) => {
  const task = await loadTaskWithAccess(c, c.req.param('id'));
  const b = await c.req.json();
  const db = getDb(c);
  const user = c.get('user');
  const patch = {};

  if (b.title !== undefined) patch.title = requireText(b.title, LIMITS.taskTitle, '工作名稱');
  if (b.notes !== undefined) patch.notes = optionalText(b.notes, LIMITS.taskNotes, '附註') || null;
  if (b.priority !== undefined) {
    if (!PRIORITY_VALUES.includes(b.priority)) throw new HttpError(400, '優先順序不正確');
    patch.priority = b.priority;
  }
  if (b.progress !== undefined) {
    if (!PROGRESS_VALUES.includes(b.progress)) throw new HttpError(400, '進度不正確');
    if (b.progress === 100 && task.progress !== 100) {
      patch.completedAt = nowIso();
      patch.completedById = user.id;
    } else if (b.progress !== 100) {
      patch.completedAt = null;
      patch.completedById = null;
    }
    patch.progress = b.progress;
  }
  for (const key of ['startDate', 'dueDate']) {
    if (b[key] !== undefined) {
      if (!isDate(b[key])) throw new HttpError(400, '日期格式不正確');
      patch[key] = b[key] || null;
    }
  }
  if (b.sortOrder !== undefined) patch.sortOrder = Number(b.sortOrder) || 0;
  if (b.previewType !== undefined) {
    if (!PREVIEW_TYPES.includes(b.previewType)) throw new HttpError(400, '預覽類型不正確');
    patch.previewType = b.previewType;
  }
  if (b.labels !== undefined) {
    patch.labels = [...new Set((b.labels || []).map(Number).filter((n) => n >= 1 && n <= 25))].sort((x, y) => x - y);
  }
  if (b.bucketId !== undefined) {
    const bucket = await db.select({ id: buckets.id }).from(buckets)
      .where(and(eq(buckets.id, toId(b.bucketId)), eq(buckets.planId, task.planId))).get();
    if (!bucket) throw new HttpError(400, '貯體不存在');
    patch.bucketId = bucket.id;
  }

  const statements = [];
  if (Object.keys(patch).length) statements.push(db.update(tasks).set(patch).where(eq(tasks.id, task.id)));
  if (Array.isArray(b.assigneeIds)) {
    const ids = b.assigneeIds.slice(0, 50).map(Number);
    const members = ids.length
      ? await db.select({ userId: planMembers.userId }).from(planMembers)
        .where(and(eq(planMembers.planId, task.planId), inArray(planMembers.userId, ids)))
      : [];
    statements.push(db.delete(taskAssignees).where(eq(taskAssignees.taskId, task.id)));
    if (members.length) statements.push(db.insert(taskAssignees).values(members.map((m) => ({ taskId: task.id, userId: m.userId }))));
  }
  if (statements.length) await db.batch(statements);
  return c.json(await loadTaskSummary(c, task.id));
});

router.delete('/:id', async (c) => {
  const task = await loadTaskWithAccess(c, c.req.param('id'));
  await deleteStoredFiles(c, eq(attachments.taskId, task.id));
  await getDb(c).delete(tasks).where(eq(tasks.id, task.id));
  return c.json({ ok: true });
});

// 我的一天
router.put('/:id/myday', async (c) => {
  const task = await loadTaskWithAccess(c, c.req.param('id'));
  const { inMyDay } = await c.req.json();
  const db = getDb(c);
  const row = { userId: c.get('user').id, taskId: task.id, date: today(c) };
  if (inMyDay) await db.insert(myDayItems).values(row).onConflictDoNothing();
  else {
    await db.delete(myDayItems).where(and(
      eq(myDayItems.userId, row.userId), eq(myDayItems.taskId, row.taskId), eq(myDayItems.date, row.date),
    ));
  }
  return c.json({ inMyDay: !!inMyDay });
});

/* ---- 檢查清單 ---- */
router.post('/:id/checklist', async (c) => {
  const task = await loadTaskWithAccess(c, c.req.param('id'));
  const { title } = await c.req.json();
  const db = getDb(c);
  const row = await db.select({ v: max(checklistItems.sortOrder) }).from(checklistItems).where(eq(checklistItems.taskId, task.id)).get();
  const item = await db.insert(checklistItems).values({
    taskId: task.id,
    title: requireText(title, LIMITS.checklistTitle, '檢查清單項目'),
    sortOrder: (row?.v ?? 0) + 1,
  }).returning().get();
  return c.json(item, 201);
});

router.put('/:id/checklist/:itemId', async (c) => {
  const task = await loadTaskWithAccess(c, c.req.param('id'));
  const b = await c.req.json();
  const patch = {};
  if (b.title !== undefined && String(b.title).trim()) patch.title = requireText(b.title, LIMITS.checklistTitle, '檢查清單項目');
  if (b.isChecked !== undefined) patch.isChecked = !!b.isChecked;
  if (b.sortOrder !== undefined) patch.sortOrder = Number(b.sortOrder) || 0;
  const where = and(eq(checklistItems.id, toId(c.req.param('itemId'))), eq(checklistItems.taskId, task.id));
  const db = getDb(c);
  const item = Object.keys(patch).length
    ? await db.update(checklistItems).set(patch).where(where).returning().get()
    : await db.select().from(checklistItems).where(where).get();
  if (!item) throw new HttpError(404, '找不到項目');
  return c.json(item);
});

router.delete('/:id/checklist/:itemId', async (c) => {
  const task = await loadTaskWithAccess(c, c.req.param('id'));
  await getDb(c).delete(checklistItems)
    .where(and(eq(checklistItems.id, toId(c.req.param('itemId'))), eq(checklistItems.taskId, task.id)));
  return c.json({ ok: true });
});

/* ---- 附件：連結（JSON）或檔案（multipart，存到 R2） ---- */
const attachmentJson = ({
  id, taskId, type, name, url, mimeType, size, createdAt,
}) => ({
  id, taskId, type, name, url, mimeType, size, createdAt,
});

router.post('/:id/attachments', async (c) => {
  const task = await loadTaskWithAccess(c, c.req.param('id'));
  const user = c.get('user');
  let data;
  if ((c.req.header('content-type') || '').includes('multipart/form-data')) {
    if (!fileUploadEnabled(c)) throw new HttpError(400, '尚未啟用檔案上傳，請改用連結附件');
    const form = await c.req.parseBody();
    const file = form.file;
    if (!(file instanceof File)) throw new HttpError(400, '請選擇檔案');
    if (file.size > MAX_FILE_SIZE) throw new HttpError(400, '檔案不可超過 20MB');
    const dot = file.name.lastIndexOf('.');
    const ext = dot > 0 ? file.name.slice(dot, dot + 10).replace(/[^.\w]/g, '') : '';
    const key = `${Date.now()}-${crypto.randomUUID().slice(0, 12)}${ext}`;
    await c.env.UPLOADS.put(key, file.stream(), {
      httpMetadata: { contentType: file.type || 'application/octet-stream' },
    });
    data = {
      type: 'file',
      name: clipName(file.name),
      url: `/uploads/${key}`,
      storageKey: key,
      mimeType: (file.type || '').slice(0, 127) || null,
      size: file.size,
    };
  } else {
    const b = await c.req.json();
    let url = String(b.url || '').trim();
    if (!url) throw new HttpError(400, '請輸入連結網址');
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    if (url.length > LIMITS.attachmentUrl) throw new HttpError(400, `連結網址不可超過 ${LIMITS.attachmentUrl} 個字`);
    data = { type: 'link', name: clipName(String(b.name || '').trim() || url), url };
  }
  const att = await getDb(c).insert(attachments).values({ ...data, taskId: task.id, createdById: user.id }).returning().get();
  return c.json(attachmentJson(att), 201);
});

router.delete('/:id/attachments/:attId', async (c) => {
  const task = await loadTaskWithAccess(c, c.req.param('id'));
  const db = getDb(c);
  const where = and(eq(attachments.id, toId(c.req.param('attId'))), eq(attachments.taskId, task.id));
  const att = await db.select().from(attachments).where(where).get();
  if (!att) throw new HttpError(404, '找不到附件');
  if (att.storageKey && fileUploadEnabled(c)) await c.env.UPLOADS.delete(att.storageKey);
  await db.delete(attachments).where(where);
  return c.json({ ok: true });
});

/* ---- 意見 ---- */
router.post('/:id/comments', async (c) => {
  const task = await loadTaskWithAccess(c, c.req.param('id'));
  const { content } = await c.req.json();
  const user = c.get('user');
  const row = await getDb(c).insert(comments).values({
    taskId: task.id, userId: user.id, content: requireText(content, LIMITS.comment, '意見'),
  }).returning().get();
  return c.json(commentJson({ ...row, user: { id: user.id, displayName: user.displayName, color: user.color } }), 201);
});

router.delete('/:id/comments/:commentId', async (c) => {
  const task = await loadTaskWithAccess(c, c.req.param('id'));
  const user = c.get('user');
  const db = getDb(c);
  const where = and(eq(comments.id, toId(c.req.param('commentId'))), eq(comments.taskId, task.id));
  const row = await db.select().from(comments).where(where).get();
  if (!row) throw new HttpError(404, '找不到意見');
  if (row.userId !== user.id && user.role !== 'admin') throw new HttpError(403, '只能刪除自己的意見');
  await db.delete(comments).where(where);
  return c.json({ ok: true });
});

export default router;
