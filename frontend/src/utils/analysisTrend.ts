export interface AnalysisPoint { timestamp: number; value: number | null }
export type TimeWindow = [number, number];

export function zoomWindow(current: TimeWindow, bounds: TimeWindow, factor: number, anchor = 0.5): TimeWindow {
  const width = Math.min(bounds[1] - bounds[0], Math.max(60000, (current[1] - current[0]) * factor));
  const start = Math.max(bounds[0], Math.min(bounds[1] - width, current[0] + (current[1] - current[0] - width) * anchor));
  return [start, start + width];
}

// Equal weight per occupied five-minute interval avoids overweighting bursts of samples.
export function analyzeTrend(points: AnalysisPoint[]) {
  const buckets = new Map<number, { sum: number; count: number }>();
  for (const point of points) {
    if (point.value === null || !Number.isFinite(point.value) || !Number.isFinite(point.timestamp)) continue;
    const time = Math.floor(point.timestamp / 300000) * 300000;
    const bucket = buckets.get(time) ?? { sum: 0, count: 0 };
    bucket.sum += point.value;
    bucket.count++;
    buckets.set(time, bucket);
  }
  const samples = [...buckets].sort(([a], [b]) => a - b).map(([timestamp, b]) => ({ timestamp, value: b.sum / b.count }));
  if (samples.length < 3) return null;
  const first = samples[0].timestamp;
  const last = samples[samples.length - 1].timestamp;
  const coverage = samples.length / (1 + (last - first) / 300000);
  const meanX = samples.reduce((s, p) => s + (p.timestamp - first) / 3600000, 0) / samples.length;
  const meanY = samples.reduce((s, p) => s + p.value, 0) / samples.length;
  let xx = 0, xy = 0, yy = 0;
  for (const p of samples) {
    const x = (p.timestamp - first) / 3600000 - meanX;
    const y = p.value - meanY;
    xx += x * x; xy += x * y; yy += y * y;
  }
  const slope = xy / xx;
  const r2 = yy === 0 ? 1 : Math.max(0, Math.min(1, xy * xy / (xx * yy)));
  const change = slope * (last - first) / 3600000;
  const label = coverage < 0.5 ? "Dữ liệu gián đoạn" : yy === 0 ? "Không đổi" : r2 < 0.3 ? "Chưa rõ xu hướng tuyến tính" : slope > 0 ? "Có xu hướng tăng" : "Có xu hướng giảm";
  return { slope, change, r2, coverage, label, buckets: samples.length };
}
