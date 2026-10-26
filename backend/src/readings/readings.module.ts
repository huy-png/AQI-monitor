import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { DevicesModule } from "../devices/devices.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { ReadingAdapter } from "./reading.adapter";
import { ReadingsController } from "./readings.controller";
import { ReadingsService } from "./readings.service";
import { ReadingModel, ReadingSchema } from "./schemas/reading.schema";
import { ArchiveService } from "./archive.service";
import { isModuleDataSource } from "../config/runtime";

@Module({
  imports: [
    ...(isModuleDataSource ? [] : [MongooseModule.forFeature([{ name: ReadingModel.name, schema: ReadingSchema }])]),
    DevicesModule,
    RealtimeModule
  ],
  controllers: [ReadingsController],
  providers: [ReadingsService, ReadingAdapter, ArchiveService],
  exports: [ReadingsService, ReadingAdapter]
})
export class ReadingsModule {}
