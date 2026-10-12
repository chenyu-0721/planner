const path = require('path');

// 用法：在專案根目錄執行 pm2 start ecosystem.config.js
// 等同於 backend/ecosystem.config.js
const backend = path.join(__dirname, 'backend');

module.exports = {
  apps: [
    {
      name: 'planner',
      script: path.join(backend, 'src/server.js'),
      cwd: backend,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      time: true,
      out_file: path.join(backend, 'logs/out.log'),
      error_file: path.join(backend, 'logs/error.log'),
      merge_logs: true,
      env: {
        NODE_ENV: 'production',
        PORT: 8080,
      },
    },
  ],
};
