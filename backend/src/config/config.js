const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env'), quiet: true });

const base = {
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'planner',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  dialect: 'mysql',
  timezone: '+08:00',
  logging: false,
  define: { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci', underscored: true },
  seederStorage: 'sequelize',
  seederStorageTableName: 'sequelize_data',
};

module.exports = { development: base, production: base, test: base };
