import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { DeviceCommandDto } from "./dto/device-command.dto";
import { CreateDeviceDto } from "./dto/create-device.dto";
import { UpdateDeviceDto } from "./dto/update-device.dto";
import { DevicesService } from "./devices.service";
import { MqttService } from "../mqtt/mqtt.service";

@Controller("devices")
export class DevicesController {
  constructor(
    private readonly devicesService: DevicesService,
    private readonly mqttService: MqttService
  ) {}

  @Get()
  findAll() {
    return this.devicesService.findAll();
  }

  @Get(":deviceId")
  findOne(@Param("deviceId") deviceId: string) {
    return this.devicesService.findOne(deviceId);
  }

  @Post()
  create(@Body() dto: CreateDeviceDto) {
    return this.devicesService.create(dto);
  }

  @Patch(":deviceId")
  update(@Param("deviceId") deviceId: string, @Body() dto: UpdateDeviceDto) {
    return this.devicesService.update(deviceId, dto);
  }

  @Delete(":deviceId")
  remove(@Param("deviceId") deviceId: string) {
    return this.devicesService.remove(deviceId);
  }

  @Post(":deviceId/commands")
  command(@Param("deviceId") deviceId: string, @Body() dto: DeviceCommandDto) {
    return this.mqttService.publishCommand(deviceId, dto);
  }
}
