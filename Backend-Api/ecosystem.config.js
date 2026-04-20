module.exports = {
  apps: [
    // ─── Main API Server ───────────────────────────────────────────────────
    {
      name: 'zely-api',
      script: './dist/index.js',
      instances: 1,        // one instance per CPU core
      exec_mode: 'fork',    // cluster mode for load balancing
      watch: false,            // never watch in production
      max_memory_restart: '500M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      // Graceful shutdown — wait for in-flight requests to complete
      kill_timeout: 10000,
      wait_ready: true,
      listen_timeout: 15000,
      // Restart policy
      restart_delay: 1000,
      max_restarts: 10,
      min_uptime: '10s',
      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      merge_logs: true,
    },
  ],
};