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
      QUEUE_PROCESS_MODE: "api",
      CAMPAIGN_DISPATCH_CONCURRENCY: "1",
      CAMPAIGN_DISPATCH_ATTEMPTS: "3",
      CAMPAIGN_DISPATCH_BACKOFF_MS: "60000",
      CAMPAIGN_MEMORY_WARN_MB: "700"
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
      QUEUE_PROCESS_MODE: "worker",
      CAMPAIGN_PROCESS_CONCURRENCY: "1",
      CAMPAIGN_PREPARE_CONCURRENCY: "2",
      CAMPAIGN_CONTACT_BATCH_SIZE: "500",
      CAMPAIGN_FINALIZE_DEBOUNCE_MS: "30000",
      CAMPAIGN_DISPATCH_ATTEMPTS: "3",
      CAMPAIGN_DISPATCH_BACKOFF_MS: "60000",
      CAMPAIGN_MEMORY_WARN_MB: "450",
      CAMPAIGN_SHIPPING_RETENTION_DAYS: "90",
      CAMPAIGN_CLEANUP_BATCH_SIZE: "100",
      CAMPAIGN_RECONCILE_STALE_MINUTES: "30",
      CAMPAIGN_RECONCILE_BATCH_SIZE: "50"
    }
  }
];
