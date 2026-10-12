const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const {
  LIMITS, Bucket, PlanMember, TaskAssignee, ChecklistItem, Attachment, Comment, MyDayItem, User,
} = require('../models');
const {
  HttpError, today, loadTaskWithAccess, loadTaskSummary,
} = require('../utils/helpers');

const router = express.Router();

const uploadDir = path.join(__dirname, '../../uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname).slice(0, 10)}`),
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
});

// 過長的名稱截斷（檔名保留副檔名）
function clipName(name, max = LIMITS.attachmentName) {
  if (name.length <= max) return name;
  const ext = path.extname(name).slice(0, 10);
  return name.slice(0, max - ext.length - 1) + '…' + ext;
}

const isDate = (v) => v === null || v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v);

// 工作詳細資料（含意見）
router.get('/:id', async (req, res) => {
  const task = await loadTaskWithAccess(req.user, req.params.id);
  const [summary, comments] = await Promise.all([
    loadTaskSummary(task.id, req.user.id),
    Comment.findAll({
      where: { taskId: task.id },
      include: [{ model: User, as: 'user', attributes: ['id', 'displayName', 'color'] }],
      order: [['createdAt', 'DESC']],
    }),
  ]);
  res.json({
    ...summary,
    comments: comments.map((c) => ({
      id: c.id, content: c.content, createdAt: c.createdAt, userId: c.userId, user: c.user,
    })),
  });
});

router.put('/:id', async (req, res) => {
  const task = await loadTaskWithAccess(req.user, req.params.id);
  const b = req.body || {};

  if (b.title !== undefined) {
    if (!String(b.title).trim()) throw new HttpError(400, '工作名稱不可空白');
    task.title = String(b.title).trim();
  }
  if (b.notes !== undefined) task.notes = b.notes;
  if (b.priority !== undefined) {
    if (![1, 3, 5, 9].includes(b.priority)) throw new HttpError(400, '優先順序不正確');
    task.priority = b.priority;
  }
  if (b.progress !== undefined) {
    if (![0, 50, 100].includes(b.progress)) throw new HttpError(400, '進度不正確');
    if (b.progress === 100 && task.progress !== 100) {
      task.completedAt = new Date();
      task.completedById = req.user.id;
    } else if (b.progress !== 100) {
      task.completedAt = null;
      task.completedById = null;
    }
    task.progress = b.progress;
  }
  for (const key of ['startDate', 'dueDate']) {
    if (b[key] !== undefined) {
      if (!isDate(b[key])) throw new HttpError(400, '日期格式不正確');
      task[key] = b[key] || null;
    }
  }
  if (b.sortOrder !== undefined) task.sortOrder = Number(b.sortOrder);
  if (b.previewType !== undefined) task.previewType = b.previewType;
  if (b.labels !== undefined) {
    task.labels = [...new Set((b.labels || []).map(Number).filter((n) => n >= 1 && n <= 25))].sort((x, y) => x - y);
  }
  if (b.bucketId !== undefined) {
    const bucket = await Bucket.findOne({ where: { id: b.bucketId, planId: task.planId } });
    if (!bucket) throw new HttpError(400, '貯體不存在');
    task.bucketId = bucket.id;
  }
  await task.save();

  if (Array.isArray(b.assigneeIds)) {
    const members = await PlanMember.findAll({ where: { planId: task.planId, userId: b.assigneeIds } });
    await TaskAssignee.destroy({ where: { taskId: task.id } });
    await TaskAssignee.bulkCreate(members.map((m) => ({ taskId: task.id, userId: m.userId })));
  }
  res.json(await loadTaskSummary(task.id, req.user.id));
});

router.delete('/:id', async (req, res) => {
  const task = await loadTaskWithAccess(req.user, req.params.id);
  const files = await Attachment.findAll({ where: { taskId: task.id, type: 'file' } });
  await task.destroy();
  files.forEach((f) => fs.unlink(path.join(uploadDir, path.basename(f.url)), () => {}));
  res.json({ ok: true });
});

