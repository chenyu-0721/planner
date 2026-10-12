import { Hono } from 'hono';
import { asc, count, eq } from 'drizzle-orm';
import { stopCategories, tripStops } from '../db/schema.js';
import { HttpError } from '../lib/errors.js';
import { getDb, toId } from '../lib/helpers.js';
import { requireAuth } from '../lib/auth.js';
import {
  LIMITS, STOP_CATEGORIES, MAX_CUSTOM_CATEGORIES, requireText,
} from '../lib/limits.js';

// 自訂地點圖標：所有使用者共用，建立者或管理員可以修改 / 刪除
const router = new Hono();
router.use('*', requireAuth);

export const categoryJson = ({ createdAt, updatedAt, ...c }) => c;
export const listCategories = (db) => db.select().from(stopCategories).orderBy(asc(stopCategories.id));

function categoryFields(b, partial) {
  const patch = {};
  if (!partial || b.emoji !== undefined) {
    const emoji = String(b.emoji ?? '').trim();
    if (!emoji) throw new HttpError(400, '請選擇圖標');
    // 只接受 emoji（不接受一般文字），避免地圖圖標變成一串字
    if (emoji.length > LIMITS.categoryEmoji || !/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(emoji) || /\p{L}/u.test(emoji)) {
      throw new HttpError(400, '圖標請輸入一個 emoji');
    }
    patch.emoji = emoji;
  }
  if (!partial || b.label !== undefined) patch.label = requireText(b.label, LIMITS.categoryLabel, '圖標名稱');
  if (!partial || b.baseCategory !== undefined) {
    if (!STOP_CATEGORIES.includes(b.baseCategory)) throw new HttpError(400, '歸類不正確');
    patch.baseCategory = b.baseCategory;
  }
  return patch;
}

async function findOwned(c) {
  const row = await getDb(c).select().from(stopCategories).where(eq(stopCategories.id, toId(c.req.param('id')))).get();
  if (!row) throw new HttpError(404, '找不到圖標');
  const user = c.get('user');
  if (user.role !== 'admin' && row.createdById !== user.id) throw new HttpError(403, '只有建立者或管理員可以修改');
  return row;
}

router.get('/', async (c) => c.json((await listCategories(getDb(c))).map(categoryJson)));

router.post('/', async (c) => {
  const fields = categoryFields(await c.req.json(), false);
  const db = getDb(c);
  const { n } = await db.select({ n: count() }).from(stopCategories).get();
  if (n >= MAX_CUSTOM_CATEGORIES) throw new HttpError(400, `自訂圖標最多 ${MAX_CUSTOM_CATEGORIES} 個`);
  const row = await db.insert(stopCategories).values({ ...fields, createdById: c.get('user').id }).returning().get();
  return c.json(categoryJson(row), 201);
});

router.put('/:id', async (c) => {
  const row = await findOwned(c);
  const patch = categoryFields(await c.req.json(), true);
  if (!Object.keys(patch).length) return c.json(categoryJson(row));
  const db = getDb(c);
  const statements = [db.update(stopCategories).set(patch).where(eq(stopCategories.id, row.id)).returning()];
  // 歸類改了，使用這個圖標的地點跟著改（預算與停留時間依歸類計算）
  if (patch.baseCategory && patch.baseCategory !== row.baseCategory) {
    statements.push(db.update(tripStops).set({ category: patch.baseCategory }).where(eq(tripStops.customCategoryId, row.id)));
  }
  const [[updated]] = await db.batch(statements);
  return c.json(categoryJson(updated));
});

// 刪除後，使用中的地點改回內建圖標（歸類不變）
router.delete('/:id', async (c) => {
  const row = await findOwned(c);
  const db = getDb(c);
  await db.batch([
    db.update(tripStops).set({ customCategoryId: null }).where(eq(tripStops.customCategoryId, row.id)),
    db.delete(stopCategories).where(eq(stopCategories.id, row.id)),
  ]);
  return c.json({ ok: true });
});

export default router;
