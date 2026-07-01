export function isProtectedPath(filePath: string, protectedPaths: string[]): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return protectedPaths.some((pattern) => {
    const p = pattern.replace(/\\/g, "/");
    if (p.endsWith("/**")) {
      const prefix = p.slice(0, -3);
      return normalized.startsWith(prefix);
    }
    if (p.includes("*")) {
      const regex = new RegExp(`^${p.replace(/\*/g, ".*")}$`);
      return regex.test(normalized);
    }
    return normalized === p || normalized.startsWith(`${p}/`);
  });
}

export const DEFAULT_PROTECTED_PATHS = [
  "src/features/auth/AuthProvider.tsx",
  "src/features/auth/ProtectedRoute.tsx",
  "src/features/auth/hooks/useAuth.ts",
  "src/features/admin/AdminDashboard.tsx",
  "src/features/admin/hooks/**",
  "src/features/admin/components/MetricCard.tsx",
  "src/features/admin/components/MetricChart.tsx",
  "src/features/*/metrics.tab.ts",
  "src/integrations/supabase/client.ts",
  "supabase/functions/_shared/**",
  "supabase/functions/admin-metrics/**",
];
