const { sequelize } = require('../src/models');

// node scripts/db-sync.js [--alter | --force]
// --force 會刪除所有資料表並清除 seed 紀錄（之後需重新執行 db:seed）
(async () => {
  const force = process.argv.includes('--force');
  await sequelize.sync({ alter: process.argv.includes('--alter'), force });
  if (force) await sequelize.query('DROP TABLE IF EXISTS `sequelize_data`');
  console.log('資料表同步完成');
  await sequelize.close();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
