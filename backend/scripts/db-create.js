const mysql = require('mysql2/promise');
const config = require('../src/config/config').development;

(async () => {
  const conn = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password,
  });
  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  console.log(`資料庫 ${config.database} 已就緒`);
  await conn.end();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
