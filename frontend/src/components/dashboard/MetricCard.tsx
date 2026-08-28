import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  unit?: string;
  helper?: string;
  tone?: "cyan" | "lime" | "slate";
  icon: LucideIcon;
}

export function MetricCard({ title, value, unit, helper, tone = "cyan", icon: Icon }: MetricCardProps) {
  const color = tone === "lime" ? "text-limeCore" : tone === "cyan" ? "text-cyanCore" : "text-primary";

  return (
    <article className="glass-card metric-card p-4 transition hover:-translate-y-0.5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-muted">{title}</h3>
        <div className={`metric-icon grid h-9 w-9 place-items-center rounded-lg ${color}`}>
          <Icon size={18} aria-hidden="true" />
        </div>
      </div>
      <div className="flex items-end gap-2">
        <span className={`text-3xl font-bold leading-none ${color}`}>{value}</span>
        {unit ? <span className="text-muted pb-0.5 text-sm">{unit}</span> : null}
      </div>
      {helper ? <p className="text-subtle mt-3 text-xs">{helper}</p> : null}
    </article>
  );
}
