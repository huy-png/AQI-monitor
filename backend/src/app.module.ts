import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { AlertsModule } from "./alerts/alerts.module";
import { DevicesModule } from "./devices/devices.module";
import { HealthModule } from "./health/health.module";
import { FirebaseModule } from "./firebase/firebase.module";
import { MqttModule } from "./mqtt/mqtt.module";
import { ReadingsModule } from "./readings/readings.module";
import { RealtimeModule } from "./realtime/realtime.module";
import "./config/runtime";
import { resolve } from "node:path";
import { PostgresStorageModule } from "./storage/storage.module";

const persistenceModule = MongooseModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    uri: config.get<string>("MONGODB_URI", "mongodb://localhost:27017/climasense"),
    serverSelectionTimeoutMS: 3000
  })
});

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: [resolve(__dirname, "../../.env"), ".env"] }),
    FirebaseModule,
    ...(process.env.STORAGE_DRIVER === "postgres" ? [PostgresStorageModule] : [persistenceModule]),
    RealtimeModule,
    DevicesModule,
    ReadingsModule,
    MqttModule,
    AlertsModule,
    HealthModule
  ]
})
export class AppModule {}
