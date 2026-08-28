import { IsIn, IsObject, IsOptional } from "class-validator";

export class DeviceCommandDto {
  @IsIn(["irrigation:on", "irrigation:off", "restart", "calibrate"])
  type!: "irrigation:on" | "irrigation:off" | "restart" | "calibrate";

  @IsOptional()
  @IsObject()
  payload?: Record<string, string | number | boolean>;
}
