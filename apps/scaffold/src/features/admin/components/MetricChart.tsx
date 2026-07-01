import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface MetricChartProps {
  data: Array<{ date: string; value: number }>;
  title?: string;
}

export function MetricChart({ data, title }: MetricChartProps) {
  return (
    <div className="rounded-lg border p-4">
      {title && <h3 className="mb-4 text-sm font-medium">{title}</h3>}
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke="hsl(142 76% 36%)" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
