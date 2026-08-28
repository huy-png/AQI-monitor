import { Wifi } from "lucide-react";

export function StatusPill({ connected }: { connected: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="soft-badge inline-flex items-center gap-2 rounded-lg px-3 py-2">
        <span className={`h-3 w-3 rounded-full ${connected ? "animate-pulse bg-limeCore" : "bg-rose-400"}`} />
        {connected ? "Trực tiếp" : "Mất kết nối"}
      </span>
      <span className="glass-divider hidden h-7 w-px md:block" />
      <span className="inline-flex items-center gap-2 text-limeCore">
        <Wifi size={19} aria-hidden="true" />
        {connected ? "Đã kết nối" : "Đang kết nối lại"}
      </span>
    </div>
  );
}
