const { Sequelize, DataTypes } = require('sequelize');
const config = require('../config/config')[process.env.NODE_ENV || 'development'];

const sequelize = new Sequelize(config.database, config.username, config.password, config);

// 各欄位長度上限（前端輸入框也使用相同數值）
const LIMITS = {
  username: 50,
  displayName: 50,
  email: 100,
  planName: 100,
  planDescription: 500,
  labelName: 50,
  bucketName: 100,
  taskTitle: 200,
  taskNotes: 10000,
  checklistTitle: 100,
  attachmentName: 200,
  attachmentUrl: 1000,
  comment: 2000,
};

const maxLen = (max, label) => ({ len: { args: [0, max], msg: `${label}不可超過 ${max} 個字` } });

// JSON 以 VARCHAR 儲存，相容 MariaDB
const jsonString = (field, length, fallback) => ({
  type: DataTypes.STRING(length),
  allowNull: true,
  get() {
    const raw = this.getDataValue(field);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(val) {
    this.setDataValue(field, val == null ? null : JSON.stringify(val));
  },
});

const User = sequelize.define('User', {
  username: { type: DataTypes.STRING(LIMITS.username), allowNull: false },
  passwordHash: { type: DataTypes.CHAR(60), allowNull: false }, // bcrypt 雜湊固定 60 字元
  displayName: { type: DataTypes.STRING(LIMITS.displayName), allowNull: false, validate: maxLen(LIMITS.displayName, '顯示名稱') },
  email: { type: DataTypes.STRING(LIMITS.email), validate: maxLen(LIMITS.email, '電子郵件') },
  role: { type: DataTypes.ENUM('admin', 'member'), allowNull: false, defaultValue: 'member' },
  color: { type: DataTypes.STRING(7), defaultValue: '#0078d4' }, // #rrggbb
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
  tableName: 'users',
  // 以具名 index 定義唯一，避免 sync({ alter }) 每次重複建立 index
  indexes: [{ unique: true, name: 'username', fields: ['username'] }],
});

User.prototype.toSafeJSON = function toSafeJSON() {
  const { id, username, displayName, email, role, color, isActive } = this;
  return { id, username, displayName, email, role, color, isActive };
};

const Plan = sequelize.define('Plan', {
  name: { type: DataTypes.STRING(LIMITS.planName), allowNull: false, validate: maxLen(LIMITS.planName, '計劃名稱') },
  description: { type: DataTypes.STRING(LIMITS.planDescription), validate: maxLen(LIMITS.planDescription, '計劃描述') },
  color: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false, defaultValue: 0 },
  ownerId: { type: DataTypes.INTEGER },
  labelNames: jsonString('labelNames', 1500, {}), // 最多 25 個標籤名稱
}, { tableName: 'plans' });

const PlanMember = sequelize.define('PlanMember', {
  planId: { type: DataTypes.INTEGER, allowNull: false },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  role: { type: DataTypes.ENUM('owner', 'member'), allowNull: false, defaultValue: 'member' },
  pinned: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  lastViewedAt: { type: DataTypes.DATE },
}, { tableName: 'plan_members', indexes: [{ unique: true, fields: ['plan_id', 'user_id'] }] });

const Bucket = sequelize.define('Bucket', {
  planId: { type: DataTypes.INTEGER, allowNull: false },
  name: { type: DataTypes.STRING(LIMITS.bucketName), allowNull: false, validate: maxLen(LIMITS.bucketName, '貯體名稱') },
  sortOrder: { type: DataTypes.DOUBLE, allowNull: false, defaultValue: 0 },
}, { tableName: 'buckets' });

const Task = sequelize.define('Task', {
  planId: { type: DataTypes.INTEGER, allowNull: false },
  bucketId: { type: DataTypes.INTEGER },
  title: { type: DataTypes.STRING(LIMITS.taskTitle), allowNull: false, validate: maxLen(LIMITS.taskTitle, '工作名稱') },
  notes: { type: DataTypes.TEXT, validate: maxLen(LIMITS.taskNotes, '附註') },
  progress: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false, defaultValue: 0 }, // 0 未開始 / 50 進行中 / 100 已完成
  priority: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false, defaultValue: 5 }, // 1 緊急 / 3 重要 / 5 中 / 9 低
  startDate: { type: DataTypes.DATEONLY },
  dueDate: { type: DataTypes.DATEONLY },
  sortOrder: { type: DataTypes.DOUBLE, allowNull: false, defaultValue: 0 },
  previewType: {
    type: DataTypes.ENUM('automatic', 'noPreview', 'checklist', 'description', 'reference'),
    allowNull: false,
    defaultValue: 'automatic',
  },
  labels: jsonString('labels', 80, []), // 標籤編號陣列，最長 [1,2,...,25]
  completedAt: { type: DataTypes.DATE },
  completedById: { type: DataTypes.INTEGER },
  createdById: { type: DataTypes.INTEGER },
}, { tableName: 'tasks' });

