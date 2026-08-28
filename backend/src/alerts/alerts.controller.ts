import { Controller, Get, Param, Patch } from "@nestjs/common";
import { AlertsService } from "./alerts.service";

@Controller("alerts")
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  findAll() {
    return this.alertsService.findAll();
  }

  @Patch(":alertId/read")
  markRead(@Param("alertId") alertId: string) {
    return this.alertsService.markRead(alertId);
  }
}
