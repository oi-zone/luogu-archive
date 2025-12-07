/** @type {{apps: import('pm2').StartOptions[]}} */
module.exports = {
  apps: [
    {
      name: "worker",
      script: "./dist/index.js",
      env: {
        NODE_ENV: "development",
      },
      env_production: {
        NODE_ENV: "production",
      },
    },
  ],
};
