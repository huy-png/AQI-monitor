import { Injectable } from "@nestjs/common";

export interface AlertDto {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}

@Injectable()
export class AlertsService {
  private readonly alerts: AlertDto[] = [
    {
      id: "startup",
      severity: "info",
      title: "Backend sẵn sàng",
      message: "REST API, MQTT bridge và WebSocket gateway đã được khởi tạo.",
      createdAt: new Date().toISOString(),
      read: false
    }
  ];

  findAll(): AlertDto[] {
    return this.alerts;
  }

  markRead(alertId: string): AlertDto | undefined {
    const alert = this.alerts.find((item) => item.id === alertId);
    if (alert) alert.read = true;
    return alert;
  }
}
