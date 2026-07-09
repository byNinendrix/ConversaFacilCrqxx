module.exports = [
  {
    script: "dist/server.js",
    name: "beta-back",
    exec_mode: "fork",
    cron_restart: "05 00 * * *",
    max_memory_restart: "769M",
    node_args: "--max-old-space-size=769",
    watch: false,
    env: {
      QUEUE_PROCESS_MODE: "api"
    }
  },
  {
    script: "dist/worker.js",
    name: "beta-campaign-worker",
    exec_mode: "fork",
    cron_restart: "10 00 * * *",
    max_memory_restart: "512M",
    node_args: "--max-old-space-size=512",
    watch: false,
    env: {
      QUEUE_PROCESS_MODE: "worker"
    }
  }
];
