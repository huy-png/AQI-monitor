import { Moon, RefreshCw, Search, Sun } from "lucide-react";
import { useMemo, useState } from "react";
import type { Device } from "@climasense/shared";
import { env } from "../config/env";
import { useDashboardData } from "../hooks/useDashboardData";
import { scanFirebaseDevices } from "../services/api";
import { getSelectedDataSource, setSelectedDataSource, type SelectableDataSource } from "../services/dataSource";
import { useTheme } from "../theme/ThemeContext";

interface ScanResult {
  scannedAt: string;
  firebaseDevices: Device[];
  newDevices: Device[];
  changedDevices: Device[];
  missingDevices: Device[];
}

function hasDeviceChanged(current: Device, scanned: Device) {
  return current.name !== scanned.name
    || current.location !== scanned.location
    || current.status !== scanned.status
    || current.lastSeen !== scanned.lastSeen
    || current.firmwareVersion !== scanned.firmwareVersion;
}

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { data } = useDashboardData("24h");
  const [dataSource, setDataSource] = useState<SelectableDataSource>(getSelectedDataSource);
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
      const visibleById = new Map(visibleDevices.map((device) => [device.deviceId, device]));
      const firebaseById = new Map(firebaseDevices.map((device) => [device.deviceId, device]));
      const newDevices = firebaseDevices.filter((device) => !visibleById.has(device.deviceId));
      const changedDevices = firebaseDevices.filter((device) => {
        const current = visibleById.get(device.deviceId);
        return current ? hasDeviceChanged(current, device) : false;
      });
      const missingDevices = visibleDevices.filter((device) => !firebaseById.has(device.deviceId));

      setScanResult({
        scannedAt: new Date().toISOString(),
        firebaseDevices,
        newDevices,
        changedDevices,
        missingDevices
      });
    } catch (error) {
      console.error("[Settings] Could not scan Firebase devices.", error);
      setScanError("Khong the quet node tu Firebase.");
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="grid gap-4 p-3">
      <h1 className="text-3xl font-bold">Cai dat</h1>

      <section className="glass-panel p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Giao dien</h2>
            <p className="text-muted mt-1 text-sm">Chon che do hien thi phu hop voi moi truong cua ban.</p>
          </div>
          <div className="theme-switch" role="group" aria-label="Chon giao dien">
            <button type="button" className={theme === "light" ? "is-active" : ""} onClick={() => setTheme("light")} aria-pressed={theme === "light"}>
              <Sun size={18} aria-hidden="true" />
              Sang
            </button>
            <button type="button" className={theme === "dark" ? "is-active" : ""} onClick={() => setTheme("dark")} aria-pressed={theme === "dark"}>
              <Moon size={18} aria-hidden="true" />
              Toi
            </button>
          </div>
        </div>
      </section>

      <section className="glass-panel p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Nguon nhan du lieu</h2>
            <p className="text-muted mt-1 text-sm">Chon Firebase hien tai hoac WebSocket/API cho giai doan thiet bi gui truc tiep sau nay.</p>
          </div>
          <div className="theme-switch" role="group" aria-label="Chon nguon du lieu">
            <button type="button" className={dataSource === "firebase" ? "is-active" : ""} onClick={() => changeDataSource("firebase")} aria-pressed={dataSource === "firebase"}>
              Firebase
            </button>
            <button type="button" className={dataSource === "api" ? "is-active" : ""} onClick={() => changeDataSource("api")} aria-pressed={dataSource === "api"}>
              WebSocket
            </button>
          </div>
        </div>
      </section>

      <section className="glass-panel p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Quet node Firebase</h2>
            <p className="text-muted mt-1 text-sm">
              So sanh node trong nhanh {env.firebasePaths.devices} voi danh sach thiet bi dang hien thi tren web.
            </p>
          </div>
          <button
            type="button"
            className="primary-glass-button inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 font-semibold"
            onClick={scanNodes}
            disabled={isScanning || dataSource !== "firebase"}
          >
            {isScanning ? <RefreshCw className="animate-spin" size={18} aria-hidden="true" /> : <Search size={18} aria-hidden="true" />}
            {isScanning ? "Dang quet..." : "Quet node"}
          </button>
        </div>

        {dataSource !== "firebase" ? (
          <p className="text-subtle mt-4 text-sm">Chuc nang nay chi hoat dong khi nguon du lieu la Firebase.</p>
        ) : null}
        {scanError ? <p className="mt-4 text-sm text-rose-300">{scanError}</p> : null}

        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          <div className="summary-grid">
            <div><span>Dang hien thi</span><strong>{visibleDevices.length}</strong></div>
            <div><span>Trong Firebase</span><strong>{scanResult?.firebaseDevices.length ?? "-"}</strong></div>
          </div>
          <div className="summary-grid">
            <div><span>Node moi</span><strong>{scanResult?.newDevices.length ?? "-"}</strong></div>
            <div><span>Da thay doi</span><strong>{scanResult?.changedDevices.length ?? "-"}</strong></div>
          </div>
          <div className="summary-grid">
            <div><span>Khong con tren Firebase</span><strong>{scanResult?.missingDevices.length ?? "-"}</strong></div>
            <div><span>Lan quet</span><strong>{scanResult ? new Date(scanResult.scannedAt).toLocaleTimeString("vi-VN") : "-"}</strong></div>
          </div>
        </div>

        {scanResult ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <DeviceScanList title="Node moi" devices={scanResult.newDevices} emptyText="Khong phat hien node moi." />
            <DeviceScanList title="Node da thay doi" devices={scanResult.changedDevices} emptyText="Khong co metadata khac biet." />
            <DeviceScanList title="Thiet bi thieu tren Firebase" devices={scanResult.missingDevices} emptyText="Khong co thiet bi thieu." />
          </div>
        ) : null}
      </section>

      <section className="glass-panel p-5">
        <h2 className="mb-4 text-lg font-semibold">Ket noi he thong</h2>
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-muted text-sm">Nguon dang chon</dt>
            <dd className="mt-1 font-semibold">{dataSource === "firebase" ? "firebase" : "websocket/api"}</dd>
          </div>
          <div>
            <dt className="text-muted text-sm">REST API</dt>
            <dd className="mt-1 break-all font-semibold">{env.apiUrl}</dd>
          </div>
          <div>
            <dt className="text-muted text-sm">WebSocket</dt>
            <dd className="mt-1 break-all font-semibold">{env.socketUrl}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

function DeviceScanList({ title, devices, emptyText }: { title: string; devices: Device[]; emptyText: string }) {
  return (
    <div className="scan-result-panel">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="soft-badge rounded-lg px-3 py-1 text-xs">{devices.length}</span>
      </div>
      <div className="grid gap-2">
        {devices.length ? devices.map((device) => (
          <div key={device.deviceId} className="glass-row rounded-lg px-3 py-2">
            <p className="truncate text-sm font-semibold">{device.name}</p>
            <p className="text-subtle truncate text-xs">{device.deviceId}</p>
            <p className="text-muted mt-1 truncate text-xs">{device.location}</p>
          </div>
        )) : <p className="text-subtle text-sm">{emptyText}</p>}
      </div>
    </div>
  );
}
