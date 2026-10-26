import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import {
  get,
  getDatabase,
  onValue,
  ref,
  type Unsubscribe,
} from "firebase/database";
import type { ClimateReading, Device, DeviceStatus } from "@climasense/shared";
import { env } from "../config/env";
import type { AlertItem, DashboardData } from "../types/dashboard";
import { pollutants } from "../config/pollutants";

type FirebaseObject = Record<string, unknown>;

const TIMESTAMP_KEYS = [
  "timestampiso",
  "timestampIso",
  "timestampISO",
  "timestamp_iso",
  "timestamp",
  "time",
  "ts",
  "updatedAt",
  "updated_at",
];

let firebaseApp: FirebaseApp | null = null;
let authReady: Promise<void> | null = null;

function getFirebaseApp() {
  if (!firebaseApp) {
    firebaseApp = initializeApp(env.firebase);
  }
  return firebaseApp;
}

function database() {
  return getDatabase(getFirebaseApp());
}

async function ensureFirebaseAuth() {
  const auth = getAuth(getFirebaseApp());
  if (auth.currentUser) return;
  if (!env.firebaseAuth.email || !env.firebaseAuth.password) {
    throw new Error(
      "Thiếu VITE_FIREBASE_AUTH_EMAIL hoặc VITE_FIREBASE_AUTH_PASSWORD.",
    );
  }
  authReady ??= signInWithEmailAndPassword(
    auth,
    env.firebaseAuth.email,
    env.firebaseAuth.password,
  ).then(() => undefined);
  await authReady;
}

function toObject(value: unknown): FirebaseObject | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as FirebaseObject;
  }
  return null;
}

function collectionValues(value: unknown): unknown[] {
  if (Array.isArray(value)) return value.filter(Boolean);
  const objectValue = toObject(value);
  if (!objectValue) return [];
  return Object.entries(objectValue).map(([id, item]) => {
    const itemObject = toObject(item);
    return itemObject ? { id, ...itemObject } : item;
  });
}

function readString(
  objectValue: FirebaseObject,
  keys: string[],
  fallback = "",
): string {
  for (const key of keys) {
    const value = objectValue[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number" && Number.isFinite(value))
      return String(value);
  }
  return fallback;
}

function readNumber(
  objectValue: FirebaseObject,
  keys: string[],
  fallback = 0,
): number {
  for (const key of keys) {
    const value = objectValue[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (
      typeof value === "string" &&
      value.trim() &&
      Number.isFinite(Number(value))
    )
      return Number(value);
  }
  return fallback;
}

function normalizeTimestamp(value: string | number): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    const milliseconds = value < 10_000_000_000 ? value * 1000 : value;
    return new Date(milliseconds).toISOString();
  }

  const textValue = String(value);
  return Number.isFinite(Date.parse(textValue))
    ? textValue
    : new Date().toISOString();
}

export function normalizeFirebaseReading(
  value: unknown,
  fallbackDeviceId = "esp32-garden-01",
): ClimateReading | null {
  const objectValue = toObject(value);
  if (!objectValue) return null;

  return {
    deviceId: readString(
      objectValue,
      ["deviceId", "device_id", "nodeId", "node_id", "id"],
      fallbackDeviceId,
    ),
    ...Object.fromEntries(
      pollutants.map(({ key }) => {
        const aliases =
          key === "pm25"
            ? ["pm25", "pm2_5", "pm2.5", "pm_25", "PM2.5", "PM25"]
            : [key, key.toUpperCase()];
        const value = readNumber(objectValue, aliases, Number.NaN);
        return [key, Number.isFinite(value) && value >= 0 ? value : undefined];
      }),
    ),
    timestamp: normalizeTimestamp(
      readString(objectValue, TIMESTAMP_KEYS, new Date().toISOString()),
    ),
    temperature: readNumber(objectValue, [
      "temperature",
      "temperature_c",
      "temp",
      "t",
    ], Number.NaN),
    humidity: readNumber(objectValue, ["humidity", "humidity_pct", "hum", "h"], Number.NaN),
    pressure: readNumber(objectValue, ["pressure", "pressure_hpa", "p"], Number.NaN),
    airQuality: readNumber(objectValue, ["airQuality", "air_quality", "aqi"]),
    rainfall: readNumber(objectValue, ["rainfall", "rain_mm", "rain"]),
    windSpeed: readNumber(objectValue, [
      "windSpeed",
      "wind_speed",
      "wind_kmh",
      "wind",
    ]),
    latitude: readNumber(objectValue, ["latitude", "lat"], Number.NaN),
    longitude: readNumber(objectValue, ["longitude", "lng", "lon"], Number.NaN),
  };
}

