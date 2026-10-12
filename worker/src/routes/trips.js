import { Hono } from 'hono';
import {
  and, eq, asc, inArray, count, or, lt, gt, isNull, isNotNull, max,
} from 'drizzle-orm';
import {
  trips, tripMembers, tripStops, users,
} from '../db/schema.js';
import { HttpError } from '../lib/errors.js';
import {
  getDb, safeUser, toId, nowIso,
} from '../lib/helpers.js';
import { requireAuth } from '../lib/auth.js';
import {
  LIMITS, STOP_CATEGORIES, MAX_TRIP_DAYS, TRAVEL_MODES, requireText, optionalText,
} from '../lib/limits.js';

const router = new Hono();
router.use('*', requireAuth);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const canManage = (user, trip) => user.role === 'admin' || trip.ownerId === user.id;
const dayDiff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

function checkDateRange(startDate, endDate) {
  if (!DATE_RE.test(startDate || '') || !DATE_RE.test(endDate || '')) throw new HttpError(400, '請設定開始與結束日期');
  const days = dayDiff(startDate, endDate);
  if (days < 0) throw new HttpError(400, '結束日期不可早於開始日期');
  if (days + 1 > MAX_TRIP_DAYS) throw new HttpError(400, `行程最多 ${MAX_TRIP_DAYS} 天`);
}

async function assertTripAccess(c, tripId) {
  const db = getDb(c);
  const user = c.get('user');
  const trip = await db.select().from(trips).where(eq(trips.id, toId(tripId))).get();
  if (!trip) throw new HttpError(404, '找不到行程');
  if (user.role === 'admin') return trip;
  const member = await db.select({ id: tripMembers.id }).from(tripMembers)
    .where(and(eq(tripMembers.tripId, trip.id), eq(tripMembers.userId, user.id))).get();
  if (!member) throw new HttpError(403, '你不是此行程的成員');
  return trip;
}

// 地點欄位驗證（create 時 partial = false）
function stopFields(trip, b, partial) {
  const patch = {};
  const has = (k) => b[k] !== undefined;
  if (!partial || has('title')) patch.title = requireText(b.title, LIMITS.stopTitle, '地點名稱');
  if (!partial || has('lat') || has('lng')) {
    const lat = Number(b.lat);
    const lng = Number(b.lng);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      throw new HttpError(400, '座標不正確');
    }
    patch.lat = lat;
    patch.lng = lng;
  }
  if (!partial || has('category')) patch.category = STOP_CATEGORIES.includes(b.category) ? b.category : 'sight';
  if (has('date')) {
    if (b.date && (!DATE_RE.test(b.date) || b.date < trip.startDate || b.date > trip.endDate)) {
      throw new HttpError(400, '日期必須在行程期間內');
    }
    patch.date = b.date || null;
  }
  for (const key of ['startTime', 'endTime']) {
    if (has(key)) {
      if (b[key] && !TIME_RE.test(b[key])) throw new HttpError(400, '時間格式不正確');
      patch[key] = b[key] || null;
    }
  }
  if (has('address')) patch.address = optionalText(b.address, LIMITS.stopAddress, '地址') || null;
  if (has('notes')) patch.notes = optionalText(b.notes, LIMITS.stopNotes, '備註') || null;
  if (has('cost')) {
    const cost = b.cost === '' || b.cost == null ? null : Number(b.cost);
    if (cost != null && (!Number.isFinite(cost) || cost < 0 || cost > 1e9)) throw new HttpError(400, '花費不正確');
    patch.cost = cost;
  }
  if (has('sortOrder')) patch.sortOrder = Number(b.sortOrder) || 0;
  return patch;
}

const tripJson = (t) => ({
  id: t.id,
  name: t.name,
  description: t.description,
  startDate: t.startDate,
  endDate: t.endDate,
  color: t.color,
  travelMode: t.travelMode,
  ownerId: t.ownerId,
  createdAt: t.createdAt,
  updatedAt: t.updatedAt,
});

const stopJson = ({ createdAt, updatedAt, ...s }) => s;

