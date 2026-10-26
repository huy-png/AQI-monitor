import type { ClimateReading, Device } from "@climasense/shared";

export interface AlertItem {
  id: string;
  metric?: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}

export interface DashboardData {
  stationName: string;
  location: string;
  latest: ClimateReading | null;
  deviceReadings: Record<string, ClimateReading>;
  history: ClimateReading[];
  devices: Device[];
  alerts: AlertItem[];
  connected: boolean;
  lastUpdated: string | null;
}
