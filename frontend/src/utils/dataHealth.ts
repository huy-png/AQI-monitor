export const monitoredFields = [
  { key: "temperature", label: "Nhiệt độ" }, { key: "humidity", label: "Độ ẩm" },
  { key: "pressure", label: "Áp suất" }, { key: "pm25", label: "PM2.5" }, { key: "pm10", label: "PM10" }
] as const;

export function assessDataHealth(reading: object | undefined, lastSeen: string, now: number, thresholdMinutes: number, verified: boolean) {
  const time = Date.parse(lastSeen);
  const age = now - time;
  const state = !verified || !reading || !Number.isFinite(age) || age < -60000
    ? "unknown" : age > thresholdMinutes * 60000 ? "stale" : "fresh";
  const fields = reading as Record<string, unknown> | undefined;
  const missing = monitoredFields.filter(({ key }) => {
    const value = fields?.[key];
    return typeof value !== "number" || !Number.isFinite(value)
      || (key !== "temperature" && value < 0) || (key === "humidity" && value > 100);
  });
  return { time, age, state, missing };
}

export function formatDataAge(age: number) {
  if (!Number.isFinite(age) || age < -60000) return "Thời gian chưa xác định";
  if (age < 60000) return "Dưới 1 phút trước";
  const minutes = Math.floor(age / 60000);
  if (minutes < 60) return `${minutes} phút trước`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} giờ ${minutes % 60} phút trước`;
  return `${Math.floor(minutes / 1440)} ngày ${Math.floor(minutes % 1440 / 60)} giờ trước`;
}