// 我的行程
router.get('/', async (c) => {
  const db = getDb(c);
  const user = c.get('user');
  const myTripIds = db.select({ id: tripMembers.tripId }).from(tripMembers).where(eq(tripMembers.userId, user.id));
  const [rows, stopStats, memberStats] = await Promise.all([
    db.select({ trip: trips, role: tripMembers.role, lastViewedAt: tripMembers.lastViewedAt })
      .from(tripMembers).innerJoin(trips, eq(trips.id, tripMembers.tripId))
      .where(eq(tripMembers.userId, user.id)).orderBy(asc(trips.startDate)),
    db.select({ tripId: tripStops.tripId, cnt: count() }).from(tripStops)
      .where(inArray(tripStops.tripId, myTripIds)).groupBy(tripStops.tripId),
    db.select({ tripId: tripMembers.tripId, cnt: count() }).from(tripMembers)
      .where(inArray(tripMembers.tripId, myTripIds)).groupBy(tripMembers.tripId),
  ]);
  const stopMap = new Map(stopStats.map((s) => [s.tripId, Number(s.cnt)]));
  const memberMap = new Map(memberStats.map((s) => [s.tripId, Number(s.cnt)]));
  return c.json(rows.map(({ trip, role, lastViewedAt }) => ({
    ...tripJson(trip),
    role,
    lastViewedAt,
    stopCount: stopMap.get(trip.id) || 0,
    memberCount: memberMap.get(trip.id) || 0,
  })));
});

router.post('/', async (c) => {
  const b = await c.req.json();
  checkDateRange(b.startDate, b.endDate);
  const db = getDb(c);
  const user = c.get('user');
  const trip = await db.insert(trips).values({
    name: requireText(b.name, LIMITS.tripName, '行程名稱'),
    description: optionalText(b.description, LIMITS.tripDescription, '行程描述') || null,
    startDate: b.startDate,
    endDate: b.endDate,
    color: Number.isInteger(b.color) && b.color >= 0 && b.color < 12 ? b.color : Math.floor(Math.random() * 12),
    ownerId: user.id,
  }).returning().get();
  await db.insert(tripMembers).values({
    tripId: trip.id, userId: user.id, role: 'owner', lastViewedAt: nowIso(),
  });
  return c.json(tripJson(trip), 201);
});

// 行程完整資料（成員、地點）
router.get('/:id', async (c) => {
  const trip = await assertTripAccess(c, c.req.param('id'));
  const db = getDb(c);
  const user = c.get('user');
  const [memberRows, stopRows] = await Promise.all([
    db.select({ user: users, tripRole: tripMembers.role }).from(tripMembers)
      .innerJoin(users, eq(users.id, tripMembers.userId))
      .where(eq(tripMembers.tripId, trip.id)).orderBy(asc(tripMembers.id)),
    db.select().from(tripStops).where(eq(tripStops.tripId, trip.id))
      .orderBy(asc(tripStops.date), asc(tripStops.sortOrder), asc(tripStops.id)),
  ]);
  const isMember = memberRows.some((m) => m.user.id === user.id);
  if (isMember) {
    await db.update(tripMembers).set({ lastViewedAt: nowIso() })
      .where(and(eq(tripMembers.tripId, trip.id), eq(tripMembers.userId, user.id)));
  }
  return c.json({
    trip: { ...tripJson(trip), isMember, canManage: canManage(user, trip) },
    members: memberRows.map((m) => ({ ...safeUser(m.user), tripRole: m.tripRole })),
    stops: stopRows.map(stopJson),
  });
});

router.put('/:id', async (c) => {
  const trip = await assertTripAccess(c, c.req.param('id'));
  const b = await c.req.json();
  const db = getDb(c);
  const patch = {};
  if (b.name !== undefined) patch.name = requireText(b.name, LIMITS.tripName, '行程名稱');
  if (b.description !== undefined) patch.description = optionalText(b.description, LIMITS.tripDescription, '行程描述') || null;
  if (b.color !== undefined) patch.color = Math.min(255, Math.max(0, Number(b.color) || 0));
  if (b.travelMode !== undefined) {
    if (!TRAVEL_MODES.includes(b.travelMode)) throw new HttpError(400, '交通方式不正確');
    patch.travelMode = b.travelMode;
  }
  if (b.startDate !== undefined || b.endDate !== undefined) {
    patch.startDate = b.startDate ?? trip.startDate;
    patch.endDate = b.endDate ?? trip.endDate;
    checkDateRange(patch.startDate, patch.endDate);
  }
  if (!Object.keys(patch).length) return c.json(tripJson(trip));

  const statements = [db.update(trips).set(patch).where(eq(trips.id, trip.id)).returning()];
  // 縮短日期後，超出範圍的地點移到「未排入日期」
  if (patch.startDate) {
    statements.push(db.update(tripStops).set({ date: null }).where(and(
      eq(tripStops.tripId, trip.id),
      isNotNull(tripStops.date),
      or(lt(tripStops.date, patch.startDate), gt(tripStops.date, patch.endDate)),
    )));
  }
  const [[updated]] = await db.batch(statements);
  return c.json(tripJson(updated));
});

