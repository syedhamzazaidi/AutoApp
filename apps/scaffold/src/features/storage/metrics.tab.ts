export const storageMetricsTab = {
  blockId: "storage",
  label: "Storage",
  icon: "HardDrive",
  metrics: [
    { key: "total_files", label: "Total files", type: "number" },
    { key: "storage_used_mb", label: "Storage used (MB)", type: "number" },
    { key: "uploads_7d", label: "Uploads (7d)", type: "number", trend: "7d" },
  ],
  charts: [{ key: "uploads_over_time", type: "line", range: ["7d", "30d"] }],
  queryEndpoint: "admin-metrics/storage",
};
