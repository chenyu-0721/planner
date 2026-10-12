const {
  Plan, PlanMember, Task, ChecklistItem, Attachment, Comment, MyDayItem, sequelize,
} = require('../models');

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// 確認使用者可存取該計劃（成員或管理員）
async function assertPlanAccess(user, planId) {
  const plan = await Plan.findByPk(planId);
  if (!plan) throw new HttpError(404, '找不到計劃');
  if (user.role === 'admin') return plan;
  const member = await PlanMember.findOne({ where: { planId, userId: user.id } });
  if (!member) throw new HttpError(403, '你不是此計劃的成員');
  return plan;
}

async function loadTaskWithAccess(user, taskId) {
  const task = await Task.findByPk(taskId);
  if (!task) throw new HttpError(404, '找不到工作');
  await assertPlanAccess(user, task.planId);
  return task;
}

const taskIncludes = [
  { association: 'assignments', attributes: ['userId'] },
  { model: ChecklistItem, as: 'checklist', attributes: ['id', 'title', 'isChecked', 'sortOrder'] },
  { model: Attachment, as: 'attachments', attributes: ['id', 'type', 'name', 'url', 'mimeType'] },
];

// 取得卡片需要的工作摘要
async function loadTaskSummaries(where, userId, extraInclude = []) {
  const tasks = await Task.findAll({
    where,
    include: [...taskIncludes, ...extraInclude],
    order: [['sortOrder', 'ASC'], ['id', 'ASC']],
  });
  if (!tasks.length) return [];
  const ids = tasks.map((t) => t.id);
  const [commentRows, myDayRows] = await Promise.all([
    Comment.findAll({
      where: { taskId: ids },
      attributes: ['taskId', [sequelize.fn('COUNT', sequelize.col('id')), 'cnt']],
      group: ['taskId'],
      raw: true,
    }),
    MyDayItem.findAll({ where: { taskId: ids, userId, date: today() }, raw: true }),
  ]);
  const commentMap = Object.fromEntries(commentRows.map((r) => [r.taskId, Number(r.cnt)]));
  const myDaySet = new Set(myDayRows.map((r) => r.taskId));
  return tasks.map((t) => serializeTask(t, { commentCount: commentMap[t.id] || 0, inMyDay: myDaySet.has(t.id) }));
}

function serializeTask(t, extra = {}) {
  const checklist = [...(t.checklist || [])].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  const data = {
    id: t.id,
    planId: t.planId,
    bucketId: t.bucketId,
    title: t.title,
    notes: t.notes || '',
    progress: t.progress,
    priority: t.priority,
    startDate: t.startDate,
    dueDate: t.dueDate,
    sortOrder: t.sortOrder,
    previewType: t.previewType,
    labels: t.labels || [],
    completedAt: t.completedAt,
    completedById: t.completedById,
    createdById: t.createdById,
    createdAt: t.createdAt,
    assigneeIds: (t.assignments || []).map((a) => a.userId),
    checklist: checklist.map((c) => ({ id: c.id, title: c.title, isChecked: c.isChecked, sortOrder: c.sortOrder })),
    checklistTotal: checklist.length,
    checklistDone: checklist.filter((c) => c.isChecked).length,
    attachments: (t.attachments || []).map((a) => ({ id: a.id, type: a.type, name: a.name, url: a.url, mimeType: a.mimeType })),
    commentCount: 0,
    inMyDay: false,
    ...extra,
  };
  if (t.Plan) data.plan = { id: t.Plan.id, name: t.Plan.name, color: t.Plan.color, labelNames: t.Plan.labelNames };
  if (t.Bucket) data.bucket = { id: t.Bucket.id, name: t.Bucket.name };
  return data;
}

async function loadTaskSummary(taskId, userId) {
  const [task] = await loadTaskSummaries({ id: taskId }, userId);
  return task;
}

module.exports = {
  HttpError,
  today,
  assertPlanAccess,
  loadTaskWithAccess,
  loadTaskSummaries,
  loadTaskSummary,
};
