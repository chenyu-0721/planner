const bcrypt = require('bcryptjs');
const { sequelize, User } = require('../src/models');

// node scripts/reset-password.js <帳號> <新密碼>
(async () => {
  const [username, password] = process.argv.slice(2);
  if (!username || !password) {
    console.log('用法：npm run reset-password -- <帳號> <新密碼>');
    process.exit(1);
  }
  const user = await User.findOne({ where: { username } });
  if (!user) {
    console.error(`找不到帳號 ${username}`);
    process.exit(1);
  }
  user.passwordHash = await bcrypt.hash(password, 10);
  user.isActive = true;
  await user.save();
  console.log(`已重設 ${username} 的密碼`);
  await sequelize.close();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
