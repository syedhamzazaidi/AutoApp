export const aiMetricsTab = {
  blockId: "ai",
  label: "AI Usage",
  icon: "Sparkles",
  metrics: [
    { key: "requests_7d", label: "Requests (7d)", type: "number", trend: "7d" },
    { key: "requests_30d", label: "Requests (30d)", type: "number", trend: "30d" },
    { key: "total_tokens", label: "Total tokens", type: "number" },
    { key: "avg_latency_ms", label: "Avg latency (ms)", type: "number" },
  ],
  charts: [{ key: "ai_usage_over_time", type: "line", range: ["7d", "30d"] }],
  queryEndpoint: "admin-metrics/ai",
};
