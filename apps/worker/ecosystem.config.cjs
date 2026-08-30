/** @type {{apps: import('pm2').StartOptions[]}} */
module.exports = {
  apps: [
    {
      name: "worker",
      cwd: __dirname,
      script: "./dist/index.js",
      kill_timeout: 60000,
      listen_timeout: 10000,
      exp_backoff_restart_delay: 100,
      max_memory_restart: "1G",
      min_uptime: 10000,
      env: {
        NODE_ENV: "development",
      },
      env_production: {
        NODE_ENV: "production",
      },
    },
  ],
};
