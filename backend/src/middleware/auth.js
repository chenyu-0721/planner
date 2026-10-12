const jwt = require('jsonwebtoken');
const { User } = require('../models');

const secret = () => process.env.JWT_SECRET || 'planner_secret';

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, secret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: '請先登入' });
  try {
    const payload = jwt.verify(token, secret());
    const user = await User.findByPk(payload.id);
    if (!user || !user.isActive) return res.status(401).json({ message: '帳號不存在或已停用' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: '登入已過期，請重新登入' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: '需要管理員權限' });
  next();
}

module.exports = { signToken, requireAuth, requireAdmin };
