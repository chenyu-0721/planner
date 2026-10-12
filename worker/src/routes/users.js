import { Hono } from 'hono';
import { eq, asc } from 'drizzle-orm';
import { users } from '../db/schema.js';
import { HttpError } from '../lib/errors.js';
import { getDb, safeUser, toId } from '../lib/helpers.js';
import { requireAuth, requireAdmin, hashPassword } from '../lib/auth.js';
import {
  LIMITS, USERNAME_RE, requireText, optionalText, checkPassword,
} from '../lib/limits.js';

const router = new Hono();
router.use('*', requireAuth);

const COLORS = ['#0078d4', '#8764b8', '#038387', '#ca5010', '#c239b3', '#498205', '#d13438', '#004e8c', '#986f0b', '#5c2e91'];

// 所有啟用中的使用者（用於指派、加入成員）
router.get('/', async (c) => {
  const rows = await getDb(c).select().from(users).where(eq(users.isActive, true)).orderBy(asc(users.displayName));
  return c.json(rows.map(safeUser));
});

// 以下為管理員功能
router.get('/all', requireAdmin, async (c) => {
  const rows = await getDb(c).select().from(users).orderBy(asc(users.id));
  return c.json(rows.map((u) => ({ ...safeUser(u), createdAt: u.createdAt })));
});

router.get('/:id', requireAdmin, async (c) => {
  const user = await getDb(c).select().from(users).where(eq(users.id, toId(c.req.param('id')))).get();
  if (!user) throw new HttpError(404, '找不到使用者');
  return c.json({ ...safeUser(user), createdAt: user.createdAt });
});

router.post('/', requireAdmin, async (c) => {
  const body = await c.req.json();
  const username = String(body.username || '').trim();
  if (!USERNAME_RE.test(username)) throw new HttpError(400, '帳號需為 3~50 個英文、數字或 _ . - 字元');
  const displayName = requireText(body.displayName, LIMITS.displayName, '顯示名稱');
  const email = optionalText(body.email, LIMITS.email, '電子郵件') || null;
  const password = checkPassword(body.password);
  const db = getDb(c);
  if (await db.select({ id: users.id }).from(users).where(eq(users.username, username)).get()) {
    throw new HttpError(400, '帳號已存在');
  }
  const user = await db.insert(users).values({
    username,
    passwordHash: await hashPassword(c, password),
    displayName,
    email,
    role: body.role === 'admin' ? 'admin' : 'member',
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  }).returning().get();
  return c.json(safeUser(user), 201);
});

router.put('/:id', requireAdmin, async (c) => {
  const id = toId(c.req.param('id'));
  const db = getDb(c);
  const user = await db.select().from(users).where(eq(users.id, id)).get();
  if (!user) throw new HttpError(404, '找不到使用者');
  const body = await c.req.json();
  const self = id === c.get('user').id;
  const patch = {};
  if (body.displayName !== undefined) patch.displayName = requireText(body.displayName, LIMITS.displayName, '顯示名稱');
  if (body.email !== undefined) patch.email = optionalText(body.email, LIMITS.email, '電子郵件') || null;
  if (body.role !== undefined && !self) patch.role = body.role === 'admin' ? 'admin' : 'member';
  if (body.isActive !== undefined && !self) patch.isActive = !!body.isActive;
  if (body.password) patch.passwordHash = await hashPassword(c, checkPassword(body.password));
  const updated = Object.keys(patch).length
    ? await db.update(users).set(patch).where(eq(users.id, id)).returning().get()
    : user;
  return c.json(safeUser(updated));
});

router.delete('/:id', requireAdmin, async (c) => {
  const id = toId(c.req.param('id'));
  if (id === c.get('user').id) throw new HttpError(400, '不能刪除自己');
  const deleted = await getDb(c).delete(users).where(eq(users.id, id)).returning({ id: users.id }).get();
  if (!deleted) throw new HttpError(404, '找不到使用者');
  return c.json({ ok: true });
});

export default router;
