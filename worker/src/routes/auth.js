import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { users } from '../db/schema.js';
import { HttpError } from '../lib/errors.js';
import { getDb, safeUser } from '../lib/helpers.js';
import { verifyPassword, hashIterations } from '../lib/password.js';
import {
  signToken, requireAuth, hashPassword, passwordIterations,
} from '../lib/auth.js';
import { LIMITS, requireText, optionalText, checkPassword } from '../lib/limits.js';

const router = new Hono();

router.post('/login', async (c) => {
  const { username, password } = await c.req.json().catch(() => ({}));
  if (!username || !password) throw new HttpError(400, '請輸入帳號與密碼');
  const user = await getDb(c).select().from(users).where(eq(users.username, String(username).trim())).get();
  if (!user || !(await verifyPassword(password, user.passwordHash))) throw new HttpError(401, '帳號或密碼錯誤');
  if (!user.isActive) throw new HttpError(403, '此帳號已停用');
  // 迭代次數設定改變時，登入成功後自動以新設定重新雜湊（只會發生一次）
  if (hashIterations(user.passwordHash) !== passwordIterations(c)) {
    const passwordHash = await hashPassword(c, password);
    await getDb(c).update(users).set({ passwordHash }).where(eq(users.id, user.id));
  }
  return c.json({ token: await signToken(c, user), user: safeUser(user) });
});

router.get('/me', requireAuth, (c) => c.json(safeUser(c.get('user'))));

router.put('/me', requireAuth, async (c) => {
  const body = await c.req.json();
  const patch = {};
  if (body.displayName !== undefined) patch.displayName = requireText(body.displayName, LIMITS.displayName, '顯示名稱');
  if (body.email !== undefined) patch.email = optionalText(body.email, LIMITS.email, '電子郵件') || null;
  if (body.color !== undefined) patch.color = /^#[0-9a-fA-F]{6}$/.test(body.color) ? body.color : '#0078d4';
  const db = getDb(c);
  const user = Object.keys(patch).length
    ? await db.update(users).set(patch).where(eq(users.id, c.get('user').id)).returning().get()
    : c.get('user');
  return c.json(safeUser(user));
});

router.put('/me/password', requireAuth, async (c) => {
  const { currentPassword, newPassword } = await c.req.json();
  const me = c.get('user');
  if (!(await verifyPassword(currentPassword || '', me.passwordHash))) throw new HttpError(400, '目前密碼不正確');
  const passwordHash = await hashPassword(c, checkPassword(newPassword));
  await getDb(c).update(users).set({ passwordHash }).where(eq(users.id, me.id));
  return c.json({ ok: true });
});

export default router;
