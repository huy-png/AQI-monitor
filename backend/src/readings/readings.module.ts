import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { DevicesModule } from "../devices/devices.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { ReadingAdapter } from "./reading.adapter";
import { ReadingsController } from "./readings.controller";
import { ReadingsService } from "./readings.service";
import { ReadingModel, ReadingSchema } from "./schemas/reading.schema";
import { isFirebaseDataSource } from "../config/runtime";

@Module({
  imports: [
    ...(isFirebaseDataSource ? [] : [MongooseModule.forFeature([{ name: ReadingModel.name, schema: ReadingSchema }])]),
    DevicesModule,
    RealtimeModule
  ],
  controllers: [ReadingsController],
  providers: [ReadingsService, ReadingAdapter],
  exports: [ReadingsService, ReadingAdapter]
})
export class ReadingsModule {}
