import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { AlertItem } from "../../types/dashboard";
import { formatTime } from "../../utils/format";

export function AlertsPanel({ alerts }: { alerts: AlertItem[] }) {
  if (alerts.length === 0) {
    return (
      <section className="glass-card p-5">
        <h2 className="text-xl font-bold">Cảnh báo</h2>
        <div className="text-muted mt-5 flex items-center gap-3">
          <CheckCircle2 className="text-limeCore" aria-hidden="true" />
          Không có cảnh báo mới
        </div>
      </section>
    );
  }

  return (
    <section className="glass-card p-5">
      <h2 className="text-xl font-bold">Cảnh báo</h2>
      <div className="mt-4 grid gap-3">
        {alerts.map((alert) => (
          <article key={alert.id} className="alert-card rounded-lg p-3">
            <div className="flex gap-3">
              <AlertTriangle className={alert.severity === "critical" ? "text-rose-300" : "text-amber-300"} aria-hidden="true" />
              <div>
                <h3 className="font-semibold">{alert.title}</h3>
                <p className="text-muted mt-1 text-sm">{alert.message}</p>
                <p className="text-subtle mt-2 text-xs">{formatTime(alert.createdAt)}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
