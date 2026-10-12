const { Sequelize, DataTypes } = require('sequelize');
const config = require('../config/config')[process.env.NODE_ENV || 'development'];

const sequelize = new Sequelize(config.database, config.username, config.password, config);

// JSON 以 TEXT 儲存，相容 MariaDB
const jsonText = (field, fallback) => ({
  type: DataTypes.TEXT,
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
  username: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  passwordHash: { type: DataTypes.STRING(100), allowNull: false },
  displayName: { type: DataTypes.STRING(100), allowNull: false },
  email: { type: DataTypes.STRING(150) },
  role: { type: DataTypes.ENUM('admin', 'member'), allowNull: false, defaultValue: 'member' },
  color: { type: DataTypes.STRING(20), defaultValue: '#0078d4' },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'users' });

User.prototype.toSafeJSON = function toSafeJSON() {
  const { id, username, displayName, email, role, color, isActive } = this;
  return { id, username, displayName, email, role, color, isActive };
};

const Plan = sequelize.define('Plan', {
  name: { type: DataTypes.STRING(150), allowNull: false },
  description: { type: DataTypes.TEXT },
  color: { type: DataTypes.INTEGER, defaultValue: 0 },
  ownerId: { type: DataTypes.INTEGER },
  labelNames: jsonText('labelNames', {}),
}, { tableName: 'plans' });

const PlanMember = sequelize.define('PlanMember', {
  planId: { type: DataTypes.INTEGER, allowNull: false },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  role: { type: DataTypes.ENUM('owner', 'member'), defaultValue: 'member' },
  pinned: { type: DataTypes.BOOLEAN, defaultValue: false },
  lastViewedAt: { type: DataTypes.DATE },
}, { tableName: 'plan_members', indexes: [{ unique: true, fields: ['plan_id', 'user_id'] }] });

const Bucket = sequelize.define('Bucket', {
  planId: { type: DataTypes.INTEGER, allowNull: false },
  name: { type: DataTypes.STRING(150), allowNull: false },
  sortOrder: { type: DataTypes.DOUBLE, defaultValue: 0 },
}, { tableName: 'buckets' });

const Task = sequelize.define('Task', {
  planId: { type: DataTypes.INTEGER, allowNull: false },
  bucketId: { type: DataTypes.INTEGER },
  title: { type: DataTypes.STRING(255), allowNull: false },
  notes: { type: DataTypes.TEXT },
  progress: { type: DataTypes.INTEGER, defaultValue: 0 }, // 0 未開始 / 50 進行中 / 100 已完成
  priority: { type: DataTypes.INTEGER, defaultValue: 5 }, // 1 緊急 / 3 重要 / 5 中 / 9 低
  startDate: { type: DataTypes.DATEONLY },
  dueDate: { type: DataTypes.DATEONLY },
  sortOrder: { type: DataTypes.DOUBLE, defaultValue: 0 },
  previewType: { type: DataTypes.STRING(20), defaultValue: 'automatic' }, // automatic / noPreview / checklist / description / reference
  labels: jsonText('labels', []),
  completedAt: { type: DataTypes.DATE },
  completedById: { type: DataTypes.INTEGER },
  createdById: { type: DataTypes.INTEGER },
}, { tableName: 'tasks' });

const TaskAssignee = sequelize.define('TaskAssignee', {
  taskId: { type: DataTypes.INTEGER, allowNull: false },
  userId: { type: DataTypes.INTEGER, allowNull: false },
}, { tableName: 'task_assignees', indexes: [{ unique: true, fields: ['task_id', 'user_id'] }] });

const ChecklistItem = sequelize.define('ChecklistItem', {
  taskId: { type: DataTypes.INTEGER, allowNull: false },
  title: { type: DataTypes.STRING(255), allowNull: false },
  isChecked: { type: DataTypes.BOOLEAN, defaultValue: false },
  sortOrder: { type: DataTypes.DOUBLE, defaultValue: 0 },
}, { tableName: 'checklist_items' });

const Attachment = sequelize.define('Attachment', {
  taskId: { type: DataTypes.INTEGER, allowNull: false },
  type: { type: DataTypes.ENUM('link', 'file'), defaultValue: 'link' },
  name: { type: DataTypes.STRING(255), allowNull: false },
  url: { type: DataTypes.STRING(1000), allowNull: false },
  mimeType: { type: DataTypes.STRING(150) },
  size: { type: DataTypes.INTEGER },
  createdById: { type: DataTypes.INTEGER },
}, { tableName: 'attachments' });

const Comment = sequelize.define('Comment', {
  taskId: { type: DataTypes.INTEGER, allowNull: false },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: false },
}, { tableName: 'comments' });

const MyDayItem = sequelize.define('MyDayItem', {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  taskId: { type: DataTypes.INTEGER, allowNull: false },
  date: { type: DataTypes.DATEONLY, allowNull: false },
}, { tableName: 'my_day_items', indexes: [{ unique: true, fields: ['user_id', 'task_id', 'date'] }] });

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

Task.belongsToMany(User, { as: 'assignees', through: TaskAssignee, foreignKey: 'taskId', otherKey: 'userId' });
User.belongsToMany(Task, { as: 'assignedTasks', through: TaskAssignee, foreignKey: 'userId', otherKey: 'taskId' });
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