function normalizeFirebaseDevice(value: unknown): Device | null {
  const objectValue = toObject(value);
  if (!objectValue) return null;

  const latest = toObject(objectValue.latest) ?? {};
  const deviceValue = { ...latest, ...objectValue };
  const status = readString(deviceValue, ["status"], "online") as DeviceStatus;

  return {
    deviceId: readString(
      deviceValue,
      ["deviceId", "device_id", "nodeId", "id"],
      "unknown-device",
    ),
    name: readString(objectValue, ["name"], "Thiết bị IoT"),
    location: readString(objectValue, ["location"], "Chưa xác định"),
    status: ["online", "offline", "warning"].includes(status)
      ? status
      : "online",
    lastSeen: normalizeTimestamp(
      readString(
        deviceValue,
        ["lastSeen", "last_seen", ...TIMESTAMP_KEYS],
        new Date().toISOString(),
      ),
    ),
    firmwareVersion:
      readString(deviceValue, ["firmwareVersion", "firmware_version"], "") ||
      undefined,
  };
}

function normalizeFirebaseAlert(value: unknown): AlertItem | null {
  const objectValue = toObject(value);
  if (!objectValue) return null;
  const severity = readString(objectValue, ["severity"], "info");

  return {
    id: readString(objectValue, ["id"], crypto.randomUUID()),
    severity:
      severity === "critical" || severity === "warning" ? severity : "info",
    title: readString(objectValue, ["title"], "Thông báo thiết bị"),
    message: readString(
      objectValue,
      ["message"],
      "Thiết bị đã cập nhật dữ liệu mới.",
    ),
    createdAt: normalizeTimestamp(
      readString(
        objectValue,
        ["createdAt", "created_at"],
        new Date().toISOString(),
      ),
    ),
    read: Boolean(objectValue.read),
  };
}

async function once(path: string): Promise<unknown> {
  await ensureFirebaseAuth();
  const snapshot = await get(ref(database(), path));
  return snapshot.val();
}

