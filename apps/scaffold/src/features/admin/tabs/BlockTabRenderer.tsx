import { MetricCard } from "../components/MetricCard";
import { MetricChart } from "../components/MetricChart";
import { useBlockMetrics } from "../hooks/useBlockMetrics";
import type { MetricsTab } from "../hooks/useEnabledBlockTabs";

export function BlockTabRenderer({ tab }: { tab: MetricsTab }) {
  const { data, loading, error } = useBlockMetrics(tab.queryEndpoint);

  if (loading) return <p>Loading metrics...</p>;
  if (error) return <p className="text-destructive">Error: {error}</p>;
  if (!data) return <p>No data available</p>;

  const metrics = data.metrics as Record<string, number> | undefined;
  const chartData = data.chart as Array<{ date: string; value: number }> | undefined;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {tab.metrics.map((m) => (
          <MetricCard key={m.key} label={m.label} value={metrics?.[m.key] ?? "—"} />
        ))}
      </div>
      {chartData && chartData.length > 0 && (
        <MetricChart data={chartData} title={`${tab.label} over time`} />
      )}
    </div>
  );
}
