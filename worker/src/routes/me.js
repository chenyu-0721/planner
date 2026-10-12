import { Hono } from 'hono';
import {
  and, eq, ne, lte, inArray, notInArray,
} from 'drizzle-orm';
import { tasks, taskAssignees, myDayItems } from '../db/schema.js';
import {
  getDb, today, loadTaskSummaries, myPlanIdsQuery, runBatch, taskSummaryQueries, buildTaskSummaries,
} from '../lib/helpers.js';
import { requireAuth } from '../lib/auth.js';

const router = new Hono();
router.use('*', requireAuth);

const assignedToMe = (db, userId) => db.select({ id: taskAssignees.taskId }).from(taskAssignees).where(eq(taskAssignees.userId, userId));
const inMyDayToday = (db, userId, date) => db.select({ id: myDayItems.taskId }).from(myDayItems)
  .where(and(eq(myDayItems.userId, userId), eq(myDayItems.date, date)));

// 指派給我的工作
router.get('/tasks', async (c) => {
  const db = getDb(c);
  const { id } = c.get('user');
  return c.json(await loadTaskSummaries(c, and(
    inArray(tasks.id, assignedToMe(db, id)),
    inArray(tasks.planId, myPlanIdsQuery(db, id)),
  ), { withPlanBucket: true }));
});

// 我的一天：已加入的工作 + 建議（今天到期或已逾期且指派給我）
router.get('/myday', async (c) => {
  const db = getDb(c);
  const { id } = c.get('user');
  const date = today(c);
  const myPlans = myPlanIdsQuery(db, id);
  const dayOpts = { withPlanBucket: true, prefix: 'd_' };
  const sugOpts = { withPlanBucket: true, prefix: 's_' };
  const r = await runBatch(db, {
    ...taskSummaryQueries(c, and(inArray(tasks.id, inMyDayToday(db, id, date)), inArray(tasks.planId, myPlans)), dayOpts),
    ...taskSummaryQueries(c, and(
      inArray(tasks.id, assignedToMe(db, id)),
      notInArray(tasks.id, inMyDayToday(db, id, date)),
      inArray(tasks.planId, myPlans),
      ne(tasks.progress, 100),
      lte(tasks.dueDate, date),
    ), sugOpts),
  });
  return c.json({ date, tasks: buildTaskSummaries(r, dayOpts), suggestions: buildTaskSummaries(r, sugOpts) });
});

export default router;