async function readOptional(path: string, label: string): Promise<unknown> {
  try {
    return await once(path);
  } catch (error) {
    console.warn(
      `[Firebase] Không đọc được nhánh ${label} tại "${path}".`,
      error,
    );
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function readRequired(path: string, label: string): Promise<unknown> {
  try {
    const value = await once(path);
    if (value === null || value === undefined) {
      throw new Error(`Firebase path "${path}" không có dữ liệu (${label}).`);
    }
    return value;
  } catch (error) {
    console.error(
      `[Firebase] Không đọc được nhánh bắt buộc ${label} tại "${path}".`,
      error,
    );
    throw error;
  }
}

export async function loadFirebaseDashboardData(): Promise<DashboardData> {
  const devicesPath = env.firebasePaths.devices;
  const [devicesValue, alertsValue] = await Promise.all([
    readOptional(devicesPath, "devices"),
    readOptional(env.firebasePaths.alerts, "alerts"),
  ]);

  const devicesFromFirebase = collectionValues(devicesValue)
    .map(normalizeFirebaseDevice)
    .filter((item): item is Device => Boolean(item));
  const alerts = collectionValues(alertsValue)
    .map(normalizeFirebaseAlert)
    .filter((item): item is AlertItem => Boolean(item));
  const configuredDeviceIds: string[] = env.firebasePaths.deviceIds as string[];
  const devices: Device[] =
    devicesFromFirebase.length > 0
      ? devicesFromFirebase
      : configuredDeviceIds.map((deviceId: string) => ({
          deviceId,
          name: deviceId,
          location: "Trạm quan trắc",
          status: "online" as const,
          lastSeen: new Date().toISOString(),
        }));
  const deviceIds = devices.map((device) => device.deviceId);
  const deviceReadingsEntries = await Promise.all(
    deviceIds.map(async (deviceId) => {
      const path = env.firebasePaths.latest.split("{deviceId}").join(deviceId);
      const value = await readOptional(path, `latest:${deviceId}`);
      const reading = normalizeFirebaseReading(value, deviceId);
      return reading ? ([deviceId, reading] as const) : null;
    }),
  );
  const deviceReadings = Object.fromEntries(
    deviceReadingsEntries.filter(
      (entry): entry is readonly [string, ClimateReading] => Boolean(entry),
    ),
  );
  const latest =
    deviceReadings[env.firebasePaths.deviceId] ??
    Object.values(deviceReadings)[0] ??
    null;

  if (!latest) {
    throw new Error(
      `Firebase không có bản ghi latest trong nhánh "${devicesPath}".`,
    );
  }

  return {
    stationName: "Vườn thông minh",
    location: "Đà Lạt",
    latest,
    deviceReadings,
    history: [latest],
    devices,
    alerts,
    connected: true,
    lastUpdated: latest?.timestamp ?? null,
  };
}

export async function loadFirebaseReportReadings(
  deviceIds: string[],
): Promise<ClimateReading[]> {
  const readings = await Promise.all(
    deviceIds.map(async (deviceId) => {
      const latestPath = env.firebasePaths.latest
        .split("{deviceId}")
        .join(deviceId);
      const latestValue = await readOptional(latestPath, `latest:${deviceId}`);
      const latest = normalizeFirebaseReading(latestValue, deviceId);
      return latest ? [latest] : [];
    }),
  );

  return readings
    .flat()
    .sort(
      (first, second) =>
        Date.parse(first.timestamp) - Date.parse(second.timestamp),
    );
}

export async function loadFirebaseDevices(): Promise<Device[]> {
  const devicesValue = await readOptional(env.firebasePaths.devices, "devices");
  return collectionValues(devicesValue)
    .map(normalizeFirebaseDevice)
    .filter((item): item is Device => Boolean(item));
}

function fallbackDevices(deviceIds: string[]): Device[] {
  return deviceIds.map((deviceId) => ({
    deviceId,
    name: deviceId,
    location: "Tram quan trac",
    status: "online" as const,
    lastSeen: new Date().toISOString(),
  }));
}

export function subscribeToFirebaseReadings(
  onReading: (reading: ClimateReading) => void,
  onDisconnect: () => void,
  onDevicesChanged?: (devices: Device[]) => void,
) {
  let disposed = false;
  const readingUnsubscribes = new Map<string, Unsubscribe>();
  let devicesUnsubscribe: Unsubscribe = () => undefined;

  ensureFirebaseAuth()
    .then(async () => {
      if (disposed) return;
      const attachDevice = (deviceId: string) => {
        if (readingUnsubscribes.has(deviceId) || disposed) return;
        const unsubscribe = onValue(
          ref(
            database(),
            env.firebasePaths.latest.split("{deviceId}").join(deviceId),
          ),
          (snapshot) => {
            const reading = normalizeFirebaseReading(snapshot.val(), deviceId);
            if (reading) onReading(reading);
          },
          () => onDisconnect(),
        );
        readingUnsubscribes.set(deviceId, unsubscribe);
      };
      const syncDevices = (devices: Device[]) => {
        const deviceIds = new Set(devices.map((device) => device.deviceId));
        for (const [deviceId, unsubscribe] of readingUnsubscribes) {
          if (!deviceIds.has(deviceId)) {
            unsubscribe();
            readingUnsubscribes.delete(deviceId);
          }
        }
        devices.forEach((device) => attachDevice(device.deviceId));
        onDevicesChanged?.(devices);
      };

      devicesUnsubscribe = onValue(
        ref(database(), env.firebasePaths.devices),
        (snapshot) => {
          const value = snapshot.val();
          const devices = collectionValues(value)
            .map(normalizeFirebaseDevice)
            .filter((item): item is Device => Boolean(item));
          syncDevices(
            devices.length > 0
              ? devices
              : fallbackDevices(env.firebasePaths.deviceIds as string[]),
          );
        },
        () =>
          syncDevices(fallbackDevices(env.firebasePaths.deviceIds as string[])),
      );
    })
    .catch(() => onDisconnect());

  return () => {
    disposed = true;
    devicesUnsubscribe();
    readingUnsubscribes.forEach((unsubscribe) => unsubscribe());
    readingUnsubscribes.clear();
  };
}
