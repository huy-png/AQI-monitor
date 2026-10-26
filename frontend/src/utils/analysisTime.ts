export const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";
const HOUR = 3600000;

export function vietnamDate(now = new Date()) {
  return new Date(now.getTime() + 7 * HOUR).toISOString().slice(0, 10);
}

export function analysisDayRange(day: string) {
  const start = Date.parse(`${day}T00:00:00+07:00`);
  return { start, end: start + 24 * HOUR, from: new Date(start).toISOString(), to: new Date(start + 24 * HOUR - 1).toISOString() };
}

export function dayPeriod(timestamp: number) {
  const hour = new Date(timestamp + 7 * HOUR).getUTCHours();
  return hour >= 6 && hour < 18 ? "Ban ngày" : "Ban đêm";
}
