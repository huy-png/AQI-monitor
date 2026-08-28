import { Activity, ArrowDownRight, ArrowUpRight, CloudSun } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ClimateChart } from "../components/charts/ClimateChart";
import { DeviceOverviewGrid } from "../components/dashboard/DeviceOverviewGrid";
import { ForecastPanel } from "../components/dashboard/ForecastPanel";
import { useDashboardData } from "../hooks/useDashboardData";

export function AnalysisPage() {
  const [range, setRange] = useState<"24h" | "7d" | "30d">("24h");
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const { data, history, isLoading } = useDashboardData(range);

  useEffect(() => {
    if (data?.devices.length && (!selectedDeviceId || !data.deviceReadings[selectedDeviceId])) setSelectedDeviceId(data.devices[0].deviceId);
  }, [data, selectedDeviceId]);

  const selectedHistory = useMemo(() => history.filter((item) => item.deviceId === selectedDeviceId), [history, selectedDeviceId]);
  const current = data?.deviceReadings[selectedDeviceId] ?? selectedHistory.at(-1);
  const previous = selectedHistory.at(-2) ?? current;
  const temperatureChange = current && previous ? current.temperature - previous.temperature : 0;

  return (
    <div className="dashboard-page grid gap-4 p-4 xl:p-5">
      <div className="page-heading"><div><p className="eyebrow">Trung tâm phân tích</p><h1 className="page-title">Phân tích dữ liệu quan trắc</h1><p className="text-muted mt-1 text-sm">So sánh node và theo dõi xu hướng theo từng thiết bị.</p></div><Activity className="text-cyanCore" size={28} aria-hidden="true" /></div>
      {isLoading || !data || !current ? <p className="text-muted">Đang tải dữ liệu phân tích...</p> : <>
        <DeviceOverviewGrid devices={data.devices} readings={data.deviceReadings} selectedDeviceId={selectedDeviceId} onSelect={setSelectedDeviceId} />
        <div className="insight-grid">
          <div className="glass-card insight-card"><CloudSun className="text-cyanCore" size={22} /><span>Xu hướng {selectedDeviceId}</span><strong>{temperatureChange >= 0 ? "Tăng" : "Giảm"} {Math.abs(temperatureChange).toFixed(1)}°C</strong>{temperatureChange >= 0 ? <ArrowUpRight className="text-amber-300" size={18} /> : <ArrowDownRight className="text-cyanCore" size={18} />}</div>
          <div className="glass-card insight-card"><Activity className="text-limeCore" size={22} /><span>Thiết bị đang phân tích</span><strong>{selectedDeviceId}</strong><span className="text-subtle text-xs">{selectedHistory.length} bản ghi trong bộ nhớ phiên</span></div>
        </div>
        <div className="analysis-grid"><ClimateChart data={selectedHistory.length ? selectedHistory : [current]} range={range} onRangeChange={setRange} /><ForecastPanel latest={current} history={selectedHistory.length ? selectedHistory : [current]} /></div>
      </>}
    </div>
  );
}
