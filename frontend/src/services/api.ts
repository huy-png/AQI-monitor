import axios from "axios";
import { io } from "socket.io-client";
import type { ClimateReading, Device } from "@climasense/shared";
import { env } from "../config/env";
import { mockAlerts, mockDevices, mockHistory } from "./mockData";
import { loadFirebaseDashboardData, loadFirebaseDevices, loadFirebaseReportReadings, subscribeToFirebaseReadings } from "./firebase";
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

  const [latest, history, devices, alerts] = await Promise.all([
    api.get<ClimateReading>("/readings/latest"),
    api.get<ClimateReading[]>("/readings/esp32-garden-01/history", { params: { interval: "1h", limit: 24 } }),
    api.get<Device[]>("/devices"),
    api.get<AlertItem[]>("/alerts")
  ]);

  return {
    stationName: "Vườn thông minh",
    location: "Đà Lạt",
    latest: latest.data,
    deviceReadings: { [latest.data.deviceId]: latest.data },
    history: history.data,
    devices: devices.data,
    alerts: alerts.data,
    connected: true,
    lastUpdated: latest.data.timestamp
  };
}

export async function loadReportReadings(deviceIds: string[]): Promise<ClimateReading[]> {
  const dataSource = getRuntimeDataSource();
  if (dataSource === "firebase") return loadFirebaseReportReadings(deviceIds);
  if (dataSource === "mock") return mockHistory.filter((reading) => deviceIds.includes(reading.deviceId));

  const responses = await Promise.all(
    deviceIds.map((deviceId) => api.get<ClimateReading[]>(`/readings/${deviceId}/history`, { params: { interval: "1h", limit: 2000 } }))
  );
  return responses.flatMap((response) => response.data).sort((first, second) => Date.parse(first.timestamp) - Date.parse(second.timestamp));
}

export async function scanFirebaseDevices(): Promise<Device[]> {
  return loadFirebaseDevices();
}

export function subscribeToReadings(onReading: (reading: ClimateReading) => void, onDisconnect: () => void, onDevicesChanged?: (devices: Device[]) => void) {
  const dataSource = getRuntimeDataSource();

  if (dataSource === "firebase") {
    return subscribeToFirebaseReadings(onReading, onDisconnect, onDevicesChanged);
  }

  if (dataSource !== "api") {
    return () => undefined;
  }

  const socket = io(env.socketUrl, {
    transports: ["websocket"],
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000
  });

  socket.on("reading:new", onReading);
  socket.on("disconnect", onDisconnect);

  return () => socket.close();
}
