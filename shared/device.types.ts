export type DeviceStatus = "online" | "offline" | "warning";

export interface Device {
  deviceId: string;
  name: string;
  location: string;
  status: DeviceStatus;
  lastSeen: string;
  firmwareVersion?: string;
}

export interface DeviceCommand {
  type: "irrigation:on" | "irrigation:off" | "restart" | "calibrate";
  payload?: Record<string, string | number | boolean>;
}
