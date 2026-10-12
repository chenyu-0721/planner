import { sign, verify } from 'hono/jwt';
import { eq } from 'drizzle-orm';
import { users } from '../db/schema.js';
import { HttpError } from './errors.js';
import { getDb } from './helpers.js';
import { hashPassword as hash } from './password.js';

export function signToken(c, user) {
  const days = Number(c.env.JWT_EXPIRES_DAYS || 7);
  const exp = Math.floor(Date.now() / 1000) + days * 86400;
  return sign({ id: user.id, role: user.role, exp }, c.env.JWT_SECRET, 'HS256');
}

// 依環境變數 PBKDF2_ITERATIONS 產生密碼雜湊（預設 100000，Workers 上限 100000）
export const hashPassword = (c, password) => hash(password, Number(c.env.PBKDF2_ITERATIONS || 100000));

export async function requireAuth(c, next) {
  if (!c.env.JWT_SECRET) throw new HttpError(500, '尚未設定 JWT_SECRET');
  const header = c.req.header('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, '請先登入');
  let payload;
  try {
    payload = await verify(token, c.env.JWT_SECRET, 'HS256');
  } catch {
    throw new HttpError(401, '登入已過期，請重新登入');
  }
  const user = await getDb(c).select().from(users).where(eq(users.id, payload.id)).get();
  if (!user || !user.isActive) throw new HttpError(401, '帳號不存在或已停用');
  c.set('user', user);
  await next();
}

export async function requireAdmin(c, next) {
  if (c.get('user')?.role !== 'admin') throw new HttpError(403, '需要管理員權限');
  await next();
}
