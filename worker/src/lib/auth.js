import { sign, verify } from 'hono/jwt';
import { eq } from 'drizzle-orm';
import { users } from '../db/schema.js';
import { HttpError } from './errors.js';
import { getDb } from './helpers.js';
import { hashPassword as hash, ITERATIONS } from './password.js';

export function signToken(c, user) {
  const days = Number(c.env.JWT_EXPIRES_DAYS || 7);
  const exp = Math.floor(Date.now() / 1000) + days * 86400;
  return sign({ id: user.id, role: user.role, exp }, c.env.JWT_SECRET, 'HS256');
}

// 依環境變數 PBKDF2_ITERATIONS 產生密碼雜湊（預設 50000，Workers 上限 100000）
export const passwordIterations = (c) => Math.min(100000, Number(c.env.PBKDF2_ITERATIONS) || ITERATIONS);
export const hashPassword = (c, password) => hash(password, passwordIterations(c));

// 登入者資料的短暫快取：同一個 Worker 執行個體內 15 秒內不重查資料庫
// （帳號停用、角色變更最多延遲 15 秒生效；同一執行個體內修改時會立即清除）
const USER_CACHE_MS = 15000;
const userCache = new Map();
export const forgetUser = (id) => userCache.delete(Number(id));

async function loadUser(c, id) {
  const hit = userCache.get(id);
  if (hit && hit.expires > Date.now()) return hit.user;
  const user = await getDb(c).select().from(users).where(eq(users.id, id)).get();
  if (user) userCache.set(id, { user, expires: Date.now() + USER_CACHE_MS });
  if (userCache.size > 500) userCache.clear();
  return user;
}

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
  const user = await loadUser(c, payload.id);
  if (!user || !user.isActive) throw new HttpError(401, '帳號不存在或已停用');
  c.set('user', user);
  await next();
}

export async function requireAdmin(c, next) {
  if (c.get('user')?.role !== 'admin') throw new HttpError(403, '需要管理員權限');
  await next();
}
