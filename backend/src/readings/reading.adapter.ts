import { BadRequestException, Injectable } from "@nestjs/common";
import type { ClimateReading } from "@climasense/shared";

type RawReading = Record<string, unknown>;
const TIMESTAMP_KEYS = ["timestampiso", "timestampIso", "timestampISO", "timestamp_iso", "timestamp", "time", "ts"];

@Injectable()
export class ReadingAdapter {
  normalize(raw: RawReading, deviceIdFromTopic?: string): ClimateReading {
    const deviceId = this.readString(raw, ["nodeId", "node_id", "deviceId", "device_id", "id"]) ?? deviceIdFromTopic;
    const timestamp = this.readString(raw, TIMESTAMP_KEYS) ?? new Date().toISOString();

    const reading: ClimateReading = {
      deviceId: deviceId ?? "",
      timestamp,
      temperature: this.readNumber(raw, ["temperature", "temperature_c", "temp", "t"]),
      humidity: this.readNumber(raw, ["humidity", "humidity_pct", "hum", "h"]),
      pressure: this.readNumber(raw, ["pressure", "pressure_hpa", "p"]),
      airQuality: this.readNumber(raw, ["airQuality", "air_quality", "aqi"]),
      rainfall: this.readNumber(raw, ["rainfall", "rain_mm", "rain"]),
      windSpeed: this.readNumber(raw, ["windSpeed", "wind_speed", "wind_kmh", "wind"])
    };

    this.assertValid(reading);
    return reading;
  }

  private readString(raw: RawReading, keys: string[]): string | undefined {
    for (const key of keys) {
      const value = raw[key];
      if (typeof value === "string" && value.trim().length > 0) return value;
    }
    return undefined;
  }

  private readNumber(raw: RawReading, keys: string[]): number {
    for (const key of keys) {
      const value = raw[key];
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
    }
    throw new BadRequestException(`Missing numeric field: ${keys.join("/")}`);
  }

  private assertValid(reading: ClimateReading) {
    if (!reading.deviceId) throw new BadRequestException("Missing deviceId");
    if (!Number.isFinite(Date.parse(reading.timestamp))) throw new BadRequestException("Invalid timestamp");
    if (reading.humidity < 0 || reading.humidity > 100) throw new BadRequestException("Humidity out of range");
    if (reading.pressure < 850 || reading.pressure > 1100) throw new BadRequestException("Pressure out of range");
    if (reading.rainfall < 0 || reading.windSpeed < 0 || reading.airQuality < 0) {
      throw new BadRequestException("Climate reading contains negative value");
    }
  }
}
