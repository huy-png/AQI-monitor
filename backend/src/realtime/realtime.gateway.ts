import { Logger } from "@nestjs/common";
import { ConnectedSocket, OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import type { ClimateReading, Device } from "@climasense/shared";
import type { Server, Socket } from "socket.io";

@WebSocketGateway({ cors: { origin: process.env.FRONTEND_URL ?? "http://localhost:5173" } })
export class ClimateGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server!: Server;

  private readonly logger = new Logger(ClimateGateway.name);

  handleConnection(@ConnectedSocket() client: Socket) {
    this.logger.log(`WebSocket connected: ${client.id}`);
  }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    this.logger.warn(`WebSocket disconnected: ${client.id}`);
  }

  emitReading(reading: ClimateReading) {
    this.server.emit("reading:new", reading);
  }

  emitDeviceStatus(device: Device) {
    this.server.emit("device:status", device);
  }

  emitAlert(alert: unknown) {
    this.server.emit("alert:new", alert);
  }
}
