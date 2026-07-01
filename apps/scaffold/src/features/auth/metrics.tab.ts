export const authMetricsTab = {
  blockId: "auth",
  label: "Users",
  icon: "Users",
  metrics: [
    { key: "total_users", label: "Total users", type: "number", trend: "30d" },
    { key: "new_users_7d", label: "New (7d)", type: "number", trend: "7d" },
    { key: "dau", label: "Daily active", type: "number" },
    { key: "signup_growth_pct", label: "Growth", type: "percent", trend: "30d" },
  ],
  charts: [
    { key: "signups_over_time", type: "line", range: ["7d", "30d", "90d"] },
    { key: "auth_method_split", type: "pie" },
  ],
  queryEndpoint: "admin-metrics/auth",
};
