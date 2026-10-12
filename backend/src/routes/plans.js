const express = require('express');
const { Op } = require('sequelize');
const {
  sequelize, Plan, PlanMember, Bucket, Task, TaskAssignee, User,
} = require('../models');
const {
  HttpError, assertPlanAccess, loadTaskSummaries, loadTaskSummary,
} = require('../utils/helpers');

const router = express.Router();

function canManage(user, plan) {
  return user.role === 'admin' || plan.ownerId === user.id;
}

// 我的計劃清單
router.get('/', async (req, res) => {
  const memberships = await PlanMember.findAll({
    where: { userId: req.user.id },
    include: [{ model: Plan }],
  });
  const planIds = memberships.map((m) => m.planId);
  const [taskStats, memberStats] = await Promise.all([
    Task.findAll({
      where: { planId: planIds },
      attributes: [
        'planId',
        [sequelize.fn('COUNT', sequelize.col('id')), 'total'],
        [sequelize.fn('SUM', sequelize.literal('CASE WHEN progress = 100 THEN 1 ELSE 0 END')), 'done'],
      ],
      group: ['planId'],
      raw: true,
    }),
    PlanMember.findAll({
      where: { planId: planIds },
      attributes: ['planId', [sequelize.fn('COUNT', sequelize.col('id')), 'cnt']],
      group: ['planId'],
      raw: true,
    }),
  ]);
  const statMap = Object.fromEntries(taskStats.map((s) => [s.planId, s]));
  const memberMap = Object.fromEntries(memberStats.map((s) => [s.planId, Number(s.cnt)]));
  res.json(
    memberships
      .filter((m) => m.Plan)
      .map((m) => ({
        id: m.Plan.id,
        name: m.Plan.name,
        description: m.Plan.description,
        color: m.Plan.color,
        ownerId: m.Plan.ownerId,
        createdAt: m.Plan.createdAt,
        updatedAt: m.Plan.updatedAt,
        pinned: m.pinned,
        role: m.role,
        lastViewedAt: m.lastViewedAt,
        taskCount: Number(statMap[m.planId]?.total || 0),
        completedCount: Number(statMap[m.planId]?.done || 0),
        memberCount: memberMap[m.planId] || 0,
      })),
  );
});

router.post('/', async (req, res) => {
  const { name, description, color } = req.body || {};
  if (!name || !String(name).trim()) throw new HttpError(400, '請輸入計劃名稱');
  const plan = await sequelize.transaction(async (transaction) => {
    const p = await Plan.create({
      name: String(name).trim(),
      description,
      color: Number.isInteger(color) ? color : Math.floor(Math.random() * 12),
      ownerId: req.user.id,
    }, { transaction });
    await PlanMember.create({ planId: p.id, userId: req.user.id, role: 'owner', lastViewedAt: new Date() }, { transaction });
    await Bucket.create({ planId: p.id, name: '待辦事項', sortOrder: 0 }, { transaction });
    return p;
  });
  res.status(201).json(plan);
});

// 計劃完整資料（成員、貯體、工作）
router.get('/:id', async (req, res) => {
  const plan = await assertPlanAccess(req.user, req.params.id);
  const [memberships, buckets, tasks] = await Promise.all([
    PlanMember.findAll({ where: { planId: plan.id }, include: [{ model: User }], order: [['id', 'ASC']] }),
    Bucket.findAll({ where: { planId: plan.id }, order: [['sortOrder', 'ASC'], ['id', 'ASC']] }),
    loadTaskSummaries({ planId: plan.id }, req.user.id),
  ]);
  const mine = memberships.find((m) => m.userId === req.user.id);
  if (mine) {
    mine.lastViewedAt = new Date();
    await mine.save();
  }
  res.json({
    plan: {
      id: plan.id,
      name: plan.name,
      description: plan.description,
      color: plan.color,
      ownerId: plan.ownerId,
      labelNames: plan.labelNames,
      createdAt: plan.createdAt,
      pinned: !!mine?.pinned,
      isMember: !!mine,
      canManage: canManage(req.user, plan),
    },
    members: memberships
      .filter((m) => m.User)
      .map((m) => ({ ...m.User.toSafeJSON(), planRole: m.role })),
    buckets: buckets.map((b) => ({ id: b.id, name: b.name, sortOrder: b.sortOrder })),
    tasks,
  });
});

router.put('/:id', async (req, res) => {
  const plan = await assertPlanAccess(req.user, req.params.id);
  const { name, description, color, labelNames } = req.body || {};
  if (name !== undefined) {
    if (!String(name).trim()) throw new HttpError(400, '計劃名稱不可空白');
    plan.name = String(name).trim();
  }
  if (description !== undefined) plan.description = description;
  if (color !== undefined) plan.color = Number(color) || 0;
  if (labelNames !== undefined && typeof labelNames === 'object') plan.labelNames = labelNames;
  await plan.save();
  res.json({
    id: plan.id, name: plan.name, description: plan.description, color: plan.color, labelNames: plan.labelNames,
  });
});

