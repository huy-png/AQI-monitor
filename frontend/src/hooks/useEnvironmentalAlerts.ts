import { useEffect, useState } from "react";
import type { AlertItem } from "../types/dashboard";
import { loadEnvironmentalAlerts, readEnvironmentalAlert } from "../services/api";
import { describeApiError } from "../services/apiError";
export function useEnvironmentalAlerts() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    async function refresh() {
      try {
        const rows = await loadEnvironmentalAlerts();
        if (active) { setAlerts(rows); setError(null); }
      } catch (cause) { if (active) setError(describeApiError(cause, "Chưa tải được cảnh báo môi trường")); }
      finally { if (active) { setLoading(false); timer = window.setTimeout(() => void refresh(), 5000); } }
    }
    void refresh();
    return () => { active = false; window.clearTimeout(timer); };
  }, []);
  async function markRead(id: string) {
    try {
      await readEnvironmentalAlert(id);
      setAlerts(current => current.map(alert => alert.id === id ? { ...alert, read: true } : alert));
    } catch { setError("Chưa lưu được trạng thái đã đọc. Vui lòng thử lại."); }
  }
  return { alerts, error, loading, markRead };
}
