import { Hono } from 'hono';
import {
  and, eq, inArray, asc, min, max, count, sql,
} from 'drizzle-orm';
import {
  plans, planMembers, buckets, tasks, taskAssignees, attachments, users,
} from '../db/schema.js';
import { HttpError } from '../lib/errors.js';
import {
  getDb, safeUser, toId, nowIso, assertPlanAccess, loadTaskSummaries, loadTaskSummary,
  myPlanIdsQuery, deleteStoredFiles,
} from '../lib/helpers.js';
import { requireAuth } from '../lib/auth.js';
import {
  LIMITS, PROGRESS_VALUES, PRIORITY_VALUES, requireText, optionalText,
} from '../lib/limits.js';

const router = new Hono();
router.use('*', requireAuth);

const canManage = (user, plan) => user.role === 'admin' || plan.ownerId === user.id;
const isDate = (v) => v == null || v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v);

// 我的計劃清單
router.get('/', async (c) => {
  const db = getDb(c);
  const user = c.get('user');
  const myPlanIds = myPlanIdsQuery(db, user.id);
  const [rows, taskStats, memberStats] = await Promise.all([
    db.select({
      plan: plans, pinned: planMembers.pinned, role: planMembers.role, lastViewedAt: planMembers.lastViewedAt,
    }).from(planMembers).innerJoin(plans, eq(plans.id, planMembers.planId)).where(eq(planMembers.userId, user.id)),
    db.select({
      planId: tasks.planId,
      total: count(),
      done: sql`sum(case when ${tasks.progress} = 100 then 1 else 0 end)`,
    }).from(tasks).where(inArray(tasks.planId, myPlanIds)).groupBy(tasks.planId),
    db.select({ planId: planMembers.planId, cnt: count() }).from(planMembers)
      .where(inArray(planMembers.planId, myPlanIds)).groupBy(planMembers.planId),
  ]);
  const statMap = new Map(taskStats.map((s) => [s.planId, s]));
  const memberMap = new Map(memberStats.map((s) => [s.planId, Number(s.cnt)]));
  return c.json(rows.map(({ plan, ...m }) => ({
    id: plan.id,
    name: plan.name,
    description: plan.description,
    color: plan.color,
    ownerId: plan.ownerId,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
    pinned: m.pinned,
    role: m.role,
    lastViewedAt: m.lastViewedAt,
    taskCount: Number(statMap.get(plan.id)?.total || 0),
    completedCount: Number(statMap.get(plan.id)?.done || 0),
    memberCount: memberMap.get(plan.id) || 0,
  })));
});

router.post('/', async (c) => {
  const body = await c.req.json();
  const db = getDb(c);
  const user = c.get('user');
  const plan = await db.insert(plans).values({
    name: requireText(body.name, LIMITS.planName, '計劃名稱'),
    description: optionalText(body.description, LIMITS.planDescription, '計劃描述') || null,
    color: Number.isInteger(body.color) && body.color >= 0 && body.color < 12 ? body.color : Math.floor(Math.random() * 12),
    ownerId: user.id,
  }).returning().get();
  await db.batch([
    db.insert(planMembers).values({
      planId: plan.id, userId: user.id, role: 'owner', lastViewedAt: nowIso(),
    }),
    db.insert(buckets).values({ planId: plan.id, name: '待辦事項', sortOrder: 0 }),
  ]);
  return c.json(plan, 201);
});