router.delete('/:id', async (req, res) => {
  const plan = await assertPlanAccess(req.user, req.params.id);
  if (!canManage(req.user, plan)) throw new HttpError(403, '只有計劃擁有者可以刪除計劃');
  await plan.destroy();
  res.json({ ok: true });
});

router.put('/:id/pin', async (req, res) => {
  await assertPlanAccess(req.user, req.params.id);
  const member = await PlanMember.findOne({ where: { planId: req.params.id, userId: req.user.id } });
  if (!member) throw new HttpError(400, '只有成員可以釘選計劃');
  member.pinned = !!req.body?.pinned;
  await member.save();
  res.json({ pinned: member.pinned });
});

// 成員
router.post('/:id/members', async (req, res) => {
  const plan = await assertPlanAccess(req.user, req.params.id);
  const user = await User.findByPk(req.body?.userId);
  if (!user || !user.isActive) throw new HttpError(404, '找不到使用者');
  const [member] = await PlanMember.findOrCreate({
    where: { planId: plan.id, userId: user.id },
    defaults: { role: 'member' },
  });
  res.status(201).json({ ...user.toSafeJSON(), planRole: member.role });
});

router.delete('/:id/members/:userId', async (req, res) => {
  const plan = await assertPlanAccess(req.user, req.params.id);
  const userId = Number(req.params.userId);
  if (userId !== req.user.id && !canManage(req.user, plan)) throw new HttpError(403, '沒有權限移除成員');
  if (userId === plan.ownerId) throw new HttpError(400, '無法移除計劃擁有者');
  const taskIds = (await Task.findAll({ where: { planId: plan.id }, attributes: ['id'], raw: true })).map((t) => t.id);
  await TaskAssignee.destroy({ where: { userId, taskId: { [Op.in]: taskIds.length ? taskIds : [0] } } });
  await PlanMember.destroy({ where: { planId: plan.id, userId } });
  res.json({ ok: true });
});

// 貯體
router.post('/:id/buckets', async (req, res) => {
  const plan = await assertPlanAccess(req.user, req.params.id);
  const name = String(req.body?.name || '').trim();
  if (!name) throw new HttpError(400, '請輸入貯體名稱');
  let { sortOrder } = req.body || {};
  if (sortOrder === undefined) {
    const max = await Bucket.max('sortOrder', { where: { planId: plan.id } });
    sortOrder = (Number.isFinite(max) ? max : 0) + 1;
  }
  const bucket = await Bucket.create({ planId: plan.id, name, sortOrder });
  res.status(201).json({ id: bucket.id, name: bucket.name, sortOrder: bucket.sortOrder });
});

// 新增工作
router.post('/:id/tasks', async (req, res) => {
  const plan = await assertPlanAccess(req.user, req.params.id);
  const body = req.body || {};
  const title = String(body.title || '').trim();
  if (!title) throw new HttpError(400, '請輸入工作名稱');

  let bucketId = body.bucketId;
  if (bucketId) {
    const bucket = await Bucket.findOne({ where: { id: bucketId, planId: plan.id } });
    if (!bucket) throw new HttpError(400, '貯體不存在');
  } else {
    const first = await Bucket.findOne({ where: { planId: plan.id }, order: [['sortOrder', 'ASC'], ['id', 'ASC']] });
    bucketId = first ? first.id : (await Bucket.create({ planId: plan.id, name: '待辦事項' })).id;
  }

  const min = await Task.min('sortOrder', { where: { planId: plan.id, bucketId } });
  const progress = [0, 50, 100].includes(body.progress) ? body.progress : 0;
  const task = await Task.create({
    planId: plan.id,
    bucketId,
    title,
    notes: body.notes || null,
    progress,
    priority: [1, 3, 5, 9].includes(body.priority) ? body.priority : 5,
    startDate: body.startDate || null,
    dueDate: body.dueDate || null,
    labels: Array.isArray(body.labels) ? body.labels : [],
    sortOrder: body.sortOrder ?? (Number.isFinite(min) ? min - 1 : 0),
    completedAt: progress === 100 ? new Date() : null,
    completedById: progress === 100 ? req.user.id : null,
    createdById: req.user.id,
  });

  if (Array.isArray(body.assigneeIds) && body.assigneeIds.length) {
    const members = await PlanMember.findAll({ where: { planId: plan.id, userId: body.assigneeIds } });
    await TaskAssignee.bulkCreate(members.map((m) => ({ taskId: task.id, userId: m.userId })));
  }
  res.status(201).json(await loadTaskSummary(task.id, req.user.id));
});

module.exports = router;
