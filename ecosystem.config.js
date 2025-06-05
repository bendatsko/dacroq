module.exports = {
  apps: [
    // =============================================================================
    // DATA API - Database operations, authentication, test result storage
    // =============================================================================
    {
      name: 'data-api',
      cwd: './web/data/api',
      script: 'app.py',
      interpreter: 'python3',
      args: '--port 8001',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        PYTHONPATH: './web/data/api',
        FLASK_ENV: 'development',
        PORT: 8001
      },
      error_file: './logs/data-api-error.log',
      out_file: './logs/data-api-out.log',
      log_file: './logs/data-api.log',
      time: true
    },

    // =============================================================================
    // HARDWARE API - Physical device control, GPIO, firmware management  
    // NOTE: Hardware API runs on separate Raspberry Pi lab server (port 8000)
    // =============================================================================
    // {
    //   name: 'hardware-api',
    //   cwd: '/var/www/dacroq/hardware',
    //   script: 'app.py',
    //   interpreter: 'python3',
    //   args: '--port 8000',
    //   instances: 1,
    //   autorestart: true,
    //   watch: false,
    //   max_memory_restart: '512M',
    //   env: {
    //     PYTHONPATH: '/var/www/dacroq/hardware',
    //     FLASK_ENV: 'production',
    //     PORT: 8000
    //   },
    //   error_file: '/home/bdatsko/.pm2/logs/hardware-api-error.log',
    //   out_file: '/home/bdatsko/.pm2/logs/hardware-api-out.log',
    //   log_file: '/home/bdatsko/.pm2/logs/hardware-api.log',
    //   time: true
    // },

    // =============================================================================
    // WEB FRONTEND - Production mode (optimized build)
    // =============================================================================
    {
      name: 'web-prod',
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
        NEXT_PUBLIC_API_BASE_URL: 'https://dacroq.eecs.umich.edu',
        PATH: '/home/bdatsko/.npm-global/bin:/usr/local/bin:/usr/bin:/bin'
      },
      error_file: '/home/bdatsko/.pm2/logs/web-prod-error.log',
      out_file: '/home/bdatsko/.pm2/logs/web-prod-out.log',
      log_file: '/home/bdatsko/.pm2/logs/web-prod.log',
      time: true
    },

    // =============================================================================
    // WEB FRONTEND - Development mode (hot reloading)
    // =============================================================================
    {
      name: 'web-dev',
      cwd: './web',
      script: 'npm',
      args: 'run dev',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 3001,  // Different port to avoid conflicts
        NEXT_PUBLIC_API_BASE_URL: 'http://localhost:8001',
        PATH: process.env.PATH
      },
      error_file: './logs/web-dev-error.log',
      out_file: './logs/web-dev-out.log',
      log_file: './logs/web-dev.log',
      time: true
    },

    // =============================================================================
    // WEBHOOK - GitHub deployment automation
    // =============================================================================
    {
      name: 'webhook',
      cwd: '/var/www/dacroq',
      script: 'webhook.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
        WEBHOOK_SECRET: 'dacroq-deployment-secret-2024'
      },
      error_file: '/home/bdatsko/.pm2/logs/webhook-error.log',
      out_file: '/home/bdatsko/.pm2/logs/webhook-out.log',
      log_file: '/home/bdatsko/.pm2/logs/webhook.log',
      time: true
    }
  ]
}; 