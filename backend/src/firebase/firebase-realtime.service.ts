import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ClimateReading, Device } from "@climasense/shared";

type FirebaseObject = Record<string, unknown>;
const TIMESTAMP_KEYS = ["timestampiso", "timestampIso", "timestampISO", "timestamp_iso", "timestamp", "time", "ts", "updatedAt", "updated_at"];

@Injectable()
export class FirebaseRealtimeService {
  private readonly logger = new Logger(FirebaseRealtimeService.name);

  constructor(private readonly config: ConfigService) {}

  async getLatest(deviceId?: string): Promise<ClimateReading> {
    const selectedDeviceId = deviceId ?? (await this.getDeviceIds())[0];
    if (!selectedDeviceId) throw new ServiceUnavailableException("No Firebase devices found");
    return this.normalizeReading(await this.read(`devices/${selectedDeviceId}/latest`), selectedDeviceId);
  }

  async getHistory(deviceId: string): Promise<ClimateReading[]> {
    const value = await this.read(`devices/${deviceId}/history`, true);
    if (!value) return [await this.getLatest(deviceId)];
    const entries = Array.isArray(value) ? value : Object.values(value as FirebaseObject);
    return entries
      .filter((item): item is FirebaseObject => Boolean(item && typeof item === "object"))
      .map((item) => this.normalizeReading(item, deviceId))
      .sort((first, second) => Date.parse(first.timestamp) - Date.parse(second.timestamp));
  }

  async findDevices(): Promise<Device[]> {
    const value = await this.read("devices");
    if (!value || typeof value !== "object") return [];
    return Object.entries(value as FirebaseObject).map(([deviceId, raw]) => {
      const device = this.asObject(raw) ?? {};
      const latest = this.asObject(device.latest) ?? device;
      return {
        deviceId,
        name: this.readString(device, ["name", "nodeId"], deviceId),
        location: this.readString(device, ["location"], "Chưa xác định"),
        status: "online",
        lastSeen: this.readTimestamp(latest),
        firmwareVersion: this.readString(device, ["firmwareVersion", "firmware_version"], "") || undefined
      };
    });
  }

  private async read(path: string, optional = false): Promise<unknown> {
    const baseUrl = this.config.get<string>("FIREBASE_DATABASE_URL");
    if (!baseUrl) throw new ServiceUnavailableException("FIREBASE_DATABASE_URL is not configured");
    const auth = this.config.get<string>("FIREBASE_DATABASE_AUTH");
    const query = auth ? `?auth=${encodeURIComponent(auth)}` : "";
    const url = `${baseUrl.replace(/\/$/, "")}/${path.split("/").map(encodeURIComponent).join("/")}.json${query}`;
    let response: Response;
    try {
      response = await fetch(url);
    } catch (error) {
      const detail = error instanceof Error ? `: ${error.message}` : "";
      throw new ServiceUnavailableException(`Cannot connect to Firebase at ${path}${detail}`);
    }
    if (!response.ok) {
      const message = `Firebase ${response.status} while reading ${path}`;
      this.logger.error(message);
      if (optional && response.status === 404) return null;
      throw new ServiceUnavailableException(message);
    }
    return response.json();
  }

  private async getDeviceIds(): Promise<string[]> {
    const value = await this.read("devices");
    return value && typeof value === "object" ? Object.keys(value as FirebaseObject) : [];
  }

  private normalizeReading(value: unknown, deviceId: string): ClimateReading {
    const raw = this.asObject(value) ?? {};
    return {
      deviceId: this.readString(raw, ["nodeId", "deviceId", "device_id"], deviceId),
      timestamp: this.readTimestamp(raw),
      temperature: this.readNumber(raw, ["temperature", "temperature_c", "temp", "t"]),
      humidity: this.readNumber(raw, ["humidity", "humidity_pct", "hum", "h"]),
      pressure: this.readNumber(raw, ["pressure", "pressure_hpa", "p"], 1013),
      airQuality: this.readNumber(raw, ["airQuality", "air_quality", "aqi", "pm25", "pm2_5", "pm2.5", "pm_25"]),
      rainfall: this.readNumber(raw, ["rainfall", "rain_mm", "rain"], 0),
      windSpeed: this.readNumber(raw, ["windSpeed", "wind_speed", "wind_kmh", "wind"], 0),
      latitude: this.readNumber(raw, ["latitude", "lat"], Number.NaN),
      longitude: this.readNumber(raw, ["longitude", "lng", "lon"], Number.NaN)
    };
  }

  private asObject(value: unknown): FirebaseObject | null {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as FirebaseObject) : null;
  }

  private readString(raw: FirebaseObject, keys: string[], fallback: string): string {
    for (const key of keys) {
      const value = raw[key];
      if (typeof value === "string" && value.trim()) return value;
      if (typeof value === "number" && Number.isFinite(value)) return String(value);
    }
    return fallback;
  }

  private readNumber(raw: FirebaseObject, keys: string[], fallback = 0): number {
    for (const key of keys) {
      const value = raw[key];
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
    }
    return fallback;
  }

  private readTimestamp(raw: FirebaseObject): string {
    const value = TIMESTAMP_KEYS.map((key) => raw[key]).find((item) => item !== undefined && item !== null);
    if (typeof value === "number" && Number.isFinite(value)) {
      return new Date(value < 10_000_000_000 ? value * 1000 : value).toISOString();
    }
    if (typeof value === "string" && Number.isFinite(Date.parse(value))) return value;
    return new Date().toISOString();
  }
}