const TaskAssignee = sequelize.define('TaskAssignee', {
  taskId: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
  userId: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
}, { tableName: 'task_assignees', timestamps: false });

const ChecklistItem = sequelize.define('ChecklistItem', {
  taskId: { type: DataTypes.INTEGER, allowNull: false },
  title: { type: DataTypes.STRING(LIMITS.checklistTitle), allowNull: false, validate: maxLen(LIMITS.checklistTitle, '檢查清單項目') },
  isChecked: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  sortOrder: { type: DataTypes.DOUBLE, allowNull: false, defaultValue: 0 },
}, { tableName: 'checklist_items', timestamps: false });

const Attachment = sequelize.define('Attachment', {
  taskId: { type: DataTypes.INTEGER, allowNull: false },
  type: { type: DataTypes.ENUM('link', 'file'), allowNull: false, defaultValue: 'link' },
  name: { type: DataTypes.STRING(LIMITS.attachmentName), allowNull: false, validate: maxLen(LIMITS.attachmentName, '附件名稱') },
  url: { type: DataTypes.STRING(LIMITS.attachmentUrl), allowNull: false, validate: maxLen(LIMITS.attachmentUrl, '連結網址') },
  mimeType: { type: DataTypes.STRING(127) }, // RFC 6838 上限
  size: { type: DataTypes.INTEGER.UNSIGNED },
  createdById: { type: DataTypes.INTEGER },
}, { tableName: 'attachments' });

const Comment = sequelize.define('Comment', {
  taskId: { type: DataTypes.INTEGER, allowNull: false },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  content: { type: DataTypes.STRING(LIMITS.comment), allowNull: false, validate: maxLen(LIMITS.comment, '意見') },
}, { tableName: 'comments' });

const MyDayItem = sequelize.define('MyDayItem', {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  taskId: { type: DataTypes.INTEGER, allowNull: false },
  date: { type: DataTypes.DATEONLY, allowNull: false },
}, { tableName: 'my_day_items', timestamps: false, indexes: [{ unique: true, fields: ['user_id', 'task_id', 'date'] }] });

// 關聯
Plan.belongsTo(User, { as: 'owner', foreignKey: 'ownerId', constraints: false });
Plan.hasMany(PlanMember, { as: 'memberships', foreignKey: 'planId', onDelete: 'CASCADE' });
PlanMember.belongsTo(Plan, { foreignKey: 'planId' });
PlanMember.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(PlanMember, { foreignKey: 'userId', onDelete: 'CASCADE' });

Plan.hasMany(Bucket, { as: 'buckets', foreignKey: 'planId', onDelete: 'CASCADE' });
Bucket.belongsTo(Plan, { foreignKey: 'planId' });

Plan.hasMany(Task, { as: 'tasks', foreignKey: 'planId', onDelete: 'CASCADE' });
Task.belongsTo(Plan, { foreignKey: 'planId' });
Bucket.hasMany(Task, { as: 'tasks', foreignKey: 'bucketId', onDelete: 'CASCADE' });
Task.belongsTo(Bucket, { foreignKey: 'bucketId' });

// 主鍵 (task_id, user_id) 已保證唯一，不另建 unique index
const assigneeThrough = { model: TaskAssignee, unique: false };
Task.belongsToMany(User, { as: 'assignees', through: assigneeThrough, foreignKey: 'taskId', otherKey: 'userId' });
User.belongsToMany(Task, { as: 'assignedTasks', through: assigneeThrough, foreignKey: 'userId', otherKey: 'taskId' });
Task.hasMany(TaskAssignee, { as: 'assignments', foreignKey: 'taskId', onDelete: 'CASCADE' });

Task.hasMany(ChecklistItem, { as: 'checklist', foreignKey: 'taskId', onDelete: 'CASCADE' });
ChecklistItem.belongsTo(Task, { foreignKey: 'taskId' });
Task.hasMany(Attachment, { as: 'attachments', foreignKey: 'taskId', onDelete: 'CASCADE' });
Attachment.belongsTo(Task, { foreignKey: 'taskId' });
Task.hasMany(Comment, { as: 'comments', foreignKey: 'taskId', onDelete: 'CASCADE' });
Comment.belongsTo(Task, { foreignKey: 'taskId' });
Comment.belongsTo(User, { as: 'user', foreignKey: 'userId' });
Task.hasMany(MyDayItem, { as: 'myDayItems', foreignKey: 'taskId', onDelete: 'CASCADE' });
MyDayItem.belongsTo(Task, { foreignKey: 'taskId' });

module.exports = {
  sequelize,
  Sequelize,
  LIMITS,
  User,
  Plan,
  PlanMember,
  Bucket,
  Task,
  TaskAssignee,
  ChecklistItem,
  Attachment,
  Comment,
  MyDayItem,
};
