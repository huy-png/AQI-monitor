import type { AlertRule } from "@climasense/shared";
export interface Observation { receivedAt: Date; [key: string]: unknown }
export interface Trigger { reason: "low" | "high" | "rise" | "fall"; value: number; baseline?: number; elapsedSeconds?: number; threshold: number }
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
export function detect(rule: AlertRule, current: Observation, previous: Observation[]): Trigger[] {
  const value = current[rule.metric];
  if (!rule.enabled || !finite(value)) return [];
  const result: Trigger[] = [];
  if (finite(rule.lower) && value < rule.lower) result.push({ reason: "low", value, threshold: rule.lower });
  if (finite(rule.upper) && value > rule.upper) result.push({ reason: "high", value, threshold: rule.upper });
  const baseline = previous.filter(row => finite(row[rule.metric]) && row.receivedAt.getTime() < current.receivedAt.getTime() && row.receivedAt.getTime() >= current.receivedAt.getTime() - rule.windowSeconds * 1000).sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime())[0];
  if (baseline) {
    const before = baseline[rule.metric] as number;
    const delta = value - before;
    const details = { value, baseline: before, elapsedSeconds: (current.receivedAt.getTime() - baseline.receivedAt.getTime()) / 1000 };
    if (finite(rule.rise) && delta >= rule.rise) result.push({ ...details, reason: "rise", threshold: rule.rise });
    if (finite(rule.fall) && -delta >= rule.fall) result.push({ ...details, reason: "fall", threshold: rule.fall });
  }
  return result;
}
