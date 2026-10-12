import { sql } from 'drizzle-orm';
import {
  sqliteTable, integer, text, real, primaryKey, uniqueIndex, index, check,
} from 'drizzle-orm/sqlite-core';
import { LIMITS, STOP_CATEGORIES } from '../lib/limits.js';

// SQLite 不會檢查 VARCHAR 長度，所以用 CHECK 限制字數與可用值
const maxLen = (name, column, max) => check(name, sql`length(${column}) <= ${sql.raw(String(max))}`);
const oneOf = (name, column, values) => check(name, sql`${column} in (${sql.raw(values.map((v) => (typeof v === 'number' ? v : `'${v}'`)).join(', '))})`);

const now = () => new Date().toISOString();
const createdAt = () => text('created_at').notNull().$defaultFn(now);
const updatedAt = () => text('updated_at').notNull().$defaultFn(now).$onUpdateFn(now);

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  email: text('email'),
  role: text('role').notNull().default('member'),
  color: text('color').notNull().default('#0078d4'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex('users_username').on(t.username),
  maxLen('users_username_len', t.username, LIMITS.username),
  maxLen('users_display_name_len', t.displayName, LIMITS.displayName),
  maxLen('users_email_len', t.email, LIMITS.email),
  maxLen('users_color_len', t.color, 7),
  oneOf('users_role', t.role, ['admin', 'member']),
]);

export const plans = sqliteTable('plans', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  color: integer('color').notNull().default(0),
  ownerId: integer('owner_id').references(() => users.id, { onDelete: 'set null' }),
  labelNames: text('label_names', { mode: 'json' }).notNull().$type().default({}),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  maxLen('plans_name_len', t.name, LIMITS.planName),
  maxLen('plans_description_len', t.description, LIMITS.planDescription),
  maxLen('plans_label_names_len', t.labelNames, LIMITS.labelNamesJson),
  check('plans_color_range', sql`${t.color} between 0 and 255`),
]);

export const planMembers = sqliteTable('plan_members', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  planId: integer('plan_id').notNull().references(() => plans.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('member'),
  pinned: integer('pinned', { mode: 'boolean' }).notNull().default(false),
  lastViewedAt: text('last_viewed_at'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex('plan_members_plan_user').on(t.planId, t.userId),
  index('plan_members_user').on(t.userId),
  oneOf('plan_members_role', t.role, ['owner', 'member']),
]);

export const buckets = sqliteTable('buckets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  planId: integer('plan_id').notNull().references(() => plans.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sortOrder: real('sort_order').notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index('buckets_plan').on(t.planId),
  maxLen('buckets_name_len', t.name, LIMITS.bucketName),
]);

export const tasks = sqliteTable('tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  planId: integer('plan_id').notNull().references(() => plans.id, { onDelete: 'cascade' }),
  bucketId: integer('bucket_id').references(() => buckets.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  notes: text('notes'),
  progress: integer('progress').notNull().default(0), // 0 未開始 / 50 進行中 / 100 已完成
  priority: integer('priority').notNull().default(5), // 1 緊急 / 3 重要 / 5 中 / 9 低
  startDate: text('start_date'), // YYYY-MM-DD
  dueDate: text('due_date'),
  sortOrder: real('sort_order').notNull().default(0),
  previewType: text('preview_type').notNull().default('automatic'),
  labels: text('labels', { mode: 'json' }).notNull().$type().default([]),
  completedAt: text('completed_at'),
  completedById: integer('completed_by_id').references(() => users.id, { onDelete: 'set null' }),
  createdById: integer('created_by_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index('tasks_plan').on(t.planId),
  index('tasks_bucket').on(t.bucketId),
  maxLen('tasks_title_len', t.title, LIMITS.taskTitle),
  maxLen('tasks_notes_len', t.notes, LIMITS.taskNotes),
  maxLen('tasks_labels_len', t.labels, 80),
  oneOf('tasks_progress', t.progress, [0, 50, 100]),
  oneOf('tasks_priority', t.priority, [1, 3, 5, 9]),
  oneOf('tasks_preview_type', t.previewType, ['automatic', 'noPreview', 'checklist', 'description', 'reference']),
]);

export const taskAssignees = sqliteTable('task_assignees', {
  taskId: integer('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
}, (t) => [
  primaryKey({ columns: [t.taskId, t.userId] }),
  index('task_assignees_user').on(t.userId),
]);

export const checklistItems = sqliteTable('checklist_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  taskId: integer('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  isChecked: integer('is_checked', { mode: 'boolean' }).notNull().default(false),
  sortOrder: real('sort_order').notNull().default(0),
}, (t) => [
  index('checklist_items_task').on(t.taskId),
  maxLen('checklist_items_title_len', t.title, LIMITS.checklistTitle),
]);

export const attachments = sqliteTable('attachments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  taskId: integer('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  type: text('type').notNull().default('link'),
  name: text('name').notNull(),
  url: text('url').notNull(),
  storageKey: text('storage_key'), // R2 物件 key（type = file 時）
  mimeType: text('mime_type'),
  size: integer('size'),
  createdById: integer('created_by_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index('attachments_task').on(t.taskId),
  oneOf('attachments_type', t.type, ['link', 'file']),
  maxLen('attachments_name_len', t.name, LIMITS.attachmentName),
  maxLen('attachments_url_len', t.url, LIMITS.attachmentUrl),
  maxLen('attachments_mime_len', t.mimeType, 127),
]);

export const comments = sqliteTable('comments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  taskId: integer('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }), // 使用者刪除後保留意見
  content: text('content').notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index('comments_task').on(t.taskId),
  maxLen('comments_content_len', t.content, LIMITS.comment),
]);

