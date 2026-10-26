import { DataHealthPanel } from "../components/dashboard/DataHealthPanel";
import { getRuntimeDataSource } from "../services/dataSource";
import { RadioTower } from "lucide-react";
import { useDashboardData } from "../hooks/useDashboardData";

export function DevicesPage() {
  const { data, isLoading, error } = useDashboardData("24h");
  return (
    <div className="monitor-dashboard monitor-subpage">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Mạng lưới quan trắc</p>
          <h1 className="page-title">Thiết bị & trạm</h1>
          <p className="text-muted mt-1 text-sm">Giám sát kết nối, tuổi bản ghi và độ đầy đủ dữ liệu của từng trạm.</p>
        </div>
        <RadioTower size={24} />
      </header>
      {error && <p role="alert" className="monitor-notice">{error}</p>}
      <DataHealthPanel devices={data?.devices ?? []} readings={data?.deviceReadings ?? {}}
        loading={isLoading} connected={Boolean(data?.connected) && !error}
        serverMode={getRuntimeDataSource() === "api"} />
    </div>
  );
}
