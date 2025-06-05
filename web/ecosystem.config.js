module.exports = {
  apps: [
    {
      name: 'dacroq-web',
      script: 'pnpm',
      args: 'start',
      cwd: '/var/www/dacroq/web',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      log_file: '/var/log/dacroq-web.log',
      out_file: '/var/log/dacroq-web-out.log',
      error_file: '/var/log/dacroq-web-error.log',
      time: true
    },
    {
      name: 'dacroq-webhook',
      script: '/var/www/dacroq/webhook.js',
      cwd: '/var/www/dacroq',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        WEBHOOK_SECRET: 'dacroq-deployment-secret-2024'
      },
      log_file: '/var/log/dacroq-webhook.log',
      out_file: '/var/log/dacroq-webhook-out.log',
      error_file: '/var/log/dacroq-webhook-error.log',
      time: true
    }
  ]
}; 