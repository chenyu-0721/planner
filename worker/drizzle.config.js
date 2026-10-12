import { defineConfig } from 'drizzle-kit';

// 修改 src/db/schema.js 後執行 npm run db:generate 產生 migration SQL
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.js',
  out: './migrations',
});
