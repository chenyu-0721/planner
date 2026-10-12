// 重設使用者密碼（例如管理員忘記密碼）
// 用法：npm run reset-password -- <帳號> <新密碼> [--remote]
//   預設修改本機 D1（wrangler dev 使用的資料庫），加上 --remote 修改正式環境
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { hashPassword } from '../src/lib/password.js';

const args = process.argv.slice(2);
const remote = args.includes('--remote');
const [username, password] = args.filter((a) => !a.startsWith('--'));

if (!username || !password) {
  console.log('用法：npm run reset-password -- <帳號> <新密碼> [--remote]');
  process.exit(1);
}
if (!/^[A-Za-z0-9_.-]{3,50}$/.test(username)) {
  console.error('帳號格式不正確');
  process.exit(1);
}
if (password.length < 6) {
  console.error('密碼至少 6 個字元');
  process.exit(1);
}

const hash = await hashPassword(password);
const sqlText = `UPDATE users SET password_hash = '${hash}', is_active = 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE username = '${username}'`;

// 直接以 node 執行 wrangler，避免 Windows shell 拆解參數中的空白與引號
const wrangler = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
execFileSync(process.execPath, [wrangler, 'd1', 'execute', 'planner-db', remote ? '--remote' : '--local', '--command', sqlText], {
  stdio: 'inherit',
});
console.log(`已重設 ${username} 的密碼（${remote ? '正式環境' : '本機'}）。若上方顯示 changes: 0，代表找不到此帳號。`);
