import {
  Activity,
  CalendarDays,
  CloudRain,
  Droplets,
  Gauge,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Thermometer,
  Wind
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ClimateChart } from "../components/charts/ClimateChart";
import { AlertsPanel } from "../components/dashboard/AlertsPanel";
import { DeviceStatusList } from "../components/dashboard/DeviceStatusList";
import { DeviceOverviewGrid } from "../components/dashboard/DeviceOverviewGrid";
import { ForecastPanel } from "../components/dashboard/ForecastPanel";
import { MetricCard } from "../components/dashboard/MetricCard";
import { StatusPill } from "../components/dashboard/StatusPill";
import { Skeleton } from "../components/ui/Skeleton";
import { useDashboardData } from "../hooks/useDashboardData";
import { aqiLabel, formatTime } from "../utils/format";

export function DashboardPage() {
  const [range, setRange] = useState<"24h" | "7d" | "30d">("24h");
  const { data, history, isLoading, error } = useDashboardData(range);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");

  useEffect(() => {
    if (data?.devices.length && (!selectedDeviceId || !data.deviceReadings[selectedDeviceId])) {
      setSelectedDeviceId(data.devices[0].deviceId);
    }
  }, [data, selectedDeviceId]);

  const temperatureBounds = useMemo(() => {
    const values = history.map((item) => item.temperature);
    return { min: Math.min(...values), max: Math.max(...values) };
  }, [history]);

  if (isLoading) {
    return (
      <div className="dashboard-page grid gap-4 p-4">
        <Skeleton className="h-24" />
        <div className="grid gap-4 xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-32" />)}
        </div>
        <Skeleton className="h-[28rem]" />
      </div>
    );
  }

  if (error || !data?.latest) {
    return (
      <div className="grid min-h-[70vh] place-items-center p-6">
        <div className="empty-state max-w-xl rounded-xl p-8 text-center">
          <Activity className="mx-auto text-cyanCore" size={36} aria-hidden="true" />
          <h1 className="mt-4 text-2xl font-bold">Chưa nhận được dữ liệu quan trắc</h1>
          <p className="text-muted mt-2">{error ?? "Trạm chưa gửi bản ghi khí hậu nào."}</p>
        </div>
      </div>
    );
  }

  const { latest } = data;
  const selectedLatest = data.deviceReadings[selectedDeviceId] ?? latest;
  const qualityLabel = aqiLabel(latest.airQuality);

  return (
    <div className="dashboard-page grid gap-4 p-4 xl:p-5">
      <header className="dashboard-header">
        <div className="flex min-w-0 items-center gap-4">
          <div className="station-icon grid h-12 w-12 shrink-0 place-items-center rounded-xl">
            <Activity size={25} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="truncate text-2xl font-bold tracking-tight md:text-3xl">Trạm quang trắc Đà Lạt</h1>
              <span className="station-code">{selectedLatest.deviceId}</span>
            </div>
            <p className="text-muted mt-1 flex items-center gap-2 text-sm">
              <MapPin size={15} aria-hidden="true" /> Khu vực cao nguyên · Quan trắc khí hậu và môi trường
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="last-sync">
            <RefreshCw size={14} aria-hidden="true" />
            <span>Cập nhật {formatTime(data.lastUpdated)}</span>
          </div>
          <StatusPill connected={data.connected} />
          <label className="device-select-label"><span>Thiết bị đang xem</span><select className="glass-select rounded-lg px-3 py-2" value={selectedDeviceId} onChange={(event) => setSelectedDeviceId(event.target.value)}>{data.devices.map((device) => <option key={device.deviceId} value={device.deviceId}>{device.deviceId}</option>)}</select></label>
          <button className="icon-button" title="Làm mới dữ liệu" aria-label="Làm mới dữ liệu">
            <RefreshCw size={18} aria-hidden="true" />
          </button>
        </div>
      </header>

      <section className="notice-strip flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <ShieldCheck className="text-limeCore" size={20} aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">Trạng thái quan trắc ổn định</p>
            <p className="text-subtle text-xs">Tất cả chỉ số đang trong ngưỡng theo dõi thông thường</p>
          </div>
        </div>
        <span className="text-limeCore text-sm font-semibold">AQI {qualityLabel}</span>
      </section>

      <section className="kpi-grid" aria-label="Chỉ số quan trắc hiện tại">
        <MetricCard title="Nhiệt độ" value={selectedLatest.temperature.toFixed(1)} unit="°C" icon={Thermometer} helper="Cảm giác dễ chịu" />
        <MetricCard title="Độ ẩm tương đối" value={selectedLatest.humidity.toFixed(1)} unit="%" icon={Droplets} tone="lime" helper="Độ ẩm không khí" />
        <MetricCard title="Chất lượng không khí" value={selectedLatest.airQuality.toFixed(0)} unit="AQI" icon={Activity} helper={aqiLabel(selectedLatest.airQuality)} tone="lime" />
        <MetricCard title="Áp suất khí quyển" value={selectedLatest.pressure.toFixed(0)} unit="hPa" icon={Gauge} tone="slate" helper="Mực trạm" />
        <MetricCard title="Tốc độ gió" value={selectedLatest.windSpeed.toFixed(1)} unit="km/h" icon={Wind} helper="Gió trung bình" />
        <MetricCard title="Lượng mưa" value={selectedLatest.rainfall.toFixed(1)} unit="mm" icon={CloudRain} tone="slate" helper="Tích lũy gần nhất" />
      </section>

      <DeviceOverviewGrid devices={data.devices} readings={data.deviceReadings} selectedDeviceId={selectedDeviceId} onSelect={setSelectedDeviceId} />

      <section className="analysis-grid">
        <ClimateChart data={history} range={range} onRangeChange={setRange} />
        <ForecastPanel latest={latest} history={history} />
      </section>

      <section className="bottom-grid">
        <div className="glass-card p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Tóm tắt trạm</p>
              <h2 className="section-title">Tình hình quan trắc</h2>
            </div>
            <CalendarDays className="text-cyanCore" size={21} aria-hidden="true" />
          </div>
          <div className="summary-grid">
            <div><span>Nhiệt độ thấp nhất</span><strong>{temperatureBounds.min.toFixed(1)}°C</strong></div>
            <div><span>Nhiệt độ cao nhất</span><strong>{temperatureBounds.max.toFixed(1)}°C</strong></div>
            <div><span>Số thiết bị</span><strong>{data.devices.length}</strong></div>
            <div><span>Bản ghi hiển thị</span><strong>{history.length}</strong></div>
          </div>
        </div>
        <DeviceStatusList devices={data.devices} lastUpdated={data.lastUpdated} />
        <AlertsPanel alerts={data.alerts} />
      </section>
    </div>
  );
}
