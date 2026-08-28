import { useEffect, useMemo, useState } from "react";
import type { ClimateReading, Device, DeviceStatus } from "@climasense/shared";
import { loadDashboardData, subscribeToReadings } from "../services/api";
import { getRuntimeDataSource, subscribeToDataSourceChanges } from "../services/dataSource";
import type { DashboardData } from "../types/dashboard";

interface DashboardState {
  data: DashboardData | null;
  isLoading: boolean;
  error: string | null;
}

const DEVICE_OFFLINE_AFTER_MS = 15_000;

function getLastSeenTime(device: Device, readings: Record<string, ClimateReading>) {
  const readingTime = Date.parse(readings[device.deviceId]?.timestamp ?? "");
  if (Number.isFinite(readingTime)) return readingTime;

  const deviceTime = Date.parse(device.lastSeen);
  return Number.isFinite(deviceTime) ? deviceTime : 0;
}

function applyDevicePresence(devices: Device[], readings: Record<string, ClimateReading>, now = Date.now()) {
  return devices.map((device) => {
    const lastSeenTime = getLastSeenTime(device, readings);
    const status: DeviceStatus = lastSeenTime > 0 && now - lastSeenTime <= DEVICE_OFFLINE_AFTER_MS ? "online" : "offline";
    return device.status === status ? device : { ...device, status };
  });
}

export function useDashboardData(range: "24h" | "7d" | "30d") {
  const [state, setState] = useState<DashboardState>({ data: null, isLoading: true, error: null });
  const [dataSource, setDataSource] = useState(getRuntimeDataSource);

  useEffect(() => subscribeToDataSourceChanges((source) => {
    setDataSource(source);
    setState({ data: null, isLoading: true, error: null });
  }), []);

  useEffect(() => {
    let mounted = true;

    loadDashboardData()
      .then((data) => {
        if (mounted) {
          setState({
            data: { ...data, devices: applyDevicePresence(data.devices, data.deviceReadings) },
            isLoading: false,
            error: null
          });
        }
      })
      .catch((reason: unknown) => {
        console.error("[Dashboard] Could not load climate data.", reason);
        if (mounted) setState((current) => ({ ...current, isLoading: false, error: "Khong the tai du lieu khi hau." }));
      });

    const unsubscribe = subscribeToReadings(
      (reading: ClimateReading) => {
        setState((current) => {
          if (!current.data) return current;
          const deviceReadings = { ...current.data.deviceReadings, [reading.deviceId]: reading };
          const devices = current.data.devices.map((device) => (
            device.deviceId === reading.deviceId
              ? { ...device, status: "online" as const, lastSeen: reading.timestamp }
              : device
          ));
          return {
            ...current,
            data: {
              ...current.data,
              connected: true,
              latest: reading,
              deviceReadings,
              devices,
              lastUpdated: reading.timestamp,
              history: [...current.data.history.slice(-47), reading]
            }
          };
        });
      },
      () => {
        setState((current) => (current.data ? { ...current, data: { ...current.data, connected: false } } : current));
      },
      (devices: Device[]) => {
        setState((current) => {
          if (!current.data) return current;
          const deviceIds = new Set(devices.map((device) => device.deviceId));
          const deviceReadings = Object.fromEntries(
            Object.entries(current.data.deviceReadings).filter(([deviceId]) => deviceIds.has(deviceId))
          );
          return { ...current, data: { ...current.data, devices: applyDevicePresence(devices, deviceReadings), deviceReadings } };
        });
      }
    );

    const presenceTimer = window.setInterval(() => {
      setState((current) => {
        if (!current.data) return current;
        const devices = applyDevicePresence(current.data.devices, current.data.deviceReadings);
        if (devices.every((device, index) => device.status === current.data?.devices[index]?.status)) return current;
        return { ...current, data: { ...current.data, devices } };
      });
    }, 1000);

    return () => {
      mounted = false;
      unsubscribe();
      window.clearInterval(presenceTimer);
    };
  }, [dataSource]);

  const filteredHistory = useMemo(() => {
    const history = state.data?.history ?? [];
    if (range === "24h") return history;
    const every = range === "7d" ? 2 : 4;
    return history.filter((_, index) => index % every === 0);
  }, [range, state.data?.history]);

  return { ...state, history: filteredHistory };
}
