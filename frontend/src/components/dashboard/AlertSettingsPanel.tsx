import { useEffect, useState, type FormEvent } from "react";
import { ChevronDown } from "lucide-react";
import { alertMetrics, type AlertSettings, type AlertRule } from "@climasense/shared";
import { loadAlertSettings, saveAlertSettings } from "../../services/api";
export function AlertSettingsPanel() {
  const [expanded, setExpanded] = useState(false);
  const [settings, setSettings] = useState<AlertSettings | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    loadAlertSettings().then(value => { if (active) setSettings(value); }).catch(() => { if (active) setError("Không tải được cấu hình cảnh báo. Kiểm tra backend."); });
    return () => { active = false; };
  }, []);
  function update(metric: string, patch: Partial<AlertRule>) {
    setMessage("");
    setSettings(current => current ? { rules: current.rules.map(rule => rule.metric === metric ? { ...rule, ...patch } : rule) } : current);
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!settings) return;
    setError(""); setMessage("");
    for (const rule of settings.rules) {
      if (rule.lower !== null && rule.upper !== null && rule.lower >= rule.upper) { setError("Ngưỡng thấp phải nhỏ hơn ngưỡng cao."); return; }
      if (rule.enabled && [rule.lower, rule.upper, rule.rise, rule.fall].every(value => value === null)) { setError("Mỗi thông số đang bật cần ít nhất một ngưỡng."); return; }
    }
    setSaving(true);
    try { await saveAlertSettings(settings); setMessage("Đã lưu. Áp dụng cho bản ghi mới của tất cả thiết bị."); }
    catch { setError("Không lưu được cấu hình. Kiểm tra giá trị và kết nối backend."); }
    finally { setSaving(false); }
  }
  return <section id="alert-settings" className="glass-panel p-5">
    <h2 className="text-lg font-semibold">
      <button type="button" className="alert-settings-toggle" aria-expanded={expanded} aria-controls="alert-settings-content" onClick={() => setExpanded(value => !value)}>
        <span>Cảnh báo môi trường</span>
        <span className="alert-settings-toggle-action">{expanded ? "Thu gọn" : "Mở cài đặt"}<ChevronDown size={20} aria-hidden="true" className={expanded ? "rotate-180" : ""} /></span>
      </button>
    </h2>
    <div id="alert-settings-content" hidden={!expanded}>
    <p className="text-muted mt-2 text-sm">Áp dụng chung cho mọi thiết bị. So sánh với số đo hợp lệ cũ nhất trong khoảng thời gian đã chọn, theo thời gian backend nhận. Mức tăng/giảm là chênh lệch tuyệt đối theo đơn vị thông số; độ ẩm tính bằng điểm phần trăm.</p>
    <p className="text-muted mt-2 text-sm">Để trống ngưỡng để bỏ qua điều kiện đó. Các giá trị ban đầu chỉ là cấu hình vận hành tham khảo, không phải ngưỡng quy chuẩn.</p>
    {error && <p role="alert" className="air-data-notice mt-3">{error}</p>}
    {message && <p role="status" className="mt-3 text-emerald-400">{message}</p>}
    {!settings ? <p className="mt-3">{error ? "Cấu hình chưa khả dụng." : "Đang tải cấu hình…"}</p> : <form onSubmit={save}>
      <fieldset disabled={saving} className="min-w-0">
      <div className="table-scroll mt-4"><table className="data-table alert-settings-table">
        <thead><tr><th>Bật</th><th>Thông số</th><th>Ngưỡng thấp</th><th>Ngưỡng cao</th><th>Mức tăng ≥</th><th>Mức giảm ≥</th><th>Trong (giây)</th><th>Chờ lặp (giây)</th></tr></thead>
        <tbody>{settings.rules.map(rule => {
          const metric = alertMetrics.find(item => item.key === rule.metric)!;
          return <tr key={rule.metric}><td><input type="checkbox" aria-label={`Bật cảnh báo ${metric.label}`} checked={rule.enabled} onChange={event => update(rule.metric, { enabled: event.target.checked })}/></td>
            <td>{metric.label}<small className="monitor-cell-note">{metric.unit}</small></td>
            {(["lower", "upper", "rise", "fall"] as const).map((key, index) => <td key={key}><input aria-label={`${metric.label} ${["ngưỡng thấp", "ngưỡng cao", "mức tăng", "mức giảm"][index]}`} type="number" step="any" min={index > 1 ? 0.000001 : undefined} value={rule[key] ?? ""} placeholder="Bỏ qua" onChange={event => update(rule.metric, { [key]: event.target.value === "" ? null : Number(event.target.value) })}/></td>)}
            <td><input aria-label={`${metric.label} khoảng thời gian`} type="number" required min={10} max={3600} step={1} value={rule.windowSeconds || ""} onChange={event => update(rule.metric, { windowSeconds: Number(event.target.value) })}/></td>
            <td><input aria-label={`${metric.label} thời gian chờ lặp`} type="number" required min={10} max={86400} step={1} value={rule.cooldownSeconds || ""} onChange={event => update(rule.metric, { cooldownSeconds: Number(event.target.value) })}/></td>
          </tr>;
        })}</tbody>
      </table></div>
      <p className="text-muted mt-3 text-xs">Khoảng so sánh: 10–3.600 giây. Chờ lặp: 10–86.400 giây, riêng cho từng thiết bị, thông số và loại cảnh báo. Cần ít nhất hai số đo để phát hiện biến động. Vượt ngưỡng thấp/cao được kiểm tra ngay trên mỗi số đo.</p>
      <button type="submit" className="primary-glass-button mt-4 rounded-lg px-4 py-3">{saving ? "Đang lưu…" : "Lưu cấu hình cảnh báo"}</button>
      </fieldset>
    </form>}
    </div>
  </section>;
}
