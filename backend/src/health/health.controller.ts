import { Controller, Get, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectConnection } from "@nestjs/mongoose";
import { Connection } from "mongoose";
import { MqttService } from "../mqtt/mqtt.service";

@Controller("health")
export class HealthController {
  constructor(
    @Optional() @InjectConnection() private readonly connection: Connection | undefined,
    private readonly mqttService: MqttService,
    private readonly config: ConfigService
  ) {}

  @Get()
  health() {
    const firebaseMode = this.config.get<string>("DATA_SOURCE", "mongodb") === "firebase";
    const mongoConnected = this.connection?.readyState === 1;
    const mqttConnected = this.mqttService.isConnected();

    return {
      status: (firebaseMode || mongoConnected) && (firebaseMode || mqttConnected) ? "ok" : "degraded",
      backend: "ok",
      mongodb: firebaseMode ? "disabled" : mongoConnected ? "connected" : "disconnected",
      mqtt: mqttConnected ? "connected" : "disconnected",
      timestamp: new Date().toISOString()
    };
  }
}
