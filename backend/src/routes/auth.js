const express = require('express');
const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { signToken, requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ message: '請輸入帳號與密碼' });
  const user = await User.findOne({ where: { username: String(username).trim() } });
  if (!user || !(await bcrypt.compare(String(password), user.passwordHash))) {
    return res.status(401).json({ message: '帳號或密碼錯誤' });
  }
  if (!user.isActive) return res.status(403).json({ message: '此帳號已停用' });
  res.json({ token: signToken(user), user: user.toSafeJSON() });
});

router.get('/me', requireAuth, (req, res) => {
  res.json(req.user.toSafeJSON());
});

router.put('/me', requireAuth, async (req, res) => {
  const { displayName, email, color } = req.body || {};
  if (displayName !== undefined) {
    if (!String(displayName).trim()) return res.status(400).json({ message: '顯示名稱不可空白' });
    req.user.displayName = String(displayName).trim();
  }
  if (email !== undefined) req.user.email = email;
  if (color !== undefined) req.user.color = color;
  await req.user.save();
  res.json(req.user.toSafeJSON());
});

router.put('/me/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!(await bcrypt.compare(String(currentPassword || ''), req.user.passwordHash))) {
    return res.status(400).json({ message: '目前密碼不正確' });
  }
  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ message: '新密碼至少 6 個字元' });
  }
  req.user.passwordHash = await bcrypt.hash(String(newPassword), 10);
  await req.user.save();
  res.json({ ok: true });
});

module.exports = router;
