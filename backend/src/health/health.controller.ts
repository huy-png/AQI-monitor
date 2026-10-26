import { isModuleSource } from "../config/data-source";
import { Controller, Get, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectConnection } from "@nestjs/mongoose";
import { Connection } from "mongoose";
import { MqttService } from "../mqtt/mqtt.service";
import { PostgresStore } from "../storage/postgres-store";

@Controller("health")
export class HealthController {
  constructor(
    @Optional() @InjectConnection() private readonly connection: Connection | undefined,
    private readonly mqttService: MqttService,
    private readonly config: ConfigService
  ) {}

  @Get()
  async health() {
    const moduleMode = isModuleSource(this.config.get<string>("DATA_SOURCE", "mongodb"));
    const postgres = this.config.get<string>("STORAGE_DRIVER") === "postgres";
    let mongoConnected = this.connection?.readyState === 1;
    if (postgres) {
      try { await (this.connection as unknown as PostgresStore).ping(); mongoConnected = true; }
      catch { mongoConnected = false; }
    }
    const mqttConnected = this.mqttService.isConnected();

    return {
      status: mongoConnected && (moduleMode || mqttConnected) ? "ok" : "degraded",
      backend: "ok",
      database: postgres ? "postgres" : "mongodb",
      [postgres ? "postgresql" : "mongodb"]: mongoConnected ? "connected" : "disconnected",
      mqtt: mqttConnected ? "connected" : "disconnected",
      timestamp: new Date().toISOString()
    };
  }
}
