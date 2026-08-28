import type { ClimateReading, Device } from "@climasense/shared";
import type { AlertItem } from "../types/dashboard";

const now = new Date("2026-07-28T05:00:00.000Z");

export const mockHistory: ClimateReading[] = Array.from({ length: 25 }, (_, index) => {
  const hour = index - 24;
  const timestamp = new Date(now.getTime() + hour * 60 * 60 * 1000).toISOString();
  const temperature = 23.2 + Math.sin(index / 3.5) * 4.8 + (index > 18 ? 1.2 : 0);
  const humidity = 67 + Math.cos(index / 4.1) * 15;

  return {
    deviceId: "esp32-garden-01",
    timestamp,
    temperature: Number(temperature.toFixed(1)),
    humidity: Math.round(humidity),
    pressure: 1012 + Math.round(Math.sin(index / 5) * 3),
    airQuality: 42 + Math.round(Math.cos(index / 3) * 4),
    rainfall: index > 8 && index < 11 ? 1.2 : 0,
    windSpeed: Number((6.4 + Math.sin(index / 2.8) * 1.6).toFixed(1))
  };
});

export const mockDevices: Device[] = [
  {
    deviceId: "esp32-garden-01",
    name: "Cảm biến nhiệt độ & độ ẩm",
    location: "Nhà kính A",
    status: "online",
    lastSeen: now.toISOString(),
    firmwareVersion: "1.4.2"
  },
  {
    deviceId: "air-quality-01",
    name: "Cảm biến chất lượng không khí",
    location: "Khu rau thủy canh",
    status: "online",
    lastSeen: now.toISOString(),
    firmwareVersion: "1.2.8"
  },
  {
    deviceId: "pressure-01",
    name: "Cảm biến áp suất",
    location: "Trạm trung tâm",
    status: "online",
    lastSeen: now.toISOString()
  },
  {
    deviceId: "rain-01",
    name: "Cảm biến mưa",
    location: "Ngoài trời",
    status: "online",
    lastSeen: now.toISOString()
  },
  {
    deviceId: "wind-01",
    name: "Cảm biến gió",
    location: "Cột đo phía đông",
    status: "online",
    lastSeen: now.toISOString()
  },
  {
    deviceId: "irrigation-01",
    name: "Bộ điều khiển tưới",
    location: "Van khu A",
    status: "warning",
    lastSeen: new Date(now.getTime() - 11 * 60 * 1000).toISOString(),
    firmwareVersion: "2.0.1"
  }
];

export const mockAlerts: AlertItem[] = [
  {
    id: "alert-01",
    severity: "warning",
    title: "Độ ẩm đất khu A giảm",
    message: "Bộ điều khiển tưới đang chờ xác nhận lịch tưới tiếp theo.",
    createdAt: new Date(now.getTime() - 18 * 60 * 1000).toISOString(),
    read: false
  },
  {
    id: "alert-02",
    severity: "info",
    title: "Chất lượng không khí tốt",
    message: "AQI duy trì dưới ngưỡng 50 trong 6 giờ gần nhất.",
    createdAt: new Date(now.getTime() - 73 * 60 * 1000).toISOString(),
    read: true
  }
];
