/** @type {{apps: import('pm2').StartOptions[]}} */
module.exports = {
  apps: [
    {
      name: "worker",
      script: "./dist/index.js",
      args: ["consumer-1", "consumer-2"],
      env: {
        NODE_ENV: "development",
      },
      env_production: {
        NODE_ENV: "production",
      },
    },
  ],
};
