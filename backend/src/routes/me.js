const express = require('express');
const { Op } = require('sequelize');
const {
  TaskAssignee, MyDayItem, PlanMember, Plan, Bucket,
} = require('../models');
const { today, loadTaskSummaries } = require('../utils/helpers');

const router = express.Router();

const withPlanBucket = [
  { model: Plan, attributes: ['id', 'name', 'color', 'labelNames'] },
  { model: Bucket, attributes: ['id', 'name'] },
];

async function myPlanIds(userId) {
  const rows = await PlanMember.findAll({ where: { userId }, attributes: ['planId'], raw: true });
  return rows.map((r) => r.planId);
}

// 指派給我的工作
router.get('/tasks', async (req, res) => {
  const planIds = await myPlanIds(req.user.id);
  const rows = await TaskAssignee.findAll({ where: { userId: req.user.id }, attributes: ['taskId'], raw: true });
  const ids = rows.map((r) => r.taskId);
  if (!ids.length) return res.json([]);
  res.json(await loadTaskSummaries({ id: ids, planId: planIds }, req.user.id, withPlanBucket));
});

// 我的一天：已加入的工作 + 建議（今天到期或已逾期且指派給我）
router.get('/myday', async (req, res) => {
  const planIds = await myPlanIds(req.user.id);
  const d = today();
  const dayRows = await MyDayItem.findAll({ where: { userId: req.user.id, date: d }, attributes: ['taskId'], raw: true });
  const dayIds = dayRows.map((r) => r.taskId);
  const tasks = dayIds.length
    ? await loadTaskSummaries({ id: dayIds, planId: planIds }, req.user.id, withPlanBucket)
    : [];

  const assigned = await TaskAssignee.findAll({ where: { userId: req.user.id }, attributes: ['taskId'], raw: true });
  const assignedIds = assigned.map((r) => r.taskId).filter((id) => !dayIds.includes(id));
  const suggestions = assignedIds.length
    ? await loadTaskSummaries({
      id: assignedIds,
      planId: planIds,
      progress: { [Op.ne]: 100 },
      dueDate: { [Op.lte]: d },
    }, req.user.id, withPlanBucket)
    : [];
  res.json({ date: d, tasks, suggestions });
});

module.exports = router;
