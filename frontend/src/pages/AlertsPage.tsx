import { AlertTriangle, BellRing, CheckCircle2 } from "lucide-react";
import { AlertsPanel } from "../components/dashboard/AlertsPanel";
import { useDashboardData } from "../hooks/useDashboardData";

export function AlertsPage() {
  const { data, isLoading } = useDashboardData("24h");
  const alerts = data?.alerts ?? [];
  const active = alerts.filter((item) => !item.read).length;

  return (
    <div className="dashboard-page grid gap-4 p-4 xl:p-5">
      <div className="page-heading"><div><p className="eyebrow">Giám sát rủi ro</p><h1 className="page-title">Cảnh báo môi trường</h1><p className="text-muted mt-1 text-sm">Các sự kiện cần theo dõi từ trạm quan trắc.</p></div><BellRing className="text-cyanCore" size={28} aria-hidden="true" /></div>
      {isLoading ? <p className="text-muted">Đang tải cảnh báo...</p> : <>
        <div className="insight-grid">
          <div className="glass-card insight-card"><AlertTriangle className="text-amber-300" size={22} /><span>Chưa xử lý</span><strong>{active}</strong></div>
          <div className="glass-card insight-card"><CheckCircle2 className="text-limeCore" size={22} /><span>Tổng sự kiện</span><strong>{alerts.length}</strong></div>
        </div>
        <AlertsPanel alerts={alerts} />
      </>}
    </div>
  );
}
