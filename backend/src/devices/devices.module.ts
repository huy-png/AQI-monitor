import { Module, forwardRef } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { MqttModule } from "../mqtt/mqtt.module";
import { DevicesController } from "./devices.controller";
import { DevicesService } from "./devices.service";
import { DeviceModel, DeviceSchema } from "./schemas/device.schema";
import { isFirebaseDataSource } from "../config/runtime";

@Module({
  imports: [
    ...(isFirebaseDataSource ? [] : [MongooseModule.forFeature([{ name: DeviceModel.name, schema: DeviceSchema }])]),
    forwardRef(() => MqttModule)
  ],
  controllers: [DevicesController],
  providers: [DevicesService],
  exports: [DevicesService]
})
export class DevicesModule {}
