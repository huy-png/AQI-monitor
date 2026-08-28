export function formatTime(value: string | null): string {
  if (!value) {
    return "Chưa có dữ liệu";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(value));
}

export function formatChartHour(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function aqiLabel(aqi: number): string {
  if (aqi <= 50) return "Tốt";
  if (aqi <= 100) return "Trung bình";
  if (aqi <= 150) return "Nhạy cảm";
  return "Kém";
}
