export const alertMetrics = [
  { key: "temperature", label: "Nhiệt độ", unit: "°C", delta: 5 },
  { key: "humidity", label: "Độ ẩm", unit: "%", delta: 20 },
  { key: "pressure", label: "Áp suất", unit: "hPa", delta: 10 },
  ...["pm1", "pm25", "pm10", "so2", "co", "no2", "o3", "tsp"].map(key => ({ key, label: ({ pm1: "PM1", pm25: "PM2.5", pm10: "PM10" } as Record<string, string>)[key] ?? key.toUpperCase(), unit: "µg/Nm³", delta: 25 }))
];
export interface AlertRule {
  metric: string;
  enabled: boolean;
  lower: number | null;
  upper: number | null;
  rise: number | null;
  fall: number | null;
  windowSeconds: number;
  cooldownSeconds: number;
}
export interface AlertSettings { rules: AlertRule[] }
export const defaultAlertSettings = (): AlertSettings => ({ rules: alertMetrics.map(metric => ({ metric: metric.key, enabled: true, lower: null, upper: null, rise: metric.delta, fall: metric.delta, windowSeconds: 300, cooldownSeconds: 600 })) });
