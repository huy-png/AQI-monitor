import { useEnvironmentalAlerts } from "../../hooks/useEnvironmentalAlerts";
import {
  Activity,
  BarChart3,
  Bell,
  FileText,
  History,
  Home,
  Map,
  MapPin,
  Router,
  Settings,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

const navItems = [
  { to: "/", label: "Tổng quan", icon: Home },
  { to: "/devices", label: "Thiết bị & trạm", icon: Router },
  { to: "/analysis", label: "Phân tích dữ liệu", icon: BarChart3 },
  { to: "/history", label: "Chất lượng dữ liệu", icon: History },
  { to: "/alerts", label: "Cảnh báo môi trường", icon: Bell },
  { to: "/reports", label: "Báo cáo", icon: FileText },
  { to: "/map", label: "Bản đồ", icon: Map },
  { to: "/settings", label: "Cài đặt", icon: Settings },
];

export function AppShell() {
  const isMap = useLocation().pathname === "/map";
  const { alerts, error: alertError } = useEnvironmentalAlerts();
  const unread = alerts.filter(alert => !alert.read).length;
  const [menuOpen, setMenuOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    try { return window.sessionStorage.getItem("climasense:alert-banner-dismissed") === "true"; }
    catch { return false; }
  });
  const dismissBanner = () => {
    setBannerDismissed(true);
    try { window.sessionStorage.setItem("climasense:alert-banner-dismissed", "true"); }
    catch { /* Keep dismissal in memory when browser storage is unavailable. */ }
  };
  return (
    <div className="monitor-shell monitor-shell-flat">
      <aside
        className={`glass-sidebar monitor-sidebar p-3 ${menuOpen ? "menu-open" : ""}`}
      >
        <div className="flex items-center gap-3 px-2 py-4">
          <div className="brand-mark grid h-11 w-11 place-items-center rounded-lg text-cyanCore">
            <Activity size={24} aria-hidden="true" />
          </div>
          <div className="text-2xl font-bold tracking-normal">
            Quan<span className="text-cyanCore">Trac</span>
          </div>
          <button
            type="button"
            className="monitor-menu-button"
            aria-label={menuOpen ? "Đóng menu" : "Mở menu"}
            aria-expanded={menuOpen}
            aria-controls="main-navigation"
            onClick={() => setMenuOpen((value) => !value)}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav
          id="main-navigation"
          className="mt-4 grid gap-2"
          aria-label="Điều hướng chính"
        >
          {navItems.map((item) => (
            <NavLink
              key={`${item.label}-${item.to}`}
              to={item.to}
              end={item.to === "/"}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `nav-link flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm transition ${
                  isActive ? "is-active border-l-4 border-cyanCore" : ""
                }`
              }
            >
              <item.icon size={21} aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="location-card mt-6 rounded-lg p-3 lg:mt-10">
          <div className="flex items-center gap-3">
            <MapPin className="text-limeCore" size={22} aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold">Quan trắc không khí</p>
              <p className="text-muted text-xs">QCVN 05:2023/BTNMT</p>
            </div>
          </div>
        </div>
      </aside>
      <main className={`monitor-main min-w-0 ${isMap ? "monitor-main-map" : ""}`}>
        {unread > 0 && !bannerDismissed && <div role="status" className="environment-alert-banner environment-alert-dismissible">
          <NavLink to="/alerts">{unread} cảnh báo chưa đọc · {alerts.find(alert => !alert.read)?.title} → Xem cảnh báo</NavLink>
          <button type="button" className="environment-alert-close" aria-label="Ẩn thanh cảnh báo trong phiên này" title="Ẩn trong phiên này" onClick={dismissBanner}><X size={18} aria-hidden="true" /></button>
        </div>}
        {alertError && <p role="status" className="environment-alert-banner">{alertError}</p>}
        <Outlet />
      </main>
    </div>
  );
}
