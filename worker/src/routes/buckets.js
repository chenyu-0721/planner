import { Hono } from 'hono';
import { eq, inArray } from 'drizzle-orm';
import { buckets, tasks, attachments } from '../db/schema.js';
import { HttpError } from '../lib/errors.js';
import {
  getDb, toId, assertPlanAccess, deleteStoredFiles,
} from '../lib/helpers.js';
import { requireAuth } from '../lib/auth.js';
import { LIMITS, requireText } from '../lib/limits.js';

const router = new Hono();
router.use('*', requireAuth);

async function loadBucket(c) {
  const bucket = await getDb(c).select().from(buckets).where(eq(buckets.id, toId(c.req.param('id')))).get();
  if (!bucket) throw new HttpError(404, '找不到貯體');
  await assertPlanAccess(c, bucket.planId);
  return bucket;
}

router.put('/:id', async (c) => {
  const bucket = await loadBucket(c);
  const body = await c.req.json();
  const patch = {};
  if (body.name !== undefined) patch.name = requireText(body.name, LIMITS.bucketName, '貯體名稱');
  if (body.sortOrder !== undefined) patch.sortOrder = Number(body.sortOrder) || 0;
  const updated = Object.keys(patch).length
    ? await getDb(c).update(buckets).set(patch).where(eq(buckets.id, bucket.id)).returning().get()
    : bucket;
  return c.json({ id: updated.id, name: updated.name, sortOrder: updated.sortOrder });
});

// 刪除貯體會一併刪除其中的工作（與 Planner 相同）
router.delete('/:id', async (c) => {
  const bucket = await loadBucket(c);
  const db = getDb(c);
  await deleteStoredFiles(c, inArray(attachments.taskId, db.select({ id: tasks.id }).from(tasks).where(eq(tasks.bucketId, bucket.id))));
  await db.delete(buckets).where(eq(buckets.id, bucket.id));
  return c.json({ ok: true });
});

export default router;
