import { describe, it, expect } from "@jest/globals";
import { detect } from "./alert-engine";
import type { AlertRule } from "@climasense/shared";
const rule: AlertRule = { metric: "temperature", enabled: true, lower: 0, upper: 40, rise: 5, fall: 5, windowSeconds: 60, cooldownSeconds: 300 };
const sample = (temperature: unknown, seconds: number) => ({ temperature, receivedAt: new Date(seconds * 1000) });
describe("Environmental anomaly detection", () => {
  it("detects a rise or fall at the configured delta within the time window", () => {
    expect(detect(rule, sample(25, 100), [sample(20, 50)]).map(item => item.reason)).toEqual(["rise"]);
    expect(detect(rule, sample(15, 100), [sample(20, 50)]).map(item => item.reason)).toEqual(["fall"]);
  });
  it("does not compare stale, simultaneous, future or missing samples", () => {
    expect(detect(rule, sample(25, 100), [sample(1, 39), sample(null, 50), sample(1, 100), sample(1, 110)])).toEqual([]);
    expect(detect(rule, sample(null, 100), [sample(20, 50)])).toEqual([]);
  });
  it("compares the oldest valid sample and includes the window boundary", () => {
    expect(detect(rule, sample(25, 100), [sample(24, 90), sample(20, 40)])[0].baseline).toBe(20);
  });
  it("detects absolute high/low without a baseline, permits zero and skips disabled rules", () => {
    expect(detect(rule, sample(41, 100), [])[0].reason).toBe("high");
    expect(detect(rule, sample(-1, 100), [])[0].reason).toBe("low");
    expect(detect(rule, sample(0, 100), [])).toEqual([]);
    expect(detect({ ...rule, enabled: false }, sample(100, 100), [])).toEqual([]);
  });
  it("treats empty thresholds as disabled, not zero", () => {
    expect(detect({ ...rule, lower: null, upper: null, rise: null, fall: null }, sample(100, 100), [sample(20, 50)])).toEqual([]);
  });
});
