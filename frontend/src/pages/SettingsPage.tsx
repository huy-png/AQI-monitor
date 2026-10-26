import { AlertSettingsPanel } from "../components/dashboard/AlertSettingsPanel";
import { ThemeColorPicker } from "../components/dashboard/ThemeColorPicker";
import { Moon, RefreshCw, Search, Sun } from "lucide-react";
import { useMemo, useState } from "react";
import type { Device } from "@climasense/shared";
import { env } from "../config/env";
import { useDashboardData } from "../hooks/useDashboardData";
import { scanFirebaseDevices } from "../services/api";
import {
  getSelectedDataSource,
  setSelectedDataSource,
  type SelectableDataSource,
} from "../services/dataSource";
import { useTheme } from "../theme/ThemeContext";

interface ScanResult {
  scannedAt: string;
  firebaseDevices: Device[];
  newDevices: Device[];
  changedDevices: Device[];
  missingDevices: Device[];
}

function hasDeviceChanged(current: Device, scanned: Device) {
  return (
    current.name !== scanned.name ||
    current.location !== scanned.location ||
    current.status !== scanned.status ||
    current.lastSeen !== scanned.lastSeen ||
    current.firmwareVersion !== scanned.firmwareVersion
  );
}

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { data } = useDashboardData("24h");
  const [dataSource, setDataSource] = useState<SelectableDataSource>(
    getSelectedDataSource,
  );
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const visibleDevices = useMemo(() => data?.devices ?? [], [data?.devices]);

  const changeDataSource = (source: SelectableDataSource) => {
    setSelectedDataSource(source);
    setDataSource(source);
    setScanResult(null);
    setScanError(null);
  };

  const scanNodes = async () => {
    setIsScanning(true);
    setScanError(null);

    try {
      const firebaseDevices = await scanFirebaseDevices();
      const visibleById = new Map(
        visibleDevices.map((device) => [device.deviceId, device]),
      );
      const firebaseById = new Map(
        firebaseDevices.map((device) => [device.deviceId, device]),
      );
      const newDevices = firebaseDevices.filter(
        (device) => !visibleById.has(device.deviceId),
      );
      const changedDevices = firebaseDevices.filter((device) => {
        const current = visibleById.get(device.deviceId);
        return current ? hasDeviceChanged(current, device) : false;
      });
      const missingDevices = visibleDevices.filter(
        (device) => !firebaseById.has(device.deviceId),
      );

      setScanResult({
        scannedAt: new Date().toISOString(),
        firebaseDevices,
        newDevices,
        changedDevices,
        missingDevices,
      });
    } catch (error) {
      console.error("[Settings] Could not scan Firebase devices.", error);
      setScanError("Không thể quét danh sách thiết bị.");
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="monitor-dashboard monitor-subpage">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Cấu hình hệ thống</p>
          <h1 className="page-title">Cài đặt</h1>
          <p className="text-muted mt-1 text-sm">
            Giao diện, nguồn dữ liệu và đồng bộ thiết bị.
          </p>
        </div>
      </header>

      <AlertSettingsPanel />

      <section className="glass-panel p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Giao diện</h2>
            <p className="text-muted mt-1 text-sm">
              Chọn chế độ sáng hoặc tối phù hợp với môi trường giám sát.
            </p>
          </div>
          <div
            className="theme-switch"
            role="group"
            aria-label="Chọn giao diện"
          >
            <button
              type="button"
              className={theme === "light" ? "is-active" : ""}
              onClick={() => setTheme("light")}
              aria-pressed={theme === "light"}
            >
              <Sun size={18} aria-hidden="true" />
              Sáng
            </button>
            <button
              type="button"
              className={theme === "dark" ? "is-active" : ""}
              onClick={() => setTheme("dark")}
              aria-pressed={theme === "dark"}
            >
              <Moon size={18} aria-hidden="true" />
              Tối
            </button>
          </div>
        </div>
        <ThemeColorPicker />
      </section>

      <section className="glass-panel p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Nguồn dữ liệu</h2>
            <p className="text-muted mt-1 text-sm">
              Chọn số đo trực tiếp từ thiết bị hoặc dữ liệu đã lưu trên máy chủ.
            </p>
          </div>
          <div
            className="theme-switch"
            role="group"
            aria-label="Chọn nguồn dữ liệu"
          >
            <button
              type="button"
              className={dataSource === "firebase" ? "is-active" : ""}
              onClick={() => changeDataSource("firebase")}
              aria-pressed={dataSource === "firebase"}
            >
              Thiết bị
            </button>
            <button
              type="button"
              className={dataSource === "api" ? "is-active" : ""}
              onClick={() => changeDataSource("api")}
              aria-pressed={dataSource === "api"}
            >
              Máy chủ
            </button>
          </div>
        </div>
      </section>

      <section className="glass-panel p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Quét thiết bị</h2>
            <p className="text-muted mt-1 text-sm">
              Đối chiếu danh sách trạm từ nguồn thiết bị với các trạm đang hiển
              thị.
            </p>
          </div>
          <button
            type="button"
            className="primary-glass-button inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 font-semibold"
            onClick={scanNodes}
            disabled={isScanning || dataSource !== "firebase"}
          >
            {isScanning ? (
              <RefreshCw
                className="animate-spin"
                size={18}
                aria-hidden="true"
              />
            ) : (
              <Search size={18} aria-hidden="true" />
            )}
            {isScanning ? "Đang quét…" : "Quét thiết bị"}
          </button>
        </div>

        {dataSource !== "firebase" ? (
          <p className="text-subtle mt-4 text-sm">
            Chọn nguồn Thiết bị để sử dụng chức năng quét.
          </p>
        ) : null}
        {scanError ? (
          <p className="mt-4 text-sm text-rose-300">{scanError}</p>
        ) : null}

        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          <div className="summary-grid">
            <div>
              <span>Đang hiển thị</span>
              <strong>{visibleDevices.length}</strong>
            </div>
            <div>
              <span>Thiết bị tìm thấy</span>
              <strong>{scanResult?.firebaseDevices.length ?? "-"}</strong>
            </div>
          </div>
          <div className="summary-grid">
            <div>
              <span>Thiết bị mới</span>
              <strong>{scanResult?.newDevices.length ?? "-"}</strong>
            </div>
            <div>
              <span>Có thay đổi</span>
              <strong>{scanResult?.changedDevices.length ?? "-"}</strong>
            </div>
          </div>
          <div className="summary-grid">
            <div>
              <span>Không còn trong nguồn thiết bị</span>
              <strong>{scanResult?.missingDevices.length ?? "-"}</strong>
            </div>
            <div>
              <span>Lần quét</span>
              <strong>
                {scanResult
                  ? new Date(scanResult.scannedAt).toLocaleTimeString("vi-VN")
                  : "-"}
              </strong>
            </div>
          </div>
        </div>

        {scanResult ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <DeviceScanList
              title="Thiết bị mới"
              devices={scanResult.newDevices}
              emptyText="Không phát hiện thiết bị mới."
            />
            <DeviceScanList
              title="Thiết bị thay đổi"
              devices={scanResult.changedDevices}
              emptyText="Thông tin thiết bị không thay đổi."
            />
            <DeviceScanList
              title="Thiết bị không còn tìm thấy"
              devices={scanResult.missingDevices}
              emptyText="Không có thiết bị bị thiếu."
            />
          </div>
        ) : null}
      </section>

      <section className="glass-panel p-5">
        <h2 className="mb-4 text-lg font-semibold">Kết nối hệ thống</h2>
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-muted text-sm">Nguồn đang chọn</dt>
            <dd className="mt-1 font-semibold">
              {dataSource === "firebase" ? "Thiết bị" : "Máy chủ"}
            </dd>
          </div>
          <div>
            <dt className="text-muted text-sm">REST API</dt>
            <dd className="mt-1 break-all font-semibold">{env.apiUrl}</dd>
          </div>
          <div>
            <dt className="text-muted text-sm">Cập nhật dữ liệu máy chủ</dt>
            <dd className="mt-1 font-semibold">Mỗi 5 giây</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

function DeviceScanList({
  title,
  devices,
  emptyText,
}: {
  title: string;
  devices: Device[];
  emptyText: string;
}) {
  return (
    <div className="scan-result-panel">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="soft-badge rounded-lg px-3 py-1 text-xs">
          {devices.length}
        </span>
      </div>
      <div className="grid gap-2">
        {devices.length ? (
          devices.map((device) => (
            <div
              key={device.deviceId}
              className="glass-row rounded-lg px-3 py-2"
            >
              <p className="truncate text-sm font-semibold">{device.name}</p>
              <p className="text-subtle truncate text-xs">{device.deviceId}</p>
              <p className="text-muted mt-1 truncate text-xs">
                {device.location}
              </p>
            </div>
          ))
        ) : (
          <p className="text-subtle text-sm">{emptyText}</p>
        )}
      </div>
    </div>
  );
}
