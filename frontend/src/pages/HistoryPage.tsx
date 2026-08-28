import { History as HistoryIcon } from "lucide-react";
import { useDashboardData } from "../hooks/useDashboardData";
import { formatTime } from "../utils/format";

export function HistoryPage() {
  const { data, isLoading } = useDashboardData("24h");
  const readings = data ? Object.values(data.deviceReadings).sort((first, second) => first.deviceId.localeCompare(second.deviceId)) : [];

  return (
    <div className="dashboard-page grid gap-4 p-4 xl:p-5">
      <div className="page-heading"><div><p className="eyebrow">Snapshot hiện tại</p><h1 className="page-title">Lịch sử quan trắc</h1><p className="text-muted mt-1 text-sm">Firebase hiện chỉ lưu bản ghi `latest` của từng thiết bị.</p></div><HistoryIcon className="text-cyanCore" size={28} aria-hidden="true" /></div>
      {isLoading || !data ? <p className="text-muted">Đang tải dữ liệu...</p> : <section className="glass-card overflow-hidden"><div className="table-heading"><h2 className="section-title">Bản ghi mới nhất của toàn bộ thiết bị</h2><span className="data-badge">{readings.length} thiết bị</span></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Thiết bị</th><th>Thời gian</th><th>Nhiệt độ</th><th>Độ ẩm</th><th>Áp suất</th><th>AQI</th><th>Gió</th></tr></thead><tbody>{readings.map((item) => <tr key={item.deviceId}><td className="font-semibold text-primary">{item.deviceId}</td><td>{formatTime(item.timestamp)}</td><td>{item.temperature.toFixed(1)}°C</td><td>{item.humidity.toFixed(1)}%</td><td>{item.pressure.toFixed(0)} hPa</td><td>{item.airQuality.toFixed(0)}</td><td>{item.windSpeed.toFixed(1)} km/h</td></tr>)}</tbody></table></div></section>}
    </div>
  );
}
