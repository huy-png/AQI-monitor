import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, Max, Min, ValidateNested } from "class-validator";
import { alertMetrics } from "@climasense/shared";
export class AlertRuleDto {
  @IsIn(alertMetrics.map(item => item.key)) metric!: string;
  @IsBoolean() enabled!: boolean;
  @IsOptional() @IsNumber() lower!: number | null;
  @IsOptional() @IsNumber() upper!: number | null;
  @IsOptional() @IsNumber() @Min(0.000001) rise!: number | null;
  @IsOptional() @IsNumber() @Min(0.000001) fall!: number | null;
  @IsInt() @Min(10) @Max(3600) windowSeconds!: number;
  @IsInt() @Min(10) @Max(86400) cooldownSeconds!: number;
}
export class AlertSettingsDto {
  @IsArray() @ArrayMinSize(11) @ArrayMaxSize(11) @ValidateNested({ each: true }) @Type(() => AlertRuleDto)
  rules!: AlertRuleDto[];
}
