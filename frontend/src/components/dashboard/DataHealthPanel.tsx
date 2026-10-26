import { useEffect, useState } from "react";
import type { ClimateReading, Device } from "@climasense/shared";
import { usePageState } from "../../hooks/usePageState";
import { Link } from "react-router-dom";
import { assessDataHealth, formatDataAge } from "../../utils/dataHealth";
import { loadMonitoringHealth } from "../../services/api";

export function DataHealthPanel({ devices, readings, connected, serverMode, loading }: {
  devices: Device[]; readings: Record<string, ClimateReading>; connected: boolean; serverMode: boolean; loading: boolean;
}) {
  const [query, setQuery] = usePageState("query", "");
  const [minutes, setMinutes] = usePageState("stale-minutes", "5");
  const [filter, setFilter] = usePageState("data-health", "all");
  const [now, setNow] = useState(Date.now);
  const [health, setHealth] = useState<Awaited<ReturnType<typeof loadMonitoringHealth>> | null>(null);
  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    async function refresh() {
      const next = await loadMonitoringHealth();
      if (active) {
        setHealth(next);
        timer = window.setTimeout(() => void refresh(), 10000);
      }
    }
    void refresh();
    return () => { active = false; window.clearTimeout(timer); };
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 10000);
    return () => window.clearInterval(timer);
  }, []);
  const threshold = [1, 5, 15, 30, 60].includes(Number(minutes)) ? Number(minutes) : 5;
  const rows = devices.map(device => {
    const reading = readings[device.deviceId];
    // Server lastSeen is the persisted receivedAt. Direct-source timestamps can be synthesized.
    const time = serverMode ? Date.parse(device.lastSeen) : Number.NaN;
    const assessed = assessDataHealth(reading, serverMode ? device.lastSeen : "", now, threshold,
      connected && serverMode && health?.api === true && health.database === true);
    return { device, ...assessed, time };

  });
  const shown = rows.filter(row => (row.device.deviceId + " " + row.device.name).toLowerCase().includes(query.toLowerCase()) && (filter === "all" || (filter === "missing" ? row.missing.length > 0 : row.state === filter)));
  return <section className="monitor-box">
    <h2 className="section-title">Kết nối hệ thống</h2>
    <div className="monitor-summary-row data-health-connections">
      <article><span>Web → Máy chủ</span><strong>{!health ? "Đang kiểm tra" : health.api ? "Kết nối" : "Không kết nối"}</strong></article>
      <article><span>Máy chủ → Database</span><strong>{health?.database == null ? "Chưa xác định" : health.database ? "Kết nối" : "Không kết nối"}</strong></article>
      <article><span>Bộ thu thập → Nguồn thiết bị</span><strong>{!health?.collector ? "Chưa xác định" : health.collector.connected ? "Kết nối" : "Không kết nối"}</strong></article>
    </div>
    {health && <p className="text-muted text-sm">Kiểm tra lúc {new Date(health.checkedAt).toLocaleTimeString("vi-VN")} · Tự kiểm tra mỗi 10 giây.</p>}
    {health?.collector && <p className="text-muted text-sm">Đang chờ lưu: {health.collector.pendingDevices} thiết bị · Lần lưu thành công trong phiên backend hiện tại: {health.collector.lastSavedAt ? new Date(health.collector.lastSavedAt).toLocaleString("vi-VN") : "Chưa ghi nhận"}.</p>}
    {health?.collector?.error && <p role="alert" className="monitor-notice">Bộ thu thập đang báo lỗi: {health.collector.error}</p>}
    <div className="table-heading"><h2 className="section-title">Tình trạng dữ liệu</h2><span className="data-badge">{shown.length} / {devices.length} trạm</span></div>
    <p className="text-muted text-sm">Kiểm tra 5 thông số: nhiệt độ, độ ẩm, áp suất, PM2.5 và PM10. Dữ liệu cũ không đồng nghĩa thiết bị đã tắt.</p>
    {!serverMode && <p className="monitor-notice">Chọn nguồn Máy chủ để kiểm tra tuổi bản ghi theo thời điểm lưu thực tế.</p>}
    {!connected && <p role="status" className="monitor-notice">Chưa kết nối nguồn dữ liệu; chưa thể xác nhận tình trạng mới nhất của các trạm.</p>}
    <div className="monitor-filter-row">
      <label>Tìm thiết bị<input type="search" placeholder="Tên hoặc mã thiết bị" value={query} onChange={e => setQuery(e.target.value)} /></label>
      <label>Ngưỡng dữ liệu cũ<select value={String(threshold)} onChange={e => setMinutes(e.target.value)}>{[1, 5, 15, 30, 60].map(value => <option key={value} value={value}>{value} phút</option>)}</select></label>
      <label>Lọc tình trạng dữ liệu<select value={filter} onChange={e => setFilter(e.target.value)}>
        <option value="all">Tất cả trạm</option><option value="fresh">Có dữ liệu gần đây</option><option value="stale">Dữ liệu cũ</option><option value="missing">Thiếu thông số</option><option value="unknown">Chưa xác định</option>
      </select></label>
    </div>
    <div className="monitor-summary-row">
      <article><span>Có dữ liệu gần đây</span><strong>{rows.filter(r => r.state === "fresh").length}</strong></article>
      <article><span>Dữ liệu cũ</span><strong>{rows.filter(r => r.state === "stale").length}</strong></article>
      <article><span>Thiếu thông số</span><strong>{rows.filter(r => r.missing.length).length}</strong></article>
    </div>
    <div className="table-scroll"><table className="data-table">
      <thead><tr><th>Trạm</th><th>Lần lưu gần nhất</th><th>Tình trạng</th><th>Bản ghi đang hiển thị</th><th>Chi tiết</th></tr></thead>
      <tbody>{shown.map(row => <tr key={row.device.deviceId}>
        <td>{row.device.deviceId}</td>
        <td>{Number.isFinite(row.time) ? new Date(row.time).toLocaleString("vi-VN") : "Chưa xác định"}<small className="monitor-cell-note">{formatDataAge(row.age)}</small></td>
        <td><span className={`monitor-status ${row.state === "fresh" ? "online" : row.state === "stale" ? "warning" : "offline"}`}>{({ fresh: "Có dữ liệu gần đây", stale: "Dữ liệu cũ", unknown: "Chưa xác định" })[row.state]}</span></td>
        <td>{5 - row.missing.length}/5<small className="monitor-cell-note">{row.missing.length ? `Thiếu/không hợp lệ: ${row.missing.map(m => m.label).join(", ")}` : "Đủ 5 thông số"}</small></td>
        <td><Link className="monitor-inline-link" to={`/analysis?device=${encodeURIComponent(row.device.deviceId)}`}>Xem diễn biến →</Link></td>
      </tr>)}{!shown.length && <tr><td colSpan={5}>{loading ? "Đang tải danh sách trạm…" : !connected && !devices.length ? "Chưa tải được danh sách trạm. Kiểm tra kết nối máy chủ." : "Không có trạm phù hợp với bộ lọc."}</td></tr>}</tbody>
    </table></div>
    <p className="text-muted text-sm">Thời điểm lưu khác thời điểm đo. Bản ghi không đổi có thể được bỏ trùng; kiểm tra thêm kết nối và trạng thái module khi dữ liệu cũ. Các bộ đếm có thể trùng nhóm.</p>
  </section>;
}
