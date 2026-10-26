import type { ClimateReading } from "@climasense/shared";
import { concentrationUnit, pollutants } from "./pollutants";

export const metrics = [
  ...pollutants.map((item) => ({ ...item, unit: concentrationUnit })),
  {
    key: "temperature",
    symbol: "Nhiệt độ",
    name: "Nhiệt độ không khí",
    group: "Khí tượng",
    color: "#ea580c",
    unit: "°C",
  },
  {
    key: "humidity",
    symbol: "Độ ẩm",
    name: "Độ ẩm tương đối",
    group: "Khí tượng",
    color: "#0284c7",
    unit: "%",
  },
  {
    key: "pressure",
    symbol: "Áp suất",
    name: "Áp suất khí quyển",
    group: "Khí tượng",
    color: "#7c3aed",
    unit: "hPa",
  },
] as const;
export type MetricKey = (typeof metrics)[number]["key"];
export type Metric = (typeof metrics)[number];

export function metricValue(
  reading: ClimateReading | null | undefined,
  key: MetricKey,
): number | null {
  const value = reading?.[key];
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (key !== "temperature" && value < 0) return null;
  if (key === "humidity" && value > 100) return null;
  return value;
}
