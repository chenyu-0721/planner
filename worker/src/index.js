import { Hono } from 'hono';
import { HttpError } from './lib/errors.js';
import { fileUploadEnabled } from './lib/helpers.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import planRoutes from './routes/plans.js';
import bucketRoutes from './routes/buckets.js';
import taskRoutes from './routes/tasks.js';
import meRoutes from './routes/me.js';
import tripRoutes from './routes/trips.js';
import placeRoutes from './routes/places.js';
import stopCategoryRoutes from './routes/stopCategories.js';

// 前端靜態檔由 Workers Static Assets 提供（wrangler.jsonc 的 assets），
// 只有 /api/* 與 /uploads/* 會進到這個 Worker
const app = new Hono();

app.route('/api/auth', authRoutes);
app.route('/api/users', userRoutes);
app.route('/api/plans', planRoutes);
app.route('/api/buckets', bucketRoutes);
app.route('/api/tasks', taskRoutes);
app.route('/api/me', meRoutes);
app.route('/api/trips', tripRoutes);
app.route('/api/places', placeRoutes);
app.route('/api/stop-categories', stopCategoryRoutes);

// 前端需要知道的功能開關（不回傳金鑰）
app.get('/api/config', (c) => c.json({ fileUpload: fileUploadEnabled(c) }));

// 附件檔案（R2，未綁定時不提供）
app.get('/uploads/:key', async (c) => {
  if (!fileUploadEnabled(c)) return c.json({ message: '找不到檔案' }, 404);
  const object = await c.env.UPLOADS.get(c.req.param('key'));
  if (!object) return c.json({ message: '找不到檔案' }, 404);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'private, max-age=86400');
  return new Response(object.body, { headers });
});

app.notFound((c) => c.json({ message: 'API 不存在' }, 404));

app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ message: err.message }, err.status);
  const msg = String(err?.cause?.message || err?.message || '');
  // 資料表 CHECK / UNIQUE 限制（正常情況下 API 已先檢查）
  if (msg.includes('CHECK constraint failed')) return c.json({ message: '資料格式不正確或內容過長' }, 400);
  if (msg.includes('UNIQUE constraint failed')) return c.json({ message: '資料重複' }, 400);
  if (err instanceof SyntaxError) return c.json({ message: '請求格式不正確' }, 400);
  console.error(err);
  return c.json({ message: '伺服器錯誤' }, 500);
});

export default app;
