import { IsISO8601, IsNumber, IsString, Max, Min } from "class-validator";

export class CreateReadingDto {
  @IsString()
  deviceId!: string;

  @IsISO8601()
  timestamp!: string;

  @IsNumber()
  @Min(-80)
  @Max(80)
  temperature!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  humidity!: number;

  @IsNumber()
  @Min(850)
  @Max(1100)
  pressure!: number;

  @IsNumber()
  @Min(0)
  airQuality!: number;

  @IsNumber()
  @Min(0)
  rainfall!: number;

  @IsNumber()
  @Min(0)
  windSpeed!: number;
}
