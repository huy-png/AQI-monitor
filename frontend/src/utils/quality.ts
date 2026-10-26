import type { ClimateReading } from "@climasense/shared";
export type StoredReading = ClimateReading & { id?: string; receivedAt?: string; timestampSource?: string };
export const qualityMetrics = [
  { key: "temperature", label: "Nhiệt độ" }, { key: "humidity", label: "Độ ẩm" },
  { key: "pressure", label: "Áp suất" }, { key: "pm25", label: "PM2.5" }, { key: "pm10", label: "PM10" },
] as const;
export type QualityMetric = typeof qualityMetrics[number]["key"];
export function valueQuality(value: unknown, key: QualityMetric): "valid" | "missing" | "invalid" {
  if (value === null || value === undefined) return "missing";
  if (typeof value !== "number" || !Number.isFinite(value) || (key !== "temperature" && value < 0) || (key === "humidity" && value > 100)) return "invalid";
  return "valid";
}
export function summarizeQuality(rows: StoredReading[], start: number, end: number, now: number) {
  const relevant = rows.filter(row => { const time = Date.parse(row.timestamp); return time >= start && time < end && time <= now; });
  const buckets = Array.from({ length: Math.ceil((end - start) / 300000) }, (_, index) => ({
    start: start + index * 300000, end: Math.min(end, start + (index + 1) * 300000), total: 0, incomplete: 0,
  }));
  let complete = 0;
  const metrics = qualityMetrics.map(metric => ({ ...metric, valid: 0, missing: 0, invalid: 0 }));
  for (const row of relevant) {
    let valid = true;
    for (const metric of metrics) {
      const state = valueQuality(row[metric.key], metric.key);
      metric[state]++;
      if (state !== "valid") valid = false;
    }
    if (valid) complete++;
    const bucket = buckets[Math.floor((Date.parse(row.timestamp) - start) / 300000)];
    bucket.total++;
    if (!valid) bucket.incomplete++;
  }
  const elapsed = buckets.filter(bucket => bucket.end <= now);
  return { metrics, buckets, complete, total: relevant.length, covered: elapsed.filter(bucket => bucket.total > 0).length, elapsed: elapsed.length };
}
