import { CloudRain, Gauge, Leaf, SignalHigh, Thermometer, Wind } from "lucide-react";
import type { Device } from "@climasense/shared";
import { formatTime } from "../../utils/format";

const icons = [Thermometer, CloudRain, Gauge, CloudRain, Wind, Leaf];

export function DeviceStatusList({ devices, lastUpdated }: { devices: Device[]; lastUpdated: string | null }) {
  return (
    <section className="glass-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">Trạng thái thiết bị</h2>
        <span className="soft-badge rounded-lg px-3 py-1 text-sm">{devices.length} thiết bị</span>
      </div>
      <div className="grid gap-2">
        {devices.map((device, index) => {
          const Icon = icons[index % icons.length];
          return (
            <div
              key={device.deviceId}
              className="glass-row grid grid-cols-[2rem_1fr_auto_auto] items-center gap-3 rounded-lg px-3 py-2"
            >
              <Icon className={device.status === "warning" ? "text-limeCore" : "text-primary"} size={22} aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{device.name}</p>
                <p className="text-subtle truncate text-xs">{device.location}</p>
              </div>
              <span className="inline-flex items-center gap-2 text-sm">
                <span className={`h-2.5 w-2.5 rounded-full ${device.status === "offline" ? "bg-rose-400" : "bg-limeCore"}`} />
                {device.status === "offline" ? "Ngoại tuyến" : device.status === "warning" ? "Cảnh báo" : "Trực tiếp"}
              </span>
              <SignalHigh className={device.status === "offline" ? "text-subtle" : "text-limeCore"} size={22} aria-hidden="true" />
            </div>
          );
        })}
      </div>
      <p className="text-subtle mt-4 text-sm">Cập nhật lần cuối: {formatTime(lastUpdated)}</p>
    </section>
  );
}
