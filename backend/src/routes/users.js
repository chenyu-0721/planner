const express = require('express');
const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

const COLORS = ['#0078d4', '#8764b8', '#038387', '#ca5010', '#c239b3', '#498205', '#d13438', '#004e8c', '#986f0b', '#5c2e91'];

// 所有啟用中的使用者（用於指派、加入成員）
router.get('/', async (req, res) => {
  const users = await User.findAll({ where: { isActive: true }, order: [['displayName', 'ASC']] });
  res.json(users.map((u) => u.toSafeJSON()));
});

// 以下為管理員功能
router.get('/all', requireAdmin, async (req, res) => {
  const users = await User.findAll({ order: [['id', 'ASC']] });
  res.json(users.map((u) => ({ ...u.toSafeJSON(), createdAt: u.createdAt })));
});

router.get('/:id', requireAdmin, async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ message: '找不到使用者' });
  res.json({ ...user.toSafeJSON(), createdAt: user.createdAt });
});

const USERNAME_RE = /^[A-Za-z0-9_.-]{3,50}$/;
const passwordError = (pw) => (String(pw).length < 6 ? '密碼至少 6 個字元' : null);

router.post('/', requireAdmin, async (req, res) => {
  const { username, password, displayName, email, role } = req.body || {};
  if (!username || !password || !displayName) {
    return res.status(400).json({ message: '帳號、密碼、顯示名稱為必填' });
  }
  if (!USERNAME_RE.test(String(username).trim())) {
    return res.status(400).json({ message: '帳號需為 3~50 個英文、數字或 _ . - 字元' });
  }
  if (passwordError(password)) return res.status(400).json({ message: passwordError(password) });
  if (await User.findOne({ where: { username: String(username).trim() } })) {
    return res.status(400).json({ message: '帳號已存在' });
  }
  const user = await User.create({
    username: String(username).trim(),
    passwordHash: await bcrypt.hash(String(password), 10),
    displayName: String(displayName).trim(),
    email,
    role: role === 'admin' ? 'admin' : 'member',
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  });
  res.status(201).json(user.toSafeJSON());
});

router.put('/:id', requireAdmin, async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ message: '找不到使用者' });
  const { displayName, email, role, isActive, password } = req.body || {};
  if (displayName !== undefined) user.displayName = String(displayName).trim() || user.displayName;
  if (email !== undefined) user.email = email;
  if (role !== undefined && user.id !== req.user.id) user.role = role === 'admin' ? 'admin' : 'member';
  if (isActive !== undefined && user.id !== req.user.id) user.isActive = !!isActive;
  if (password && passwordError(password)) return res.status(400).json({ message: passwordError(password) });
  if (password) user.passwordHash = await bcrypt.hash(String(password), 10);
  await user.save();
  res.json(user.toSafeJSON());
});

router.delete('/:id', requireAdmin, async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ message: '找不到使用者' });
  if (user.id === req.user.id) return res.status(400).json({ message: '不能刪除自己' });
  await user.destroy();
  res.json({ ok: true });
});

module.exports = router;
