import { isModuleSource } from "../config/data-source";
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ModuleRef } from "@nestjs/core";
import mqtt, { MqttClient } from "mqtt";
import type { DeviceCommand } from "@climasense/shared";
import { ReadingAdapter } from "../readings/reading.adapter";
import { ReadingsService } from "../readings/readings.service";

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);
  private client?: MqttClient;
  private connected = false;
  private readingsService?: ReadingsService;
  private readingAdapter?: ReadingAdapter;

  constructor(
    private readonly config: ConfigService,
    private readonly moduleRef: ModuleRef
  ) {}

  onModuleInit() {
    if (isModuleSource(this.config.get<string>("DATA_SOURCE", "mongodb"))) {
      this.logger.log("Module data source enabled; MQTT bridge is disabled.");
      return;
    }
    this.readingsService = this.moduleRef.get(ReadingsService, { strict: false });
    this.readingAdapter = this.moduleRef.get(ReadingAdapter, { strict: false });
    this.connect();
  }

  onModuleDestroy() {
    this.client?.end(true);
  }

  isConnected(): boolean {
    return this.connected;
  }

  async publishCommand(deviceId: string, command: DeviceCommand) {
    const topic = `climasense/devices/${deviceId}/commands`;
    const payload = JSON.stringify(command);

    if (!this.client || !this.connected) {
      this.logger.warn(`MQTT unavailable, command not published: ${topic}`);
      return { accepted: false, topic };
    }

    await new Promise<void>((resolve, reject) => {
      this.client?.publish(topic, payload, { qos: 1 }, (error) => (error ? reject(error) : resolve()));
    });
    return { accepted: true, topic };
  }

  private connect() {
    const url = this.config.get<string>("MQTT_URL", "mqtt://localhost:1883");
    const username = this.config.get<string>("MQTT_USERNAME");
    const password = this.config.get<string>("MQTT_PASSWORD");

    this.client = mqtt.connect(url, {
      username: username || undefined,
      password: password || undefined,
      reconnectPeriod: 3000
    });

    this.client.on("connect", () => {
      this.connected = true;
      this.logger.log(`Connected to MQTT broker ${url}`);
      this.client?.subscribe(["climasense/devices/+/readings", "climasense/devices/+/status"], { qos: 1 });
    });

    this.client.on("reconnect", () => this.logger.log("Reconnecting to MQTT broker"));
    this.client.on("close", () => {
      this.connected = false;
      this.logger.warn("MQTT connection closed");
    });
    this.client.on("error", (error) => this.logger.error(`MQTT error: ${error.message}`));
    this.client.on("message", (topic, payload) => void this.handleMessage(topic, payload));
  }

  private async handleMessage(topic: string, payload: Buffer) {
    try {
      const [, , deviceId, eventName] = topic.split("/");
      if (eventName !== "readings") {
        this.logger.log(`MQTT status message from ${deviceId}: ${payload.toString("utf8")}`);
        return;
      }

      const parsed = JSON.parse(payload.toString("utf8")) as Record<string, unknown>;
      const reading = this.readingAdapter?.normalize(parsed, deviceId);
      if (!reading) throw new Error("Reading adapter unavailable");

      await this.readingsService?.create(reading);
      this.logger.log(`Stored MQTT reading from ${reading.deviceId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown MQTT payload error";
      this.logger.warn(`Invalid MQTT payload on ${topic}: ${message}`);
    }
  }
}
