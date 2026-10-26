import { usePageState } from "../hooks/usePageState";
import { useEffect, useState } from "react";
import type { AlertSettings } from "@climasense/shared";
import { loadAlertSettings } from "../services/api";
import { useStoredReadings } from "../hooks/useStoredReadings";
import { AirQualityChart } from "../components/charts/AirQualityChart";
import { useSearchParams } from "react-router-dom";
import { metrics, type MetricKey } from "../config/metrics";
import { useDashboardData } from "../hooks/useDashboardData";
import { analysisDayRange, vietnamDate } from "../utils/analysisTime";

export function AnalysisPage() {
  const { data, isLoading, error } = useDashboardData("24h");
  const [params] = useSearchParams();
  const [selection, setSelection] = usePageState("device", params.get("device") ?? "");
  const [metric, setMetric] = usePageState<MetricKey>("metric", "pm25");
  const [day, setDay] = usePageState("analysis-day", vietnamDate());
  const [alertSettings, setAlertSettings] = useState<AlertSettings | null>(null);
  const [thresholdError, setThresholdError] = useState(false);
  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    async function refresh() {
      try {
        const settings = await loadAlertSettings();
        if (active) { setAlertSettings(settings); setThresholdError(false); }
      } catch {
        if (active) { setAlertSettings(null); setThresholdError(true); }
      } finally {
        if (active) timer = window.setTimeout(() => void refresh(), 30000);
      }
    }
    void refresh();
    return () => { active = false; window.clearTimeout(timer); };
  }, []);
  const linkedDevice = params.get("device");
  useEffect(() => {
    if (linkedDevice) setSelection(linkedDevice);
  }, [linkedDevice, setSelection]);
  const devices = data?.devices ?? [];
  const deviceId = devices.some((device) => device.deviceId === selection)
    ? selection
    : (devices[0]?.deviceId ?? "");
  const dayRange = analysisDayRange(day);
  const stored = useStoredReadings(deviceId ? [deviceId] : [], 1, dayRange);
  const readings = stored.readings.filter(reading => {
    const timestamp = Date.parse(reading.timestamp);
    return timestamp >= dayRange.start && timestamp < dayRange.end;
  });
  return (
    <div className="monitor-dashboard monitor-subpage">
      <div>
        <p className="eyebrow">Trung tâm phân tích</p>
        <h1 className="page-title">Phân tích chất lượng không khí</h1>
        <p className="text-muted mt-1 text-sm">
          Theo dõi bụi, chất khí và điều kiện khí tượng của từng thiết bị.
        </p>
      </div>
      {(isLoading || stored.loading) && (
        <p className="text-muted" role="status">
          Đang tải dữ liệu…
        </p>
      )}
      {(error || stored.error) && (
        <p className="air-data-notice" role="alert">
          {stored.error ?? "Chưa tải được dữ liệu quan trắc."}
        </p>
      )}
      <div className="monitor-filter-row">
        <label>
          Ngày xem dữ liệu (UTC+7)
          <input type="date" value={day} max={vietnamDate()} onChange={event => {
            if (event.target.value && Number.isFinite(Date.parse(`${event.target.value}T00:00:00+07:00`))) setDay(event.target.value);
          }} />
        </label>
        <label>
          Thiết bị
          <select
            value={deviceId}
            onChange={(e) => setSelection(e.target.value)}
            disabled={!devices.length}
          >
            {!devices.length && <option value="">Chưa có thiết bị</option>}
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.deviceId}
              </option>
            ))}
          </select>
        </label>
      </div>
      <AirQualityChart
        key={`${deviceId}-${day}`}
        visibleMetrics={metrics}
        selectedKey={metric}
        onSelect={setMetric}
        readings={readings}
        analysisDay={day}
        alertSettings={alertSettings}
        thresholdError={thresholdError}
      />
    </div>
  );
}
