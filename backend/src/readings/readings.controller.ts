import { Controller, Get, Param, Query } from "@nestjs/common";
import { HistoryQueryDto } from "./dto/history-query.dto";
import { ReadingsService } from "./readings.service";

@Controller("readings")
export class ReadingsController {
  constructor(private readonly readingsService: ReadingsService) {}

  @Get("latest")
  latest() {
    return this.readingsService.latest();
  }

  @Get(":deviceId/latest")
  latestByDevice(@Param("deviceId") deviceId: string) {
    return this.readingsService.latest(deviceId);
  }

  @Get(":deviceId/history")
  history(@Param("deviceId") deviceId: string, @Query() query: HistoryQueryDto) {
    return this.readingsService.history(deviceId, query);
  }

  @Get(":deviceId/summary")
  summary(@Param("deviceId") deviceId: string, @Query() query: HistoryQueryDto) {
    return this.readingsService.summary(deviceId, query);
  }
}