// 計劃完整資料（成員、貯體、工作）
router.get('/:id', async (c) => {
  const plan = await assertPlanAccess(c, c.req.param('id'));
  const db = getDb(c);
  const user = c.get('user');
  const [memberRows, bucketRows, taskRows] = await Promise.all([
    db.select({ user: users, planRole: planMembers.role, pinned: planMembers.pinned }).from(planMembers)
      .innerJoin(users, eq(users.id, planMembers.userId)).where(eq(planMembers.planId, plan.id)).orderBy(asc(planMembers.id)),
    db.select({ id: buckets.id, name: buckets.name, sortOrder: buckets.sortOrder }).from(buckets)
      .where(eq(buckets.planId, plan.id)).orderBy(asc(buckets.sortOrder), asc(buckets.id)),
    loadTaskSummaries(c, eq(tasks.planId, plan.id)),
  ]);
  const mine = memberRows.find((m) => m.user.id === user.id);
  if (mine) {
    await db.update(planMembers).set({ lastViewedAt: nowIso() })
      .where(and(eq(planMembers.planId, plan.id), eq(planMembers.userId, user.id)));
  }
  return c.json({
    plan: {
      id: plan.id,
      name: plan.name,
      description: plan.description,
      color: plan.color,
      ownerId: plan.ownerId,
      labelNames: plan.labelNames,
      createdAt: plan.createdAt,
      pinned: !!mine?.pinned,
      isMember: !!mine,
      canManage: canManage(user, plan),
    },
    members: memberRows.map((m) => ({ ...safeUser(m.user), planRole: m.planRole })),
    buckets: bucketRows,
    tasks: taskRows,
  });
});

router.put('/:id', async (c) => {
  const plan = await assertPlanAccess(c, c.req.param('id'));
  const body = await c.req.json();
  const patch = {};
  if (body.name !== undefined) patch.name = requireText(body.name, LIMITS.planName, '計劃名稱');
  if (body.description !== undefined) patch.description = optionalText(body.description, LIMITS.planDescription, '計劃描述') || null;
  if (body.color !== undefined) patch.color = Math.min(255, Math.max(0, Number(body.color) || 0));
  if (body.labelNames !== undefined && typeof body.labelNames === 'object') {
    // 只保留 1~25 號標籤，名稱最多 LIMITS.labelName 字
    patch.labelNames = Object.fromEntries(Object.entries(body.labelNames || {})
      .filter(([k, v]) => Number(k) >= 1 && Number(k) <= 25 && typeof v === 'string' && v.trim())
      .map(([k, v]) => [k, v.trim().slice(0, LIMITS.labelName)]));
  }
  const updated = Object.keys(patch).length
    ? await getDb(c).update(plans).set(patch).where(eq(plans.id, plan.id)).returning().get()
    : plan;
  return c.json({
    id: updated.id, name: updated.name, description: updated.description, color: updated.color, labelNames: updated.labelNames,
  });
});

router.delete('/:id', async (c) => {
  const plan = await assertPlanAccess(c, c.req.param('id'));
  if (!canManage(c.get('user'), plan)) throw new HttpError(403, '只有計劃擁有者可以刪除計劃');
  const db = getDb(c);
  await deleteStoredFiles(c, inArray(attachments.taskId, db.select({ id: tasks.id }).from(tasks).where(eq(tasks.planId, plan.id))));
  await db.delete(plans).where(eq(plans.id, plan.id));
  return c.json({ ok: true });
});

router.put('/:id/pin', async (c) => {
  const plan = await assertPlanAccess(c, c.req.param('id'));
  const { pinned } = await c.req.json();
  const member = await getDb(c).update(planMembers).set({ pinned: !!pinned })
    .where(and(eq(planMembers.planId, plan.id), eq(planMembers.userId, c.get('user').id))).returning().get();
  if (!member) throw new HttpError(400, '只有成員可以釘選計劃');
  return c.json({ pinned: member.pinned });
});

/* ---- 成員 ---- */
router.post('/:id/members', async (c) => {
  const plan = await assertPlanAccess(c, c.req.param('id'));
  const { userId } = await c.req.json();
  const db = getDb(c);
  const user = await db.select().from(users).where(eq(users.id, toId(userId))).get();
  if (!user || !user.isActive) throw new HttpError(404, '找不到使用者');
  await db.insert(planMembers).values({ planId: plan.id, userId: user.id, role: 'member' }).onConflictDoNothing();
  const member = await db.select().from(planMembers)
    .where(and(eq(planMembers.planId, plan.id), eq(planMembers.userId, user.id))).get();
  return c.json({ ...safeUser(user), planRole: member.role }, 201);
});

