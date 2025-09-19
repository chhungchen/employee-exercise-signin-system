/**
 * PM2 生態系統配置檔
 * 內網輔助郵件伺服器專用配置
 * 機密等級：內部使用
 */

module.exports = {
  apps: [{
    // 應用程式基本設定
    name: 'internal-email-server',
    script: 'internal-email-server.js',

    // 實例設定
    instances: 1,
    exec_mode: 'fork', // 使用fork模式，適合內網單實例

    // 資源限制
    max_memory_restart: '500M', // 記憶體超過500MB自動重啟
    min_uptime: '10s', // 最小運行時間10秒
    max_restarts: 10, // 最大重啟次數

    // 環境變數
    env: {
      NODE_ENV: 'internal',
      FORCE_INTERNAL_SMTP: 'true',
      INTERNAL_PORT: 3001,
      INTERNAL_SMTP_HOST: 'ex2016.jih-sun.com.tw',
      INTERNAL_SMTP_FROM: 'system@company.local'
    },

    // 開發環境設定
    env_development: {
      NODE_ENV: 'development',
      FORCE_INTERNAL_SMTP: 'true',
      INTERNAL_PORT: 3001,
      DEBUG: 'internal:*'
    },

    // 日誌設定
    log_file: './logs/internal-server-combined.log',
    out_file: './logs/internal-server-out.log',
    error_file: './logs/internal-server-error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,

    // 自動重啟設定
    watch: false, // 內網環境不監控檔案變更
    ignore_watch: ['node_modules', 'logs', '*.md'],

    // 進程管理設定
    autorestart: true,
    kill_timeout: 5000, // 5秒後強制終止
    listen_timeout: 3000, // 3秒啟動超時
    shutdown_with_message: true,

    // 健康檢查
    health_check_grace_period: 3000, // 健康檢查寬限期3秒

    // Windows特定設定
    windowsHide: false, // 顯示控制台視窗

    // 自訂選項
    source_map_support: false,
    disable_source_map_support: true
  }],

  // 部署設定（內網專用）
  deploy: {
    internal: {
      user: 'administrator',
      host: 'localhost',
      ref: 'origin/main',
      repo: 'internal-repository',
      path: process.cwd(),
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env internal'
    }
  },

  // PM2 Plus 監控設定（內網禁用）
  pmx: false,

  // 全域設定
  daemon: true, // 以daemon模式運行
  silent: false, // 顯示日誌輸出

  // 內網安全設定
  metadata: {
    description: '內網輔助郵件伺服器 - 企業SMTP專用',
    version: '1.0.0',
    author: 'IT部門',
    confidentiality: '內部使用',
    created: '2025-09-19',
    timezone: 'Asia/Taipei'
  }
};