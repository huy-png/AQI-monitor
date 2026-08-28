import { IsIn, IsISO8601, IsOptional, IsString } from "class-validator";
import type { DeviceStatus } from "@climasense/shared";

export class CreateDeviceDto {
  @IsString()
  deviceId!: string;

  @IsString()
  name!: string;

  @IsString()
  location!: string;

  @IsOptional()
  @IsIn(["online", "offline", "warning"])
  status?: DeviceStatus;

  @IsOptional()
  @IsISO8601()
  lastSeen?: string;

  @IsOptional()
  @IsString()
  firmwareVersion?: string;
}