router.delete('/:id/members/:userId', async (c) => {
  const plan = await assertPlanAccess(c, c.req.param('id'));
  const userId = toId(c.req.param('userId'));
  if (userId !== c.get('user').id && !canManage(c.get('user'), plan)) throw new HttpError(403, '沒有權限移除成員');
  if (userId === plan.ownerId) throw new HttpError(400, '無法移除計劃擁有者');
  const db = getDb(c);
  await db.batch([
    db.delete(taskAssignees).where(and(
      eq(taskAssignees.userId, userId),
      inArray(taskAssignees.taskId, db.select({ id: tasks.id }).from(tasks).where(eq(tasks.planId, plan.id))),
    )),
    db.delete(planMembers).where(and(eq(planMembers.planId, plan.id), eq(planMembers.userId, userId))),
  ]);
  return c.json({ ok: true });
});

/* ---- 貯體 ---- */
router.post('/:id/buckets', async (c) => {
  const plan = await assertPlanAccess(c, c.req.param('id'));
  const body = await c.req.json();
  const db = getDb(c);
  let { sortOrder } = body;
  if (sortOrder === undefined) {
    const row = await db.select({ v: max(buckets.sortOrder) }).from(buckets).where(eq(buckets.planId, plan.id)).get();
    sortOrder = (row?.v ?? 0) + 1;
  }
  const bucket = await db.insert(buckets).values({
    planId: plan.id, name: requireText(body.name, LIMITS.bucketName, '貯體名稱'), sortOrder: Number(sortOrder) || 0,
  }).returning({ id: buckets.id, name: buckets.name, sortOrder: buckets.sortOrder }).get();
  return c.json(bucket, 201);
});

/* ---- 新增工作 ---- */
router.post('/:id/tasks', async (c) => {
  const plan = await assertPlanAccess(c, c.req.param('id'));
  const body = await c.req.json();
  const db = getDb(c);
  const user = c.get('user');
  const title = requireText(body.title, LIMITS.taskTitle, '工作名稱');
  if (!isDate(body.startDate) || !isDate(body.dueDate)) throw new HttpError(400, '日期格式不正確');

  let bucketId = body.bucketId ? toId(body.bucketId) : null;
  if (bucketId) {
    const bucket = await db.select({ id: buckets.id }).from(buckets).where(and(eq(buckets.id, bucketId), eq(buckets.planId, plan.id))).get();
    if (!bucket) throw new HttpError(400, '貯體不存在');
  } else {
    const first = await db.select({ id: buckets.id }).from(buckets).where(eq(buckets.planId, plan.id))
      .orderBy(asc(buckets.sortOrder), asc(buckets.id)).get();
    bucketId = first?.id
      ?? (await db.insert(buckets).values({ planId: plan.id, name: '待辦事項' }).returning({ id: buckets.id }).get()).id;
  }

  // 新工作排在貯體最上方
  const row = await db.select({ v: min(tasks.sortOrder) }).from(tasks).where(and(eq(tasks.planId, plan.id), eq(tasks.bucketId, bucketId))).get();
  const progress = PROGRESS_VALUES.includes(body.progress) ? body.progress : 0;
  const task = await db.insert(tasks).values({
    planId: plan.id,
    bucketId,
    title,
    notes: optionalText(body.notes, LIMITS.taskNotes, '附註') || null,
    progress,
    priority: PRIORITY_VALUES.includes(body.priority) ? body.priority : 5,
    startDate: body.startDate || null,
    dueDate: body.dueDate || null,
    labels: Array.isArray(body.labels) ? [...new Set(body.labels.map(Number).filter((n) => n >= 1 && n <= 25))].sort((a, b) => a - b) : [],
    sortOrder: body.sortOrder ?? (row?.v != null ? row.v - 1 : 0),
    completedAt: progress === 100 ? nowIso() : null,
    completedById: progress === 100 ? user.id : null,
    createdById: user.id,
  }).returning({ id: tasks.id }).get();

  if (Array.isArray(body.assigneeIds) && body.assigneeIds.length) {
    const members = await db.select({ userId: planMembers.userId }).from(planMembers)
      .where(and(eq(planMembers.planId, plan.id), inArray(planMembers.userId, body.assigneeIds.slice(0, 50).map(Number))));
    if (members.length) await db.insert(taskAssignees).values(members.map((m) => ({ taskId: task.id, userId: m.userId })));
  }
  return c.json(await loadTaskSummary(c, task.id), 201);
});

export default router;
