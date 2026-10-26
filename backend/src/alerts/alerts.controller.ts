import { AlertSettingsDto } from "./alert-settings.dto";
import { Body, Controller, Get, Param, Patch, Put } from "@nestjs/common";
import { AlertsService } from "./alerts.service";

@Controller("alerts")
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get("settings")
  async settings() { const settings = await this.alertsService.getSettings(); return { rules: settings.rules }; }

  @Put("settings")
  saveSettings(@Body() settings: AlertSettingsDto) { return this.alertsService.saveSettings(settings); }

  @Get()
  findAll() {
    return this.alertsService.findAll();
  }

  @Patch(":alertId/read")
  markRead(@Param("alertId") alertId: string) {
    return this.alertsService.markRead(alertId);
  }
}
