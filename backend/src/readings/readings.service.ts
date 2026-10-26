import { isModuleSource } from "../config/data-source";
import { ArchiveService } from "./archive.service";
import { Injectable, NotFoundException, Optional, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import type { ClimateReading, ReadingSummary } from "@climasense/shared";
import { DevicesService } from "../devices/devices.service";
import { ClimateGateway } from "../realtime/realtime.gateway";
import { CreateReadingDto } from "./dto/create-reading.dto";
import { HistoryQueryDto } from "./dto/history-query.dto";
import { ReadingModel } from "./schemas/reading.schema";
import { FirebaseRealtimeService } from "../firebase/firebase-realtime.service";

@Injectable()
export class ReadingsService {
  constructor(
    @Optional() @InjectModel(ReadingModel.name) private readonly readingModel: Model<ReadingModel> | undefined,
    private readonly devicesService: DevicesService,
    private readonly realtime: ClimateGateway,
    private readonly firebase: FirebaseRealtimeService,
    private readonly config: ConfigService,
    @Optional() private readonly archive?: ArchiveService
  ) {}

  async create(dto: CreateReadingDto): Promise<ClimateReading> {
    if (!this.readingModel) throw new ServiceUnavailableException("MongoDB model is not available");
    const created = await this.readingModel.create({
      ...dto,
      timestamp: new Date(dto.timestamp),
      meta: { deviceId: dto.deviceId }
    });
    const device = await this.devicesService.markSeen(dto.deviceId, "online");
    const reading = this.toReading(created.toObject());

    this.realtime.emitDeviceStatus(device);
    this.realtime.emitReading(reading);
    return reading;
  }

  async latest(deviceId?: string): Promise<ClimateReading> {
    if (isModuleSource(this.config.get<string>("DATA_SOURCE", "mongodb"))) {
      return this.firebase.getLatest(deviceId);
    }
    if (!this.readingModel) throw new ServiceUnavailableException("MongoDB model is not available");
    const query = deviceId ? { deviceId } : {};
    const reading = await this.readingModel.findOne(query).sort({ timestamp: -1 }).lean();
    if (!reading) throw new NotFoundException("No climate readings found");
    return this.toReading(reading);
  }

  async history(deviceId: string, query: HistoryQueryDto): Promise<ClimateReading[]> {
    if (isModuleSource(this.config.get<string>("DATA_SOURCE", "mongodb"))) {
      if (!this.archive) throw new ServiceUnavailableException("History archive is unavailable");
      return await this.archive.history(deviceId, query) as unknown as ClimateReading[];
    }
    if (!this.readingModel) throw new ServiceUnavailableException("MongoDB model is not available");
    const filter: Record<string, unknown> = { deviceId };
    const timestamp: Record<string, Date> = {};
    if (query.from) timestamp.$gte = new Date(query.from);
    if (query.to) timestamp.$lte = new Date(query.to);
    if (Object.keys(timestamp).length > 0) filter.timestamp = timestamp;

    const limit = query.limit ?? 200;
    const readings = await this.readingModel.find(filter).sort({ timestamp: -1 }).limit(limit).lean();
    return readings.reverse().map(this.toReading);
  }

  async summary(deviceId: string, query: HistoryQueryDto): Promise<ReadingSummary> {
    const history = await this.history(deviceId, { ...query, limit: query.limit ?? 1000 });
    if (history.length === 0) throw new NotFoundException("No readings for summary");
    const temperatures = history.map((reading) => reading.temperature).filter(value => typeof value === "number" && Number.isFinite(value));
    const humidities = history.map((reading) => reading.humidity).filter(value => typeof value === "number" && Number.isFinite(value));

    return {
      minTemperature: temperatures.length ? Math.min(...temperatures) : Number.NaN,
      maxTemperature: temperatures.length ? Math.max(...temperatures) : Number.NaN,
      avgTemperature: this.average(temperatures),
      avgHumidity: this.average(humidities),
      totalRainfall: history.reduce((total, reading) => total + (reading.rainfall ?? 0), 0),
      maxWindSpeed: Math.max(...history.map((reading) => reading.windSpeed))
    };
  }

  private average(values: number[]): number {
    return Number((values.reduce((total, value) => total + value, 0) / values.length).toFixed(2));
  }

  private toReading(reading: ReadingModel & { timestamp: Date }): ClimateReading {
    return {
      deviceId: reading.deviceId,
      timestamp: reading.timestamp.toISOString(),
      temperature: reading.temperature,
      humidity: reading.humidity,
      pressure: reading.pressure,
      airQuality: reading.airQuality,
      rainfall: reading.rainfall,
      windSpeed: reading.windSpeed
    };
  }
}
