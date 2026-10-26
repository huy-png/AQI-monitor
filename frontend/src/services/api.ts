import axios from "axios";
import type { ClimateReading, Device } from "@climasense/shared";
import { env } from "../config/env";
import { mockAlerts, mockDevices, mockHistory } from "./mockData";
import { loadFirebaseDashboardData, loadFirebaseDevices, subscribeToFirebaseReadings } from "./firebase";
import { getRuntimeDataSource } from "./dataSource";
import type { AlertItem, DashboardData } from "../types/dashboard";

const api = axios.create({
  baseURL: env.apiUrl,
  timeout: 8000
});

export async function loadDashboardData(): Promise<DashboardData> {
  const dataSource = getRuntimeDataSource();

  if (dataSource === "mock") {
    const latest = mockHistory.at(-1) ?? null;

    return {
      stationName: "Vườn thông minh",
      location: "Đà Lạt",
      latest,
      deviceReadings: Object.fromEntries(mockDevices.map((device) => [device.deviceId, mockHistory.slice().reverse().find((reading) => reading.deviceId === device.deviceId) ?? latest]).filter((entry): entry is [string, ClimateReading] => Boolean(entry[1]))),
      history: mockHistory,
      devices: mockDevices,
      alerts: mockAlerts,
      connected: true,
      lastUpdated: latest?.timestamp ?? null
    };
  }

  if (dataSource === "firebase") {
    return loadFirebaseDashboardData();
  }

  return (await api.get<DashboardData>("/readings/archive/dashboard")).data;
}

export async function loadReportReadings(deviceIds: string[], range: { from?: string; to?: string } = {}, archiveOnly = false): Promise<ClimateReading[]> {
  const dataSource = getRuntimeDataSource();
  if (!archiveOnly && dataSource === "mock") return mockHistory.filter((reading) => deviceIds.includes(reading.deviceId));

  const results = await Promise.all(deviceIds.map(async deviceId => {
    const rows: ClimateReading[] = [];
    let before: string | undefined;
    do {
      const response = await api.get<(ClimateReading & { id?: string })[]>(`/readings/${encodeURIComponent(deviceId)}/history`, { params: { ...range, limit: 1000, before } });
      rows.push(...response.data);
      const next = response.data.at(-1)?.id;
      if (response.data.length < 1000 || !next || next === before) break;
      before = next;
    } while (before);
    return rows;
  }));
  return results.flat().sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}

export async function scanFirebaseDevices(): Promise<Device[]> {
  return loadFirebaseDevices();
}

export async function loadArchiveDashboard(): Promise<DashboardData> {
  return (await api.get<DashboardData>("/readings/archive/dashboard")).data;
}

export function subscribeToReadings(onReading: (reading: ClimateReading) => void, onDisconnect: () => void, onDevicesChanged?: (devices: Device[]) => void) {
  const dataSource = getRuntimeDataSource();

  if (dataSource === "firebase") {
    return subscribeToFirebaseReadings(onReading, onDisconnect, onDevicesChanged);
  }

  if (dataSource !== "api") {
    return () => undefined;
  }

  return () => undefined;
}

export async function loadEnvironmentalAlerts(): Promise<AlertItem[]> {
  return (await api.get<AlertItem[]>("/alerts")).data;
}

export async function loadMonitoringHealth() {
  const [health, archive] = await Promise.allSettled([
    api.get<{ status: string; postgresql?: string; mongodb?: string }>("/health"),
    api.get<{ connected: boolean; pendingDevices: number; lastSavedAt: string | null; error: string | null; lastSnapshotAt?: string | null; lastVerifiedAt?: string | null; recoveryCount?: number }>("/readings/archive/status")
  ]);
  return {
    api: health.status === "fulfilled" || archive.status === "fulfilled",
    database: health.status === "fulfilled" ? (health.value.data.postgresql ?? health.value.data.mongodb) === "connected" : null,
    collector: archive.status === "fulfilled" ? archive.value.data : null,
    checkedAt: new Date().toISOString()
  };
}
export async function readEnvironmentalAlert(id: string) {
  await api.patch(`/alerts/${encodeURIComponent(id)}/read`);
}
export async function loadAlertSettings(): Promise<import("@climasense/shared").AlertSettings> {
  return (await api.get("/alerts/settings")).data;
}
export async function saveAlertSettings(settings: import("@climasense/shared").AlertSettings) {
  return (await api.put("/alerts/settings", settings)).data;
}