export const myDayItems = sqliteTable('my_day_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  taskId: integer('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  date: text('date').notNull(), // YYYY-MM-DD
}, (t) => [
  uniqueIndex('my_day_items_user_task_date').on(t.userId, t.taskId, t.date),
  index('my_day_items_task').on(t.taskId),
]);

/* ---------- 行程 ---------- */

export const trips = sqliteTable('trips', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  startDate: text('start_date').notNull(), // YYYY-MM-DD
  endDate: text('end_date').notNull(),
  color: integer('color').notNull().default(0),
  travelMode: text('travel_mode').notNull().default('car'), // 已停用（舊欄位，保留以免重建資料表），改用 route_mode
  routeMode: text('route_mode').notNull().default('car'), // 行程預設交通方式，可用值見 DEFAULT_TRAVEL_MODES（由 API 檢查）
  budget: real('budget'), // 預算上限（選填，由 API 檢查範圍）
  ownerId: integer('owner_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  oneOf('trips_travel_mode', t.travelMode, ['car', 'bike', 'foot', 'straight']),
  maxLen('trips_name_len', t.name, LIMITS.tripName),
  maxLen('trips_description_len', t.description, LIMITS.tripDescription),
  check('trips_date_range', sql`${t.endDate} >= ${t.startDate}`),
  check('trips_color_range', sql`${t.color} between 0 and 255`),
]);

export const tripMembers = sqliteTable('trip_members', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tripId: integer('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('member'),
  lastViewedAt: text('last_viewed_at'),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex('trip_members_trip_user').on(t.tripId, t.userId),
  index('trip_members_user').on(t.userId),
  oneOf('trip_members_role', t.role, ['owner', 'member']),
]);

// 自訂地點圖標（所有使用者共用）。base_category 決定預算歸類與預設停留時間，刪除後地點改用 base_category 的圖標
export const stopCategories = sqliteTable('stop_categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  emoji: text('emoji').notNull(),
  label: text('label').notNull(),
  baseCategory: text('base_category').notNull().default('other'),
  createdById: integer('created_by_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  maxLen('stop_categories_emoji_len', t.emoji, LIMITS.categoryEmoji),
  maxLen('stop_categories_label_len', t.label, LIMITS.categoryLabel),
  oneOf('stop_categories_base', t.baseCategory, STOP_CATEGORIES),
]);

// 行程中的地點；date 為空代表「備選（未定日期）」
export const tripStops = sqliteTable('trip_stops', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tripId: integer('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  date: text('date'), // YYYY-MM-DD
  startTime: text('start_time'), // HH:MM
  endTime: text('end_time'),
  title: text('title').notNull(),
  category: text('category').notNull().default('sight'),
  lat: real('lat').notNull(),
  lng: real('lng').notNull(),
  address: text('address'),
  notes: text('notes'),
  cost: real('cost'),
  arriveMode: text('arrive_mode'), // 從前一個地點到這裡的交通方式；空值 = 使用行程預設（由 API 檢查可用值）
  isBackup: integer('is_backup', { mode: 'boolean' }).notNull().default(false), // 備選：有日期 = 這天的備選；沒日期的地點一律視為備選
  customCategoryId: integer('custom_category_id').references(() => stopCategories.id, { onDelete: 'set null' }), // 自訂圖標；空值 = 使用 category 的內建圖標
  arriveCost: real('arrive_cost'), // 從前一個地點到這裡的交通費（例如高鐵票），計入「交通」預算
  sortOrder: real('sort_order').notNull().default(0),
  createdById: integer('created_by_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index('trip_stops_trip').on(t.tripId),
  maxLen('trip_stops_title_len', t.title, LIMITS.stopTitle),
  maxLen('trip_stops_address_len', t.address, LIMITS.stopAddress),
  maxLen('trip_stops_notes_len', t.notes, LIMITS.stopNotes),
  oneOf('trip_stops_category', t.category, STOP_CATEGORIES),
  check('trip_stops_lat', sql`${t.lat} between -90 and 90`),
  check('trip_stops_lng', sql`${t.lng} between -180 and 180`),
]);
