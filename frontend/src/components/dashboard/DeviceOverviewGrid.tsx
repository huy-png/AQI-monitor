import { Activity } from "lucide-react";
import type { ClimateReading, Device } from "@climasense/shared";
import {
  concentrationUnit,
  formatConcentration,
  pollutants,
  pollutantValue,
} from "../../config/pollutants";

export function DeviceOverviewGrid({
  devices,
  readings,
  selectedDeviceId,
  onSelect,
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
          <p className="eyebrow">Mạng lưới trạm</p>
          <h2 className="section-title">Tình hình từng thiết bị</h2>
        </div>
        <span className="data-badge">{devices.length} thiết bị</span>
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
                <span
                  className={`device-status-dot ${isOffline ? "is-offline" : ""}`}
                />
                <Activity
                  className={isOffline ? "text-subtle" : "text-cyanCore"}
                  size={18}
                  aria-hidden="true"
                />
              </div>
              <strong>{device.name}</strong>
              <small>{device.deviceId}</small>
              {reading ? (
                <div className="device-reading-grid">
                  <span>
                    PM2.5:{" "}
                    {formatConcentration(pollutantValue(reading, "pm25"))}{" "}
                    {concentrationUnit}
                  </span>
                  <span>
                    PM10: {formatConcentration(pollutantValue(reading, "pm10"))}{" "}
                    {concentrationUnit}
                  </span>
                  <span>
                    {
                      pollutants.filter(
                        ({ key }) => pollutantValue(reading, key) !== null,
                      ).length
                    }
                    /7 thông số có dữ liệu
                  </span>
                </div>
              ) : (
                <span className="text-subtle text-xs">Chưa có bản ghi mới</span>
              )}
              <span className="device-card-hint">
                {isOffline
                  ? "Offline"
                  : isSelected
                    ? "Đang xem chi tiết"
                    : "Chọn để xem chi tiết"}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
