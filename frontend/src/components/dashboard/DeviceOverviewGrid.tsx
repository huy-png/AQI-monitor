import { Activity, Droplets, Gauge, Thermometer } from "lucide-react";
import type { ClimateReading, Device } from "@climasense/shared";

export function DeviceOverviewGrid({
  devices,
  readings,
  selectedDeviceId,
  onSelect
}: {
  devices: Device[];
  readings: Record<string, ClimateReading>;
  selectedDeviceId: string;
  onSelect: (deviceId: string) => void;
}) {
  return (
    <section className="device-overview">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Mang luoi tram</p>
          <h2 className="section-title">Tinh hinh tung thiet bi</h2>
        </div>
        <span className="data-badge">{devices.length} thiet bi</span>
      </div>
      <div className="device-overview-grid">
        {devices.map((device) => {
          const reading = readings[device.deviceId];
          const isSelected = device.deviceId === selectedDeviceId;
          const isOffline = device.status === "offline";

          return (
            <button
              type="button"
              key={device.deviceId}
              className={`device-overview-card ${isSelected ? "is-selected" : ""}`}
              onClick={() => onSelect(device.deviceId)}
            >
              <div className="flex items-start justify-between gap-2">
                <span className={`device-status-dot ${isOffline ? "is-offline" : ""}`} />
                <Activity className={isOffline ? "text-subtle" : "text-cyanCore"} size={18} aria-hidden="true" />
              </div>
              <strong>{device.name}</strong>
              <small>{device.deviceId}</small>
              {reading ? (
                <div className="device-reading-grid">
                  <span><Thermometer size={13} />{reading.temperature.toFixed(1)}°C</span>
                  <span><Droplets size={13} />{reading.humidity.toFixed(0)}%</span>
                  <span><Gauge size={13} />{reading.airQuality.toFixed(0)} AQI</span>
                </div>
              ) : (
                <span className="text-subtle text-xs">Chua co ban ghi moi</span>
              )}
              <span className="device-card-hint">
                {isOffline ? "Offline" : isSelected ? "Dang xem chi tiet" : "Chon de xem chi tiet"}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
