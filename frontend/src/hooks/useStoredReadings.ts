import { useEffect, useState } from "react";
import type { ClimateReading } from "@climasense/shared";
import { loadReportReadings } from "../services/api";
import { describeApiError } from "../services/apiError";

export function useStoredReadings(deviceIds: string[], days = 1, range?: { from: string; to: string }, archiveOnly = false) {
  const from = range?.from;
  const to = range?.to;
  const key = [...deviceIds].sort().join(",");
  const [readings, setReadings] = useState<ClimateReading[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    setReadings([]);
    setLoadedAt(null);
    setError(null);
    setLoading(false);
    async function refresh() {
      if (!key) return;
      setLoading(true);
      try {
        const items = await loadReportReadings(key.split(","), { from: from ?? new Date(Date.now() - days * 86400000).toISOString(), to: to ?? new Date().toISOString() }, archiveOnly);
        if (active) { setReadings(items); setError(null); setLoadedAt(new Date().toISOString()); }
      } catch (cause) {
        if (active) setError(describeApiError(cause, "Chưa tải được lịch sử"));
      } finally {
        if (active) { setLoading(false); timer = window.setTimeout(() => void refresh(), 30000); }
      }
    }
    void refresh();
    return () => { active = false; window.clearTimeout(timer); };
  }, [key, days, from, to, archiveOnly]);
  return { readings, error, loading, loadedAt };
}
