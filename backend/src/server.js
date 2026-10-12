const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });

const fs = require('fs');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { sequelize } = require('./models');
const { requireAuth } = require('./middleware/auth');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const publicDir = path.join(__dirname, '../public');

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', requireAuth, require('./routes/users'));
app.use('/api/plans', requireAuth, require('./routes/plans'));
app.use('/api/buckets', requireAuth, require('./routes/buckets'));
app.use('/api/tasks', requireAuth, require('./routes/tasks'));
app.use('/api/me', requireAuth, require('./routes/me'));
app.use('/api', (req, res) => res.status(404).json({ message: 'API 不存在' }));

// 附件
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 前端（vue build 輸出至 backend/public）
app.use(express.static(publicDir));
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  const indexFile = path.join(publicDir, 'index.html');
  if (!fs.existsSync(indexFile)) return res.status(404).send('前端尚未 build，請先在 frontend 執行 npm run build');
  res.sendFile(indexFile);
});

// 錯誤處理
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ message: '檔案不可超過 20MB' });
  // 欄位驗證（例如超過長度上限）
  if (err.name === 'SequelizeValidationError') return res.status(400).json({ message: err.errors[0]?.message || '資料格式不正確' });
  if (err.parent?.code === 'ER_DATA_TOO_LONG') return res.status(400).json({ message: '輸入內容過長' });
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ message: status >= 500 ? '伺服器錯誤' : err.message });
});

(async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync();
    app.listen(PORT, () => console.log(`Planner 伺服器啟動：http://localhost:${PORT}`));
  } catch (err) {
    console.error('資料庫連線失敗：', err.message);
    process.exit(1);
  }
})();
