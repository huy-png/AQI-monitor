import { Activity, BarChart3, Bell, FileText, History, Home, Map, MapPin, Router, Settings } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { to: "/", label: "Tong quan", icon: Home },
  { to: "/devices", label: "Thiet bi & tram", icon: Router },
  { to: "/analysis", label: "Phan tich du lieu", icon: BarChart3 },
  { to: "/history", label: "Lich su quan trac", icon: History },
  { to: "/alerts", label: "Canh bao moi truong", icon: Bell },
  { to: "/reports", label: "Bao cao", icon: FileText },
  { to: "/map", label: "Ban do", icon: Map },
  { to: "/settings", label: "Cai dat", icon: Settings }
];

export function AppShell() {
  return (
    <div className="app-root min-h-screen p-2 md:p-3">
      <div className="app-frame grid min-h-[calc(100vh-1rem)] gap-3 p-3 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="glass-sidebar p-3 lg:min-h-full">
          <div className="flex items-center gap-3 px-2 py-4">
            <div className="brand-mark grid h-11 w-11 place-items-center rounded-lg text-cyanCore">
              <Activity size={24} aria-hidden="true" />
            </div>
            <div className="text-2xl font-bold tracking-normal">
              Quan<span className="text-cyanCore">Trac</span>
            </div>
          </div>

          <nav className="mt-4 grid gap-2" aria-label="Dieu huong chinh">
            {navItems.map((item) => (
              <NavLink
                key={`${item.label}-${item.to}`}
                to={item.to}
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
                <p className="text-sm font-semibold">Tram DLT-01</p>
                <p className="text-muted text-xs">Da Lat · Dang giam sat</p>
              </div>
            </div>
          </div>
        </aside>
        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
