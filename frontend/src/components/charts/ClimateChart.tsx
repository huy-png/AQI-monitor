import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { ClimateReading } from "@climasense/shared";
import { formatChartHour } from "../../utils/format";

interface ClimateChartProps {
  data: ClimateReading[];
  range: "24h" | "7d" | "30d";
  onRangeChange: (range: "24h" | "7d" | "30d") => void;
}

export function ClimateChart({ data, range, onRangeChange }: ClimateChartProps) {
  return (
    <section className="glass-card p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-lg font-bold">24 giờ qua</p>
          <h2 className="text-xl font-semibold">Nhiệt độ & độ ẩm</h2>
        </div>
        <label className="text-muted flex items-center gap-2 text-sm">
          <span className="sr-only">Bộ lọc thời gian</span>
          <select
            className="glass-select rounded-lg px-3 py-2"
            value={range}
            onChange={(event) => onRangeChange(event.target.value as "24h" | "7d" | "30d")}
          >
            <option value="24h">24 giờ</option>
            <option value="7d">7 ngày</option>
            <option value="30d">30 ngày</option>
          </select>
        </label>
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 18, left: 0, bottom: 10 }}>
            <CartesianGrid stroke="var(--chart-grid)" />
            <XAxis dataKey="timestamp" tickFormatter={formatChartHour} stroke="var(--text-muted)" minTickGap={24} />
            <YAxis yAxisId="temperature" stroke="var(--text-muted)" unit="°" domain={["dataMin - 2", "dataMax + 2"]} />
            <YAxis yAxisId="humidity" orientation="right" stroke="var(--text-muted)" unit="%" domain={[0, 100]} />
            <Tooltip
              contentStyle={{
                background: "var(--tooltip-bg)",
                border: "1px solid var(--glass-border)",
                borderRadius: 8,
                color: "var(--text-primary)",
                backdropFilter: "blur(18px)"
              }}
              labelFormatter={(value) => formatChartHour(String(value))}
            />
            <Legend />
            <Line
              yAxisId="temperature"
              type="monotone"
              dataKey="temperature"
              name="Nhiệt độ (°C)"
              stroke="#19c7f3"
              strokeWidth={3}
              dot={{ r: 3 }}
              activeDot={{ r: 6 }}
            />
            <Line
              yAxisId="humidity"
              type="monotone"
              dataKey="humidity"
              name="Độ ẩm (%)"
              stroke="#a7f131"
              strokeWidth={3}
              dot={{ r: 3 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