router.delete('/:id', async (c) => {
  const trip = await assertTripAccess(c, c.req.param('id'));
  if (!canManage(c.get('user'), trip)) throw new HttpError(403, '只有行程擁有者可以刪除行程');
  await getDb(c).delete(trips).where(eq(trips.id, trip.id));
  return c.json({ ok: true });
});

/* ---- 成員 ---- */
router.post('/:id/members', async (c) => {
  const trip = await assertTripAccess(c, c.req.param('id'));
  const { userId } = await c.req.json();
  const db = getDb(c);
  const user = await db.select().from(users).where(eq(users.id, toId(userId))).get();
  if (!user || !user.isActive) throw new HttpError(404, '找不到使用者');
  await db.insert(tripMembers).values({ tripId: trip.id, userId: user.id, role: 'member' }).onConflictDoNothing();
  const member = await db.select().from(tripMembers)
    .where(and(eq(tripMembers.tripId, trip.id), eq(tripMembers.userId, user.id))).get();
  return c.json({ ...safeUser(user), tripRole: member.role }, 201);
});

router.delete('/:id/members/:userId', async (c) => {
  const trip = await assertTripAccess(c, c.req.param('id'));
  const userId = toId(c.req.param('userId'));
  if (userId !== c.get('user').id && !canManage(c.get('user'), trip)) throw new HttpError(403, '沒有權限移除成員');
  if (userId === trip.ownerId) throw new HttpError(400, '無法移除行程擁有者');
  await getDb(c).delete(tripMembers).where(and(eq(tripMembers.tripId, trip.id), eq(tripMembers.userId, userId)));
  return c.json({ ok: true });
});

/* ---- 地點 ---- */
router.post('/:id/stops', async (c) => {
  const trip = await assertTripAccess(c, c.req.param('id'));
  const b = await c.req.json();
  const db = getDb(c);
  const fields = stopFields(trip, { date: null, ...b }, false);
  if (fields.sortOrder === undefined) {
    // 預設加到該天最後
    const row = await db.select({ v: max(tripStops.sortOrder) }).from(tripStops).where(and(
      eq(tripStops.tripId, trip.id),
      fields.date ? eq(tripStops.date, fields.date) : isNull(tripStops.date),
    )).get();
    fields.sortOrder = (row?.v ?? 0) + 1;
  }
  const stop = await db.insert(tripStops).values({ ...fields, tripId: trip.id, createdById: c.get('user').id }).returning().get();
  return c.json(stopJson(stop), 201);
});

router.put('/:id/stops/:stopId', async (c) => {
  const trip = await assertTripAccess(c, c.req.param('id'));
  const patch = stopFields(trip, await c.req.json(), true);
  const db = getDb(c);
  const where = and(eq(tripStops.id, toId(c.req.param('stopId'))), eq(tripStops.tripId, trip.id));
  const stop = Object.keys(patch).length
    ? await db.update(tripStops).set(patch).where(where).returning().get()
    : await db.select().from(tripStops).where(where).get();
  if (!stop) throw new HttpError(404, '找不到地點');
  return c.json(stopJson(stop));
});

router.delete('/:id/stops/:stopId', async (c) => {
  const trip = await assertTripAccess(c, c.req.param('id'));
  const deleted = await getDb(c).delete(tripStops)
    .where(and(eq(tripStops.id, toId(c.req.param('stopId'))), eq(tripStops.tripId, trip.id)))
    .returning({ id: tripStops.id }).get();
  if (!deleted) throw new HttpError(404, '找不到地點');
  return c.json({ ok: true });
});

export default router;
