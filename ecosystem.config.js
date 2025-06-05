module.exports = {
  apps: [
    {
      name: 'dacroq-web',
      cwd: '/var/www/dacroq/web',
      script: '/home/bdatsko/.npm-global/bin/pnpm',
      args: 'start',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        PATH: '/home/bdatsko/.npm-global/bin:/usr/local/bin:/usr/bin:/bin'
      },
      error_file: '/home/bdatsko/.pm2/logs/dacroq-web-error.log',
      out_file: '/home/bdatsko/.pm2/logs/dacroq-web-out.log',
      log_file: '/home/bdatsko/.pm2/logs/dacroq-web.log',
      time: true
    },
    {
      name: 'dacroq-webhook',
      cwd: '/var/www/dacroq',
      script: 'webhook.js',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        WEBHOOK_SECRET: 'dacroq-deployment-secret-2024'
      },
      error_file: '/home/bdatsko/.pm2/logs/dacroq-webhook-error.log',
      out_file: '/home/bdatsko/.pm2/logs/dacroq-webhook-out.log',
      log_file: '/home/bdatsko/.pm2/logs/dacroq-webhook.log',
      time: true
    }
  ]
}; 