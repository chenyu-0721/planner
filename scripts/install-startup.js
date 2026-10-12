// Windows 開機（登入）時自動以 PM2 啟動 planner
// 安裝：node scripts/install-startup.js
// 移除：node scripts/install-startup.js --remove
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

if (process.platform !== 'win32') {
  console.log('此腳本僅適用於 Windows。Linux / macOS 請使用：pm2 startup && pm2 save');
  process.exit(0);
}

const startupDir = path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
const target = path.join(startupDir, 'planner-pm2.vbs');

if (process.argv.includes('--remove')) {
  if (fs.existsSync(target)) fs.unlinkSync(target);
  console.log('已移除開機自動啟動：', target);
  process.exit(0);
}

// 找 pm2.cmd 的完整路徑
let pm2;
try {
  pm2 = execSync('where pm2.cmd', { encoding: 'utf8' }).split(/\r?\n/).find(Boolean).trim();
} catch {
  console.error('找不到 pm2，請先執行：npm install -g pm2');
  process.exit(1);
}

const ecosystem = path.resolve(__dirname, '..', 'ecosystem.config.js');
const vbs = [
  "' Planner：登入 Windows 時以 PM2 啟動（隱藏視窗）",
  'Set sh = CreateObject("WScript.Shell")',
  `sh.Run """${pm2}"" start ""${ecosystem}""", 0, False`,
  '',
].join('\r\n');

// UTF-16LE + BOM，路徑含中文也能正確執行
fs.writeFileSync(target, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(vbs, 'utf16le')]));
console.log('已設定開機自動啟動：', target);
