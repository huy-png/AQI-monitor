import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import type { DeviceStatus } from "@climasense/shared";

export type DeviceDocument = HydratedDocument<DeviceModel>;

@Schema({ collection: "devices", timestamps: true })
export class DeviceModel {
  @Prop({ required: true, unique: true, index: true })
  deviceId!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  location!: string;

  @Prop({ required: true, enum: ["online", "offline", "warning"], default: "offline" })
  status!: DeviceStatus;

  @Prop({ required: true })
  lastSeen!: Date;

  @Prop()
  firmwareVersion?: string;
}

export const DeviceSchema = SchemaFactory.createForClass(DeviceModel);
