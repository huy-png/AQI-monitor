import { Download, FileText, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useDashboardData } from "../hooks/useDashboardData";
import { loadReportReadings } from "../services/api";
import type { ClimateReading } from "@climasense/shared";

type ReportPeriod = "24h" | "7d" | "30d" | "all" | "custom";

function csvCell(value: string | number) {
  return `"${String(value).split('"').join('""')}"`;
}

export function ReportsPage() {
  const { data, isLoading } = useDashboardData("30d");
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [period, setPeriod] = useState<ReportPeriod>("30d");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [readings, setReadings] = useState<ClimateReading[]>([]);
  const [isLoadingReport, setIsLoadingReport] = useState(false);

  useEffect(() => {
    if (data?.devices.length && selectedDevices.length === 0) setSelectedDevices(data.devices.map((device) => device.deviceId));
  }, [data?.devices, selectedDevices.length]);

  useEffect(() => {
    if (selectedDevices.length === 0) {
      setReadings([]);
      return;
    }
    let active = true;
    setIsLoadingReport(true);
    loadReportReadings(selectedDevices)
      .then((items) => { if (active) setReadings(items); })
      .finally(() => { if (active) setIsLoadingReport(false); });
    return () => { active = false; };
  }, [selectedDevices]);

  const filteredReadings = useMemo(() => {
    if (period === "all") return readings;
    const now = new Date();
    let start: Date;
    if (period === "custom") {
      start = fromDate ? new Date(`${fromDate}T00:00:00`) : new Date(0);
      const end = toDate ? new Date(`${toDate}T23:59:59`) : now;
      return readings.filter((item) => { const date = new Date(item.timestamp); return date >= start && date <= end; });
    }
    const hours = period === "24h" ? 24 : period === "7d" ? 24 * 7 : 24 * 30;
    start = new Date(now.getTime() - hours * 60 * 60 * 1000);
    return readings.filter((item) => new Date(item.timestamp) >= start);
  }, [fromDate, period, readings, toDate]);

  function toggleDevice(deviceId: string) {
    setSelectedDevices((current) => current.includes(deviceId) ? current.filter((id) => id !== deviceId) : [...current, deviceId]);
  }

  function downloadReport() {
    const header = ["timestamp", "deviceId", "temperature_c", "humidity_pct", "pressure_hpa", "air_quality", "rainfall_mm", "wind_speed_kmh"];
    const rows = [header, ...filteredReadings.map((item) => [item.timestamp, item.deviceId, item.temperature, item.humidity, item.pressure, item.airQuality, item.rainfall, item.windSpeed])];
    const csv = `\ufeff${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
    const url = window.URL.createObjectURL(new window.Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `bao-cao-quan-trac-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  return (
    <div className="dashboard-page grid gap-4 p-4 xl:p-5">
      <div className="page-heading"><div><p className="eyebrow">Kết xuất dữ liệu</p><h1 className="page-title">Báo cáo quan trắc</h1><p className="text-muted mt-1 text-sm">Chọn thiết bị và khoảng thời gian trước khi tải dữ liệu.</p></div><FileText className="text-cyanCore" size={28} aria-hidden="true" /></div>
      {isLoading || !data ? <p className="text-muted">Đang chuẩn bị báo cáo...</p> : <>
        <section className="report-filters glass-panel">
          <div className="filter-section"><div className="filter-label"><span>Thiết bị / trạm</span><button type="button" className="text-button" onClick={() => setSelectedDevices(data.devices.map((device) => device.deviceId))}>Chọn tất cả</button></div><div className="device-picker">{data.devices.map((device) => <label key={device.deviceId} className="device-option"><input type="checkbox" checked={selectedDevices.includes(device.deviceId)} onChange={() => toggleDevice(device.deviceId)} /><span><strong>{device.name}</strong><small>{device.deviceId}</small></span></label>)}</div></div>
          <div className="filter-section"><label className="filter-label" htmlFor="report-period">Khoảng thời gian</label><select id="report-period" className="glass-select rounded-lg px-3 py-2" value={period} onChange={(event) => setPeriod(event.target.value as ReportPeriod)}><option value="24h">24 giờ qua</option><option value="7d">7 ngày qua</option><option value="30d">30 ngày qua</option><option value="all">Toàn bộ dữ liệu</option><option value="custom">Tùy chọn ngày</option></select>{period === "custom" ? <div className="date-picker"><label>Từ <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label><label>Đến <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label></div> : null}</div>
        </section>
        <section className="report-panel glass-panel"><div><h2 className="section-title">Bản xuất dữ liệu</h2><p className="text-muted mt-1 text-sm">{selectedDevices.length} thiết bị · {filteredReadings.length} bản ghi phù hợp</p></div><button className="primary-glass-button inline-flex min-h-11 items-center gap-2 rounded-lg px-4 font-semibold" onClick={downloadReport} disabled={isLoadingReport || filteredReadings.length === 0}><Download size={18} aria-hidden="true" />{isLoadingReport ? "Đang tải dữ liệu..." : "Tải CSV"}</button></section>
        {isLoadingReport ? <div className="text-muted flex items-center gap-2 text-sm"><RefreshCw className="animate-spin" size={15} />Đang tải dữ liệu từ các thiết bị đã chọn...</div> : null}
      </>}
    </div>
  );
}