// 我的一天
router.put('/:id/myday', async (req, res) => {
  const task = await loadTaskWithAccess(req.user, req.params.id);
  const where = { userId: req.user.id, taskId: task.id, date: today() };
  if (req.body?.inMyDay) await MyDayItem.findOrCreate({ where });
  else await MyDayItem.destroy({ where });
  res.json({ inMyDay: !!req.body?.inMyDay });
});

// 檢查清單
router.post('/:id/checklist', async (req, res) => {
  const task = await loadTaskWithAccess(req.user, req.params.id);
  const title = String(req.body?.title || '').trim();
  if (!title) throw new HttpError(400, '請輸入項目');
  const max = await ChecklistItem.max('sortOrder', { where: { taskId: task.id } });
  const item = await ChecklistItem.create({ taskId: task.id, title, sortOrder: (Number.isFinite(max) ? max : 0) + 1 });
  res.status(201).json(item);
});

router.put('/:id/checklist/:itemId', async (req, res) => {
  const task = await loadTaskWithAccess(req.user, req.params.id);
  const item = await ChecklistItem.findOne({ where: { id: req.params.itemId, taskId: task.id } });
  if (!item) throw new HttpError(404, '找不到項目');
  const { title, isChecked, sortOrder } = req.body || {};
  if (title !== undefined && String(title).trim()) item.title = String(title).trim();
  if (isChecked !== undefined) item.isChecked = !!isChecked;
  if (sortOrder !== undefined) item.sortOrder = Number(sortOrder);
  await item.save();
  res.json(item);
});

router.delete('/:id/checklist/:itemId', async (req, res) => {
  const task = await loadTaskWithAccess(req.user, req.params.id);
  await ChecklistItem.destroy({ where: { id: req.params.itemId, taskId: task.id } });
  res.json({ ok: true });
});

// 附件：連結（JSON）或檔案（multipart）
router.post('/:id/attachments', upload.single('file'), async (req, res) => {
  const task = await loadTaskWithAccess(req.user, req.params.id);
  let data;
  if (req.file) {
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    data = {
      type: 'file',
      name: clipName(originalName),
      url: `/uploads/${req.file.filename}`,
      mimeType: req.file.mimetype,
      size: req.file.size,
    };
  } else {
    let url = String(req.body?.url || '').trim();
    if (!url) throw new HttpError(400, '請輸入連結網址');
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    data = { type: 'link', name: clipName(String(req.body?.name || '').trim() || url), url };
  }
  const att = await Attachment.create({ ...data, taskId: task.id, createdById: req.user.id });
  res.status(201).json(att);
});

router.delete('/:id/attachments/:attId', async (req, res) => {
  const task = await loadTaskWithAccess(req.user, req.params.id);
  const att = await Attachment.findOne({ where: { id: req.params.attId, taskId: task.id } });
  if (!att) throw new HttpError(404, '找不到附件');
  if (att.type === 'file') fs.unlink(path.join(uploadDir, path.basename(att.url)), () => {});
  await att.destroy();
  res.json({ ok: true });
});

// 意見
router.post('/:id/comments', async (req, res) => {
  const task = await loadTaskWithAccess(req.user, req.params.id);
  const content = String(req.body?.content || '').trim();
  if (!content) throw new HttpError(400, '請輸入意見內容');
  const c = await Comment.create({ taskId: task.id, userId: req.user.id, content });
  res.status(201).json({
    id: c.id,
    content: c.content,
    createdAt: c.createdAt,
    userId: c.userId,
    user: { id: req.user.id, displayName: req.user.displayName, color: req.user.color },
  });
});

router.delete('/:id/comments/:commentId', async (req, res) => {
  const task = await loadTaskWithAccess(req.user, req.params.id);
  const c = await Comment.findOne({ where: { id: req.params.commentId, taskId: task.id } });
  if (!c) throw new HttpError(404, '找不到意見');
  if (c.userId !== req.user.id && req.user.role !== 'admin') throw new HttpError(403, '只能刪除自己的意見');
  await c.destroy();
  res.json({ ok: true });
});

module.exports = router;
