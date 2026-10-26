import { usePageState } from "../hooks/usePageState";
import { AlertTriangle, BellRing, CheckCircle2 } from "lucide-react";
import { AlertsPanel } from "../components/dashboard/AlertsPanel";
import { useEnvironmentalAlerts } from "../hooks/useEnvironmentalAlerts";
import { Link } from "react-router-dom";
import { alertMetrics } from "@climasense/shared";

export function AlertsPage() {
  const { alerts, loading: isLoading, error, markRead } = useEnvironmentalAlerts();
  const [filter, setFilter] = usePageState("event-filter", "all");
  const [metric, setMetric] = usePageState("metric", "all");
  const filteredAlerts = alerts.filter(item =>
    (metric === "all" || item.metric === metric) &&
    (filter === "all" || (filter === "unread" ? !item.read : item.severity === "critical"))
  );
  const active = alerts.filter((item) => !item.read).length;

  return (
    <div className="monitor-dashboard monitor-subpage">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Giám sát rủi ro</p>
          <h1 className="page-title">Cảnh báo môi trường</h1>
          <p className="text-muted mt-1 text-sm">
            200 cảnh báo gần nhất · Tự cập nhật mỗi 5 giây.
          </p>
        </div>
        <BellRing className="text-cyanCore" size={28} aria-hidden="true" />
      </div>
      <Link to="/settings#alert-settings" className="text-cyanCore">Cài đặt ngưỡng và thời gian biến động →</Link>
      {error && (
        <p role="alert" className="monitor-notice">
          {error}
        </p>
      )}
      {isLoading ? (
        <p className="text-muted">Đang tải cảnh báo...</p>
      ) : (
        <>
          <div className="insight-grid">
            <div className="glass-card insight-card">
              <AlertTriangle className="text-amber-300" size={22} />
              <span>Chưa đọc</span>
              <strong>{active}</strong>
            </div>
            <div className="glass-card insight-card">
              <CheckCircle2 className="text-limeCore" size={22} />
              <span>Tổng sự kiện</span>
              <strong>{alerts.length}</strong>
            </div>
          </div>
          <div className="monitor-filter-row">
            <label>
              Thông số cảnh báo
              <select value={metric} onChange={e => setMetric(e.target.value)}>
                <option value="all">Tất cả thông số</option>
                {alertMetrics.map(item => (
                  <option key={item.key} value={item.key}>{item.label}</option>
                ))}
              </select>
            </label>
            <label>
              Lọc sự kiện
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">Tất cả sự kiện</option>
                <option value="unread">Chưa đọc</option>
                <option value="critical">Nghiêm trọng</option>
              </select>
            </label>
          </div>
          <p className="text-muted text-sm" role="status">
            Hiển thị {filteredAlerts.length} / {alerts.length} cảnh báo gần nhất.
          </p>
          {filteredAlerts.length ? (
            <AlertsPanel onRead={markRead} alerts={filteredAlerts} />
          ) : (
            <p className="monitor-notice">Không có cảnh báo phù hợp với bộ lọc đã chọn.</p>
          )}
        </>
      )}
    </div>
  );
}
