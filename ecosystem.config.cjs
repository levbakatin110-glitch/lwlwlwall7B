/**
 * PM2 cluster: несколько Node-процессов, общая очередь/квота через SQLite.
 * instances: из CHAT_PM2_INSTANCES или 2 (не «max» — иначе упрётесь в RAM/API).
 */
module.exports = {
  apps: [
    {
      name: "maya",
      cwd: "/var/www/maya",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      instances: Number(process.env.CHAT_PM2_INSTANCES) || 2,
      exec_mode: "cluster",
      max_memory_restart: "700M",
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || "3000",
        CHAT_MAX_CONCURRENT: process.env.CHAT_MAX_CONCURRENT || "50",
        CHAT_MAX_WAITING: process.env.CHAT_MAX_WAITING || "120",
        CHAT_QUEUE_WAIT_MS: process.env.CHAT_QUEUE_WAIT_MS || "60000",
      },
    },
  ],
};
