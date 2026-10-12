const path = require('path');

// 用法：在 backend 目錄執行 pm2 start ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'planner',
      script: 'src/server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      time: true,
      out_file: path.join(__dirname, 'logs/out.log'),
      error_file: path.join(__dirname, 'logs/error.log'),
      merge_logs: true,
      env: {
        NODE_ENV: 'production',
        PORT: 8080,
      },
    },
  ],
};
