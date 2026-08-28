import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type ReadingDocument = HydratedDocument<ReadingModel>;

@Schema({
  collection: "sensor_readings",
  timeseries: {
    timeField: "timestamp",
    metaField: "meta",
    granularity: "minutes"
  }
})
export class ReadingModel {
  @Prop({ required: true, index: true })
  deviceId!: string;

  @Prop({ required: true })
  timestamp!: Date;

  @Prop({ required: true, type: Object })
  meta!: { deviceId: string };

  @Prop({ required: true })
  temperature!: number;

  @Prop({ required: true })
  humidity!: number;

  @Prop({ required: true })
  pressure!: number;

  @Prop({ required: true })
  airQuality!: number;

  @Prop({ required: true })
  rainfall!: number;

  @Prop({ required: true })
  windSpeed!: number;
}

export const ReadingSchema = SchemaFactory.createForClass(ReadingModel);
ReadingSchema.index({ deviceId: 1, timestamp: -1 });
