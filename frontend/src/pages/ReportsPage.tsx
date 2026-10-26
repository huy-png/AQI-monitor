import { usePageState } from "../hooks/usePageState";
import { ReportDevicePicker } from "../components/dashboard/ReportDevicePicker";
import { Download, FileText, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useDashboardData } from "../hooks/useDashboardData";
import { loadReportReadings } from "../services/api";
import type { ClimateReading } from "@climasense/shared";
import { metrics, metricValue } from "../config/metrics";
import { formatConcentration } from "../config/pollutants";

type ReportPeriod = "24h" | "7d" | "30d" | "all" | "custom";

function csvCell(value: string | number) {
  return `"${String(value).split('"').join('""')}"`;
}

export function ReportsPage() {
  const { data, isLoading } = useDashboardData("30d");
  const [initialized, setInitialized] = usePageState("initialized", false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [selectedDevices, setSelectedDevices] = usePageState<string[]>("devices", []);
  const [period, setPeriod] = usePageState<ReportPeriod>("period", "30d");
  const [fromDate, setFromDate] = usePageState("from", "");
  const [toDate, setToDate] = usePageState("to", "");
  const [readings, setReadings] = useState<ClimateReading[]>([]);
  const [isLoadingReport, setIsLoadingReport] = useState(false);

  useEffect(() => {
    if (data?.devices.length && !initialized) {
      setInitialized(true);
      setSelectedDevices(data.devices.map((device) => device.deviceId));
    }
  }, [data?.devices, initialized, setInitialized, setSelectedDevices]);

  useEffect(() => {
    if (selectedDevices.length === 0) {
      setReadings([]);
      setIsLoadingReport(false);
      setReportError(null);
      return;
    }
    let active = true;
    setIsLoadingReport(true);
    setReportError(null);
    setReadings([]);
    loadReportReadings(selectedDevices, {
      from: period === "all" ? undefined : period === "custom" ? (fromDate ? new Date(`${fromDate}T00:00:00`).toISOString() : undefined) : new Date(Date.now() - (period === "24h" ? 1 : period === "7d" ? 7 : 30) * 86400000).toISOString(),
      to: period === "custom" && toDate ? new Date(`${toDate}T23:59:59.999`).toISOString() : new Date().toISOString()
    })
      .then((items) => {
        if (active) setReadings(items);
      })
      .catch(() => {
        if (active)
          setReportError(
            "Không tải được dữ liệu báo cáo. Vui lòng chọn lại thiết bị để thử lại.",
          );
      })
      .finally(() => {
        if (active) setIsLoadingReport(false);
      });
    return () => {
      active = false;
    };
  }, [selectedDevices, period, fromDate, toDate]);

  const filteredReadings = useMemo(() => {
    if (period === "all") return readings;
    const now = new Date();
    let start: Date;
    if (period === "custom") {
      start = fromDate ? new Date(`${fromDate}T00:00:00`) : new Date(0);
      const end = toDate ? new Date(`${toDate}T23:59:59.999`) : now;
      return readings.filter((item) => {
        const date = new Date(item.timestamp);
        return date >= start && date <= end;
      });
    }
    const hours = period === "24h" ? 24 : period === "7d" ? 24 * 7 : 24 * 30;
    start = new Date(now.getTime() - hours * 60 * 60 * 1000);
    return readings.filter((item) => new Date(item.timestamp) >= start);
  }, [fromDate, period, readings, toDate]);

  function downloadReport() {
    const header = [
      "timestamp",
      "deviceId",
      ...metrics.map((item) => item.key + " (" + item.unit + ")"),
    ];
    const rows = [
      header,
      ...filteredReadings.map((item) => [
        item.timestamp,
        item.deviceId,
        ...metrics.map(({ key }) => metricValue(item, key) ?? ""),
      ]),
    ];
    const csv = `\ufeff${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
    const url = window.URL.createObjectURL(
      new window.Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `bao-cao-quan-trac-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  return (
    <div className="monitor-dashboard monitor-subpage">
      <p className="text-muted text-xs">Nếu thiết bị chưa gửi thời điểm đo, thời gian bản ghi là lúc backend nhận dữ liệu.</p>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Kết xuất dữ liệu</p>
          <h1 className="page-title">Báo cáo quan trắc</h1>
          <p className="text-muted mt-1 text-sm">
            Báo cáo từ lịch sử đã lưu. Chọn thiết bị và khoảng thời gian cần xuất.
          </p>
        </div>
        <FileText className="text-cyanCore" size={28} aria-hidden="true" />
      </div>
      {isLoading || !data ? (
        <p className="text-muted">Đang chuẩn bị báo cáo...</p>
      ) : (
        <>
          <section className="report-filters glass-panel">
            <ReportDevicePicker
              devices={data.devices}
              selected={selectedDevices}
              onChange={setSelectedDevices}
            />
            <div className="filter-section">
              <label className="filter-label" htmlFor="report-period">
                Khoảng thời gian
              </label>
              <select
                id="report-period"
                className="glass-select rounded-lg px-3 py-2"
                value={period}
                onChange={(event) =>
                  setPeriod(event.target.value as ReportPeriod)
                }
              >
                <option value="24h">24 giờ qua</option>
                <option value="7d">7 ngày qua</option>
                <option value="30d">30 ngày qua</option>
                <option value="all">Toàn bộ dữ liệu</option>
                <option value="custom">Tùy chọn ngày</option>
              </select>
              {period === "custom" ? (
                <div className="date-picker">
                  <label>
                    Từ{" "}
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(event) => setFromDate(event.target.value)}
                    />
                  </label>
                  <label>
                    Đến{" "}
                    <input
                      type="date"
                      value={toDate}
                      onChange={(event) => setToDate(event.target.value)}
                    />
                  </label>
                </div>
              ) : null}
            </div>
          </section>
          <section className="report-panel glass-panel">
            <div>
              <h2 className="section-title">Bản xuất dữ liệu</h2>
              <p className="text-muted mt-1 text-sm">
                {selectedDevices.length} thiết bị · {filteredReadings.length}{" "}
                bản ghi phù hợp
              </p>
            </div>
            <button
              className="primary-glass-button inline-flex min-h-11 items-center gap-2 rounded-lg px-4 font-semibold"
              onClick={downloadReport}
              disabled={isLoadingReport || filteredReadings.length === 0}
            >
              <Download size={18} aria-hidden="true" />
              {isLoadingReport ? "Đang tải dữ liệu..." : "Tải CSV"}
            </button>
          </section>
          {reportError && (
            <p role="alert" className="monitor-notice">
              {reportError}
            </p>
          )}
          <section className="monitor-box">
            <div className="monitor-box-heading">
              <h2>Xem trước dữ liệu</h2>
              <span className="text-muted text-xs">Tối đa 10 bản ghi</span>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Thiết bị</th>
                    <th>Thời gian</th>
                    {metrics.map((m) => (
                      <th key={m.key}>
                        {m.symbol}
                        <small className="monitor-cell-note">{m.unit}</small>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredReadings.slice(0, 10).map((r, i) => (
                    <tr key={r.deviceId + r.timestamp + i}>
                      <td>{r.deviceId}</td>
                      <td>{new Date(r.timestamp).toLocaleString("vi-VN")}</td>
                      {metrics.map((m) => (
                        <td key={m.key}>
                          {formatConcentration(metricValue(r, m.key))}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {!filteredReadings.length && (
                    <tr>
                      <td colSpan={metrics.length + 2}>
                        {isLoadingReport
                          ? "Đang tải bản ghi…"
                          : "Không có bản ghi trong lựa chọn hiện tại."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          {isLoadingReport ? (
            <div className="text-muted flex items-center gap-2 text-sm">
              <RefreshCw className="animate-spin" size={15} />
              Đang tải dữ liệu từ các thiết bị đã chọn...
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
