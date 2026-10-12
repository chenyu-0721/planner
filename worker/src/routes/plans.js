import { Hono } from 'hono';
import {
  and, eq, inArray, asc, max, count, sql,
} from 'drizzle-orm';
import {
  plans, planMembers, buckets, tasks, taskAssignees, attachments, users,
} from '../db/schema.js';
import { HttpError } from '../lib/errors.js';
import {
  getDb, safeUser, toId, nowIso, assertPlanAccess,
  runBatch, planAccessQuery, checkPlanAccess, taskSummaryQueries, buildTaskSummaries, alias,
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
  const { rows, taskStats, memberStats } = await runBatch(db, {
    rows: db.select({
      plan: plans, pinned: planMembers.pinned, role: planMembers.role, lastViewedAt: planMembers.lastViewedAt,
    }).from(planMembers).innerJoin(plans, eq(plans.id, planMembers.planId)).where(eq(planMembers.userId, user.id)),
    taskStats: db.select({
      planId: tasks.planId,
      total: count(),
      done: sql`sum(case when ${tasks.progress} = 100 then 1 else 0 end)`,
    }).from(tasks).where(inArray(tasks.planId, myPlanIds)).groupBy(tasks.planId),
    memberStats: db.select({ planId: planMembers.planId, cnt: count() }).from(planMembers)
      .where(inArray(planMembers.planId, myPlanIds)).groupBy(planMembers.planId),
  });
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
  const planId = toId(c.req.param('id'));
  const db = getDb(c);
  const user = c.get('user');
  // 權限、成員、貯體、工作與附屬資料一次送出（只需一趟 D1 來回）
  const r = await runBatch(db, {
    access: planAccessQuery(db, planId, user.id),
    members: db.select({ user: users, planRole: alias(planMembers.role, 'plan_role') }).from(planMembers)
      .innerJoin(users, eq(users.id, planMembers.userId)).where(eq(planMembers.planId, planId)).orderBy(asc(planMembers.id)),
    bucketRows: db.select({ id: buckets.id, name: buckets.name, sortOrder: buckets.sortOrder }).from(buckets)
      .where(eq(buckets.planId, planId)).orderBy(asc(buckets.sortOrder), asc(buckets.id)),
    ...taskSummaryQueries(c, eq(tasks.planId, planId), { prefix: 't_' }),
    // 只有成員會被更新（非成員的管理員不會有對應的資料列）
    touch: db.update(planMembers).set({ lastViewedAt: nowIso() })
      .where(and(eq(planMembers.planId, planId), eq(planMembers.userId, user.id))),
  });
  const [access] = r.access;
  const plan = checkPlanAccess(user, access);
  return c.json({
    plan: {
      id: plan.id,
      name: plan.name,
      description: plan.description,
      color: plan.color,
      ownerId: plan.ownerId,
      labelNames: plan.labelNames,
      createdAt: plan.createdAt,
      pinned: !!access.pinned,
      isMember: !!access.memberId,
      canManage: canManage(user, plan),
    },
    members: r.members.map((m) => ({ ...safeUser(m.user), planRole: m.planRole })),
    buckets: r.bucketRows,
    tasks: buildTaskSummaries(r, { prefix: 't_' }),
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
  const planId = toId(c.req.param('id'));
  const body = await c.req.json();
  const db = getDb(c);
  const user = c.get('user');
  const title = requireText(body.title, LIMITS.taskTitle, '工作名稱');
  if (!isDate(body.startDate) || !isDate(body.dueDate)) throw new HttpError(400, '日期格式不正確');
  const assigneeIds = Array.isArray(body.assigneeIds) ? body.assigneeIds.slice(0, 50).map(Number).filter(Number.isInteger) : [];
  const requestedBucket = body.bucketId ? toId(body.bucketId) : null;

  // 第一趟：權限、貯體、可指派的成員
  const pre = await runBatch(db, {
    access: planAccessQuery(db, planId, user.id),
    bucket: requestedBucket
      ? db.select({ id: buckets.id }).from(buckets).where(and(eq(buckets.id, requestedBucket), eq(buckets.planId, planId)))
      : db.select({ id: buckets.id }).from(buckets).where(eq(buckets.planId, planId)).orderBy(asc(buckets.sortOrder), asc(buckets.id)).limit(1),
    members: db.select({ userId: planMembers.userId }).from(planMembers)
      .where(and(eq(planMembers.planId, planId), inArray(planMembers.userId, assigneeIds.length ? assigneeIds : [0]))),
  });
  checkPlanAccess(user, pre.access[0]);
  let bucketId = pre.bucket[0]?.id;
  if (!bucketId && requestedBucket) throw new HttpError(400, '貯體不存在');
  if (!bucketId) {
    bucketId = (await db.insert(buckets).values({ planId, name: '待辦事項' }).returning({ id: buckets.id }).get()).id;
  }

  // 第二趟：新增工作（排在貯體最上方）
  const progress = PROGRESS_VALUES.includes(body.progress) ? body.progress : 0;
  const task = await db.insert(tasks).values({
    planId,
    bucketId,
    title,
    notes: optionalText(body.notes, LIMITS.taskNotes, '附註') || null,
    progress,
    priority: PRIORITY_VALUES.includes(body.priority) ? body.priority : 5,
    startDate: body.startDate || null,
    dueDate: body.dueDate || null,
    labels: Array.isArray(body.labels) ? [...new Set(body.labels.map(Number).filter((n) => n >= 1 && n <= 25))].sort((x, y) => x - y) : [],
    sortOrder: Number.isFinite(body.sortOrder)
      ? body.sortOrder
      : sql`(select coalesce(min(${tasks.sortOrder}), 1) - 1 from ${tasks} where ${tasks.bucketId} = ${bucketId})`,
    completedAt: progress === 100 ? nowIso() : null,
    completedById: progress === 100 ? user.id : null,
    createdById: user.id,
  }).returning({ id: tasks.id }).get();

  // 第三趟：指派 + 回傳卡片資料
  const r = await runBatch(db, {
    ...(pre.members.length
      ? { assign: db.insert(taskAssignees).values(pre.members.map((m) => ({ taskId: task.id, userId: m.userId }))) }
      : {}),
    ...taskSummaryQueries(c, eq(tasks.id, task.id)),
  });
  return c.json(buildTaskSummaries(r)[0], 201);
});

export default router;
