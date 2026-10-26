import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { usePageState } from "../hooks/usePageState";
import { useStoredReadings } from "../hooks/useStoredReadings";
import { loadArchiveDashboard, loadMonitoringHealth } from "../services/api";
import { describeApiError } from "../services/apiError";
import type { DashboardData } from "../types/dashboard";
import { analysisDayRange, vietnamDate, VIETNAM_TIME_ZONE } from "../utils/analysisTime";
import { summarizeQuality, type StoredReading } from "../utils/quality";
import { formatDataAge } from "../utils/dataHealth";
import "../styles/quality.css";

const formatTime = (value?: string | null) => value && Number.isFinite(Date.parse(value))
  ? new Date(value).toLocaleString("vi-VN", { timeZone: VIETNAM_TIME_ZONE }) : "Chưa có thông tin";
const hour = (value: number) => new Date(value).toLocaleTimeString("vi-VN", { timeZone: VIETNAM_TIME_ZONE, hour: "2-digit", minute: "2-digit" });
const percent = (value: number, total: number) => total ? `${(value / total * 100).toFixed(1)}%` : "—";

export function HistoryPage() {
  const [selection, setSelection] = usePageState("quality-device", "");
  const [day, setDay] = usePageState("quality-day", vietnamDate());
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [health, setHealth] = useState<Awaited<ReturnType<typeof loadMonitoringHealth>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now);
  const [selectedBucket, setSelectedBucket] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    async function refresh() {
      const [data, status] = await Promise.allSettled([loadArchiveDashboard(), loadMonitoringHealth()]);
      if (!active) return;
      setNow(Date.now());
      if (data.status === "fulfilled") { setDashboard(data.value); setError(null); }
      else setError(describeApiError(data.reason, "Chưa tải được trạng thái dữ liệu"));
      setHealth(status.status === "fulfilled" ? status.value : null);
      timer = window.setTimeout(() => void refresh(), 10000);
    }
    void refresh();
    return () => { active = false; window.clearTimeout(timer); };
  }, []);
  const devices = dashboard?.devices ?? [];
  const deviceId = devices.some(device => device.deviceId === selection) ? selection : devices[0]?.deviceId ?? "";
  const range = analysisDayRange(day);
  const stored = useStoredReadings(deviceId ? [deviceId] : [], 1, range, true);
  const rows = stored.readings as StoredReading[];
  const summary = useMemo(() => summarizeQuality(rows, range.start, range.end, now), [rows, range.start, range.end, now]);
  const latest = dashboard?.deviceReadings[deviceId] as StoredReading | undefined;
  const sourceTime = latest?.timestampSource === "device" ? latest.timestamp : null;
  const collector = health?.collector;
  const hasHistory = Boolean(stored.loadedAt);
  const inspected = selectedBucket !== null ? summary.buckets[selectedBucket] : null;
  const latestTime = Date.parse(latest?.receivedAt ?? "");
  const delayed = Number.isFinite(latestTime) && now - latestTime > 300000;
  return <div className="monitor-dashboard monitor-subpage">
    <div>
      <p className="eyebrow">Kiểm tra độ đầy đủ và cập nhật</p>
      <h1 className="page-title">Chất lượng dữ liệu</h1>
      <p className="text-muted mt-1 text-sm">Kiểm tra lịch sử đã lưu trên máy chủ. Chất lượng ở đây là tính đầy đủ và hợp lệ của số đo, chưa xác nhận độ chính xác cảm biến.</p>
    </div>
    {(error || stored.error) && <p className="monitor-notice" role="alert">{error ?? stored.error} {stored.loadedAt ? "Đang giữ kết quả lần tải thành công trước." : ""}</p>}
    {!dashboard && !error && <p role="status">Đang tải danh sách thiết bị…</p>}
    {dashboard && !devices.length && <p role="status">Database chưa có thiết bị hoặc bản ghi đã lưu.</p>}
    <div className="monitor-filter-row">
      <label>Thiết bị<select value={deviceId} disabled={!devices.length} onChange={event => { setSelection(event.target.value); setSelectedBucket(null); }}>
        {!devices.length && <option value="">Chưa có thiết bị</option>}
        {devices.map(device => <option key={device.deviceId} value={device.deviceId}>{device.deviceId}</option>)}
      </select></label>
      <label>Ngày kiểm tra (UTC+7)<input type="date" value={day} max={vietnamDate()} onChange={event => {
        if (event.target.value && Number.isFinite(Date.parse(`${event.target.value}T00:00:00+07:00`))) { setDay(event.target.value); setSelectedBucket(null); }
      }} /></label>
      <Link className="monitor-inline-link" to="/reports">Xuất dữ liệu tại Báo cáo →</Link>
    </div>
    <section className="monitor-box">
      <h2 className="section-title">Các chặng cập nhật hiện tại</h2>
      <p className="text-muted mt-2 text-sm">Trạng thái mới nhất của hệ thống và thiết bị đã chọn, độc lập với ngày lịch sử bên dưới.</p>
      <div className="monitor-summary-row">
        <article><span>Web → API</span><strong>{!health ? "Chưa xác định" : health.api ? "Kết nối" : "Không kết nối"}</strong></article>
        <article><span>API → Database</span><strong>{health?.database == null ? "Chưa xác định" : health.database ? "Kết nối" : "Không kết nối"}</strong></article>
        <article><span>Luồng Firebase</span><strong>{!collector ? "Chưa xác định" : collector.connected ? "Kết nối" : "Mất kết nối"}</strong></article>
      </div>
      <div className="table-scroll"><table className="data-table"><thead><tr><th>Chặng</th><th>Thời điểm (UTC+7)</th><th>Ý nghĩa</th></tr></thead><tbody>
        <tr><td>Thiết bị đo</td><td>{formatTime(sourceTime)}</td><td>{sourceTime ? "Thời gian thiết bị cung cấp trong bản ghi mới nhất." : "Bản ghi chưa có thời gian đo được xác nhận từ thiết bị."}</td></tr>
        <tr><td>Backend nhận → bản ghi đã lưu</td><td>{formatTime(latest?.receivedAt)}</td><td>{latest?.receivedAt ? formatDataAge(now - latestTime) : "Chưa có thông tin"}. Thời gian nhận gắn với bản ghi đã lưu, không phải thời điểm hoàn tất ghi riêng.</td></tr>
        <tr><td>Sự kiện Firebase → bộ thu thập</td><td>{formatTime(collector?.lastSnapshotAt)}</td><td>Toàn hệ thống; sự kiện có thể chỉ thay đổi trạng thái thiết bị.</td></tr>
        <tr><td>Đối chiếu trực tiếp Firebase</td><td>{formatTime(collector?.lastVerifiedAt)}</td><td>Toàn hệ thống; backend cũ có thể chưa hỗ trợ thông tin này.</td></tr>
        <tr><td>FE tải xong lịch sử đang chọn</td><td>{formatTime(stored.loadedAt)}</td><td>{stored.loading ? "Đang tải…" : "Tự tải lại mỗi 30 giây."}</td></tr>
      </tbody></table></div>
      {collector?.error && <p role="alert" className="monitor-notice">Bộ thu thập: {collector.error}</p>}
      {delayed && <p className="monitor-notice">Bản ghi lưu gần nhất của thiết bị đã hơn 5 phút. Kiểm tra luồng thu thập và tình trạng cảm biến; kết nối thành công chưa chứng minh có mẫu mới.</p>}
      <p className="text-muted mt-3 text-xs">Kiểm tra hệ thống lúc {formatTime(health?.checkedAt)} · Đang chờ lưu: {collector?.pendingDevices ?? "—"} thiết bị. Các thời điểm có thể khác nhau do đồng hồ nguồn và chu kỳ gửi.</p>
    </section>
    <section className="monitor-box">
      <h2 className="section-title">Độ đầy đủ trong ngày {day.split("-").reverse().join("/")}</h2>
      <div className="monitor-summary-row">
        <article><span>Bản ghi đã lưu</span><strong>{hasHistory ? summary.total : "—"}</strong></article>
        <article><span>Đủ 5 thông số hợp lệ</span><strong>{hasHistory ? percent(summary.complete, summary.total) : "—"}</strong></article>
        <article><span>Khoảng 5 phút có bản ghi</span><strong>{hasHistory ? `${summary.covered}/${summary.elapsed}` : "—"}</strong></article>
      </div>
      <p className="text-muted text-sm">Độ phủ theo thời gian: {hasHistory ? percent(summary.covered, summary.elapsed) : "—"}. Chỉ tính khoảng 5 phút đã kết thúc; không phải tỷ lệ nhận đủ mẫu.</p>
      <h3 className="mt-5 font-semibold">Dòng thời gian bản ghi</h3>
      <p className="text-muted mt-2 text-xs">Mỗi ô là 5 phút. Chọn một ô để xem số bản ghi và mức độ đầy đủ.</p>
      <div className="quality-legend">
        <span><i className="quality-full" /> Đủ 5 thông số</span><span><i className="quality-partial" /> Có mẫu thiếu/không hợp lệ</span><span><i className="quality-empty" /> Không có bản ghi</span><span><i className="quality-future" /> Chưa đến thời gian</span>
      </div>
      {!hasHistory ? <p role="status" className="text-muted mt-3">{stored.error ? "Chưa tải được lịch sử để đánh giá." : deviceId ? "Đang tải lịch sử…" : "Chọn thiết bị có dữ liệu để kiểm tra."}</p> : <>
        <div className="quality-hours">{Array.from({ length: 24 }, (_, h) => <div className="quality-hour" key={h}>
          <span>{String(h).padStart(2, "0")}:00</span>
          <div>{summary.buckets.slice(h * 12, h * 12 + 12).map((bucket, i) => {
            const index = h * 12 + i;
            const state = bucket.start > now ? "future" : bucket.total === 0 ? "empty" : bucket.incomplete > 0 ? "partial" : "full";
            const text = `${hour(bucket.start)}–${index === 287 ? "24:00" : hour(bucket.end)}: ${state === "future" ? "chưa đến thời gian" : `${bucket.total} bản ghi, ${bucket.incomplete} bản ghi thiếu hoặc không hợp lệ${bucket.end > now ? ", khoảng đang diễn ra" : ""}`}`;
            return <button key={bucket.start} type="button" className={`quality-cell quality-${state}`} title={text} aria-label={text} aria-pressed={selectedBucket === index} onClick={() => setSelectedBucket(index)} />;
          })}</div>
        </div>)}</div>
        {inspected && <p className="mt-3 text-sm" role="status">{hour(inspected.start)}–{inspected.end === range.end ? "24:00" : hour(inspected.end)}: {inspected.start > now ? "Chưa đến thời gian." : `${inspected.total} bản ghi; ${inspected.total - inspected.incomplete} bản ghi đủ 5 thông số, ${inspected.incomplete} bản ghi thiếu hoặc không hợp lệ.${inspected.end > now ? " Khoảng đang diễn ra." : ""}`}</p>}
      </>}
      <p className="monitor-footnote">Số đo không đổi có thể bị bỏ trùng. Ô trống chỉ cho biết không có bản ghi được lưu; chưa đủ để kết luận mất kết nối hoặc mất mẫu. Thời gian dùng timestamp của bản ghi, có thể là lúc backend nhận nếu thiết bị không gửi thời gian đo.</p>
    </section>
    <section className="monitor-box">
      <h2 className="section-title">Tỷ lệ số đo hợp lệ theo thông số</h2>
      <p className="text-muted mt-2 text-sm">Tính trên {hasHistory ? summary.total : "—"} bản ghi của thiết bị và ngày đã chọn. Các khí chưa có cảm biến không được đưa vào đánh giá này.</p>
      <div className="table-scroll"><table className="data-table"><thead><tr><th>Thông số</th><th>Hợp lệ</th><th>Thiếu</th><th>Không hợp lệ</th><th>Tỷ lệ hợp lệ</th></tr></thead><tbody>
        {summary.metrics.map(metric => <tr key={metric.key}><td>{metric.label}</td><td>{hasHistory ? metric.valid : "—"}</td><td>{hasHistory ? metric.missing : "—"}</td><td>{hasHistory ? metric.invalid : "—"}</td><td>{hasHistory ? percent(metric.valid, summary.total) : "—"}</td></tr>)}
      </tbody></table></div>
      <p className="monitor-footnote">Thiếu: giá trị trống/null. Không hợp lệ: không phải số hữu hạn, độ ẩm ngoài 0–100%, hoặc bụi/áp suất âm. Giá trị 0 vẫn được giữ. Vượt ngưỡng cảnh báo không đồng nghĩa số đo không hợp lệ; dữ liệu đã chuẩn hóa thành null không thể phân biệt lỗi gốc với giá trị thiếu.</p>
      {deviceId && <Link className="monitor-inline-link" to={`/analysis?device=${encodeURIComponent(deviceId)}`}>Phân tích diễn biến của thiết bị →</Link>}
    </section>
  </div>;
}
