const express = require('express');
const { Bucket } = require('../models');
const { HttpError, assertPlanAccess } = require('../utils/helpers');

const router = express.Router();

async function loadBucket(user, id) {
  const bucket = await Bucket.findByPk(id);
  if (!bucket) throw new HttpError(404, '找不到貯體');
  await assertPlanAccess(user, bucket.planId);
  return bucket;
}

router.put('/:id', async (req, res) => {
  const bucket = await loadBucket(req.user, req.params.id);
  const { name, sortOrder } = req.body || {};
  if (name !== undefined) {
    if (!String(name).trim()) throw new HttpError(400, '貯體名稱不可空白');
    bucket.name = String(name).trim();
  }
  if (sortOrder !== undefined) bucket.sortOrder = Number(sortOrder);
  await bucket.save();
  res.json({ id: bucket.id, name: bucket.name, sortOrder: bucket.sortOrder });
});

// 刪除貯體會一併刪除其中的工作（與 Planner 相同）
router.delete('/:id', async (req, res) => {
  const bucket = await loadBucket(req.user, req.params.id);
  await bucket.destroy();
  res.json({ ok: true });
});

module.exports = router;
