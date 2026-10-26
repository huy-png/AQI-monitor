import type { ClimateReading } from "@climasense/shared";

export const pollutants = [
  {
    key: "so2",
    symbol: "SO₂",
    name: "Lưu huỳnh dioxide",
    group: "Khí",
    color: "#0891b2",
  },
  {
    key: "co",
    symbol: "CO",
    name: "Carbon monoxide",
    group: "Khí",
    color: "#0284c7",
  },
  {
    key: "no2",
    symbol: "NO₂",
    name: "Nitơ dioxide",
    group: "Khí",
    color: "#7c3aed",
  },
  { key: "o3", symbol: "O₃", name: "Ozone", group: "Khí", color: "#0d9488" },
  {
    key: "tsp",
    symbol: "TSP",
    name: "Tổng bụi lơ lửng",
    group: "Bụi",
    color: "#b45309",
  },
  {
    key: "pm10",
    symbol: "PM10",
    name: "Bụi PM10",
    group: "Bụi",
    color: "#c2410c",
  },
  {
    key: "pm25",
    symbol: "PM2.5",
    name: "Bụi mịn PM2.5",
    group: "Bụi",
    color: "#be185d",
  },
] as const;
export type PollutantKey = (typeof pollutants)[number]["key"];
export const concentrationUnit = "µg/Nm³";
export function pollutantValue(
  reading: ClimateReading | null | undefined,
  key: PollutantKey,
): number | null {
  const value = reading?.[key];
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}
export function formatConcentration(value: number | null) {
  return value === null
    ? "—"
    : value.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
}
