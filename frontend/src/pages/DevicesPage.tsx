import { Router } from "lucide-react";
import { DeviceOverviewGrid } from "../components/dashboard/DeviceOverviewGrid";
import { DeviceStatusList } from "../components/dashboard/DeviceStatusList";
import { useDashboardData } from "../hooks/useDashboardData";

export function DevicesPage() {
  const { data, isLoading } = useDashboardData("24h");

  return (
    <div className="dashboard-page grid gap-4 p-4 xl:p-5">
      <div className="page-heading"><div><p className="eyebrow">Mạng lưới quan trắc</p><h1 className="page-title">Thiết bị & trạm</h1><p className="text-muted mt-1 text-sm">Theo dõi trạng thái và số liệu mới nhất của từng node.</p></div><Router className="text-cyanCore" size={28} aria-hidden="true" /></div>
      {isLoading || !data ? <p className="text-muted">Đang tải thiết bị...</p> : <>
        <DeviceOverviewGrid devices={data.devices} readings={data.deviceReadings} selectedDeviceId="" onSelect={() => undefined} />
        <DeviceStatusList devices={data.devices} lastUpdated={data.lastUpdated} />
      </>}
    </div>
  );
}
