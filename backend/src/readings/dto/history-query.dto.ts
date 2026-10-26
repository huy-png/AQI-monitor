import { IsString, Matches, IsIn, IsISO8601, IsInt, IsOptional, Max, Min } from "class-validator";
import { Transform } from "class-transformer";
import type { HistoryInterval } from "@climasense/shared";

export class HistoryQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  before?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsIn(["1h", "1d", "1w", "1mo"])
  interval?: HistoryInterval;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;
}
