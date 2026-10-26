import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { Connection } from "mongoose";
import { alertMetrics, defaultAlertSettings, type AlertSettings } from "@climasense/shared";
import { createHash } from "node:crypto";
import { detect, Observation } from "./alert-engine";
interface SettingsRow extends AlertSettings { _id: string; effectiveAt: Date }
interface Sample extends Observation { _id: string; deviceId: string; receivedAt: Date; alertEvaluated?: boolean }
interface AlertRow { _id: string; deviceId: string; metric: string; reason: string; severity: string; title: string; message: string; createdAt: Date; read: boolean; [key: string]: unknown }
@Injectable()
export class AlertsService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setTimeout>;
  private stopped = false;
  private readonly logger = new Logger(AlertsService.name);
  constructor(@InjectConnection() private readonly connection: Connection) {}
  private get settings() { return this.connection.db!.collection<SettingsRow>("alert_settings"); }
  private get alerts() { return this.connection.db!.collection<AlertRow>("environment_alerts"); }
  private get samples() { return this.connection.db!.collection<Sample>("firebase_readings"); }
  async getSettings() {
    await this.settings.updateOne({ _id: "global" }, { $setOnInsert: { ...defaultAlertSettings(), effectiveAt: new Date() } }, { upsert: true });
    return (await this.settings.findOne({ _id: "global" }))!;
  }
  async saveSettings(settings: AlertSettings) {
    if (new Set(settings.rules.map(rule => rule.metric)).size !== alertMetrics.length) throw new BadRequestException("Mỗi thông số cần đúng một quy tắc.");
    for (const rule of settings.rules) {
      for (const key of ["lower", "upper", "rise", "fall"] as const) rule[key] ??= null;
      if (rule.lower !== null && rule.upper !== null && rule.lower >= rule.upper) throw new BadRequestException("Ngưỡng thấp phải nhỏ hơn ngưỡng cao.");
      if (rule.enabled && [rule.lower, rule.upper, rule.rise, rule.fall].every(value => value === null)) throw new BadRequestException("Quy tắc đang bật cần ít nhất một ngưỡng.");
    }
    await this.settings.updateOne({ _id: "global" }, { $set: { rules: settings.rules, effectiveAt: new Date() } }, { upsert: true });
    return { rules: settings.rules };
  }
  async findAll() {
    const rows = await this.alerts.find().sort({ createdAt: -1, _id: -1 }).limit(200).toArray();
    return rows.map(({ _id, ...row }) => ({ ...row, id: _id }));
  }
  async markRead(id: string) {
    const result = await this.alerts.updateOne({ _id: id }, { $set: { read: true } });
    if (!result.matchedCount) throw new NotFoundException("Không tìm thấy cảnh báo.");
    return { id, read: true };
  }
  onModuleInit() { void this.run(); }
  async processBatch() {
    const config = await this.getSettings();
    const rows = await this.samples.find({ receivedAt: { $gte: config.effectiveAt }, alertEvaluated: { $ne: true } }).sort({ receivedAt: 1, _id: 1 }).limit(100).toArray();
    const window = Math.max(...config.rules.map(rule => rule.windowSeconds));
    for (const row of rows) {
      const previous = await this.samples.find({ deviceId: row.deviceId, receivedAt: { $gte: new Date(row.receivedAt.getTime() - window * 1000), $lt: row.receivedAt } }).sort({ receivedAt: 1 }).toArray();
      for (const rule of config.rules) {
        for (const trigger of detect(rule, row, previous)) {
          const id = createHash("sha256").update(`${row._id}:${rule.metric}:${trigger.reason}`).digest("hex");
          const recent = await this.alerts.findOne({ deviceId: row.deviceId, metric: rule.metric, reason: trigger.reason, createdAt: { $gte: new Date(row.receivedAt.getTime() - rule.cooldownSeconds * 1000), $lte: row.receivedAt } });
          if (recent) continue;
          const descriptor = alertMetrics.find(metric => metric.key === rule.metric)!;
          const action = { low: "thấp hơn ngưỡng", high: "cao hơn ngưỡng", rise: "tăng nhanh", fall: "giảm nhanh" }[trigger.reason];
          const number = (value: number) => Number(value.toFixed(2)).toLocaleString("vi-VN");
          const message = trigger.baseline === undefined
            ? `${row.deviceId}: ${number(trigger.value)} ${descriptor.unit}; ngưỡng ${number(trigger.threshold)} ${descriptor.unit}.`
            : `${row.deviceId}: từ ${number(trigger.baseline)} ${trigger.reason === "rise" ? "lên" : "xuống"} ${number(trigger.value)} ${descriptor.unit} trong ${number(trigger.elapsedSeconds!)} giây; mức biến động cấu hình ${number(trigger.threshold)} ${descriptor.unit} / ${rule.windowSeconds} giây.`;
          await this.alerts.updateOne({ _id: id }, { $setOnInsert: { deviceId: row.deviceId, metric: rule.metric, severity: trigger.reason === "high" || trigger.reason === "low" ? "critical" : "warning", title: `${descriptor.label} ${action}`, message, ...trigger, createdAt: row.receivedAt, read: false, sampleId: row._id, windowSeconds: rule.windowSeconds, timeBasis: "backend_received" } }, { upsert: true });
        }
      }
      await this.samples.updateOne({ _id: row._id }, { $set: { alertEvaluated: true } });
    }
  }
  private async run() {
    try {
      await this.alerts.createIndex({ deviceId: 1, metric: 1, reason: 1, createdAt: -1 });
      await this.samples.createIndex({ alertEvaluated: 1, receivedAt: 1 });
      await this.processBatch();
    } catch { this.logger.warn("Chưa xử lý được cảnh báo; sẽ thử lại."); }
    finally { if (!this.stopped) this.timer = setTimeout(() => void this.run(), 2000); }
  }
  onModuleDestroy() { this.stopped = true; clearTimeout(this.timer); }
}
