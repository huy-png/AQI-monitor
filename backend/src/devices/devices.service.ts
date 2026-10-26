import { isModuleSource } from "../config/data-source";
import { Injectable, NotFoundException, Optional, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import type { Device, DeviceStatus } from "@climasense/shared";
import { CreateDeviceDto } from "./dto/create-device.dto";
import { UpdateDeviceDto } from "./dto/update-device.dto";
import { DeviceModel } from "./schemas/device.schema";
import { FirebaseRealtimeService } from "../firebase/firebase-realtime.service";

@Injectable()
export class DevicesService {
  constructor(
    @Optional() @InjectModel(DeviceModel.name) private readonly deviceModel: Model<DeviceModel> | undefined,
    private readonly config: ConfigService,
    private readonly firebase: FirebaseRealtimeService
  ) {}

  async findAll(): Promise<Device[]> {
    if (isModuleSource(this.config.get<string>("DATA_SOURCE", "mongodb"))) return this.firebase.findDevices();
    if (!this.deviceModel) throw new ServiceUnavailableException("MongoDB model is not available");
    const devices = await this.deviceModel.find().sort({ name: 1 }).lean();
    return devices.map(this.toDevice);
  }

  async findOne(deviceId: string): Promise<Device> {
    if (isModuleSource(this.config.get<string>("DATA_SOURCE", "mongodb"))) {
      const device = (await this.firebase.findDevices()).find((item) => item.deviceId === deviceId);
      if (!device) throw new NotFoundException(`Device ${deviceId} not found`);
      return device;
    }
    if (!this.deviceModel) throw new ServiceUnavailableException("MongoDB model is not available");
    const device = await this.deviceModel.findOne({ deviceId }).lean();
    if (!device) throw new NotFoundException(`Device ${deviceId} not found`);
    return this.toDevice(device);
  }

  async create(dto: CreateDeviceDto): Promise<Device> {
    if (!this.deviceModel) throw new ServiceUnavailableException("MongoDB model is not available");
    const created = await this.deviceModel.create({
      ...dto,
      status: dto.status ?? "offline",
      lastSeen: dto.lastSeen ? new Date(dto.lastSeen) : new Date()
    });
    return this.toDevice(created.toObject());
  }

  async update(deviceId: string, dto: UpdateDeviceDto): Promise<Device> {
    if (!this.deviceModel) throw new ServiceUnavailableException("MongoDB model is not available");
    const updated = await this.deviceModel
      .findOneAndUpdate(
        { deviceId },
        { ...dto, lastSeen: dto.lastSeen ? new Date(dto.lastSeen) : undefined },
        { new: true, omitUndefined: true }
      )
      .lean();
    if (!updated) throw new NotFoundException(`Device ${deviceId} not found`);
    return this.toDevice(updated);
  }

  async remove(deviceId: string): Promise<void> {
    if (!this.deviceModel) throw new ServiceUnavailableException("MongoDB model is not available");
    const result = await this.deviceModel.deleteOne({ deviceId });
    if (result.deletedCount === 0) throw new NotFoundException(`Device ${deviceId} not found`);
  }

  async markSeen(deviceId: string, status: DeviceStatus = "online"): Promise<Device> {
    if (!this.deviceModel) return (await this.firebase.findDevices()).find((item) => item.deviceId === deviceId) ?? {
      deviceId,
      name: deviceId,
      location: "Chưa xác định",
      status,
      lastSeen: new Date().toISOString()
    };
    const device = await this.deviceModel
      .findOneAndUpdate(
        { deviceId },
        {
          $setOnInsert: { name: deviceId, location: "Chưa xác định" },
          $set: { status, lastSeen: new Date() }
        },
        { new: true, upsert: true }
      )
      .lean();

    return this.toDevice(device);
  }

  private toDevice(device: DeviceModel & { lastSeen: Date }): Device {
    return {
      deviceId: device.deviceId,
      name: device.name,
      location: device.location,
      status: device.status,
      lastSeen: device.lastSeen.toISOString(),
      firmwareVersion: device.firmwareVersion
    };
  }
}
