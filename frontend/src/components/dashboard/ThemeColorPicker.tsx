import { useEffect, useState } from "react";
import { DEFAULT_TINT, useTheme } from "../../theme/ThemeContext";

const presets = [
  ["Ngọc bích", DEFAULT_TINT],
  ["Xanh biển", "#399be8"],
  ["Tím", "#9470e8"],
  ["Hồng", "#e879ac"],
  ["Cam", "#eaa04b"],
] as const;

function ColorChannel({ label, value, onChange }: { label: string; value: number; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <label>
      <span>{label}</span>
      <input type="number" min={0} max={255} step={1} value={draft}
        aria-label={`Kênh màu ${label}`}
        onChange={event => {
          setDraft(event.target.value);
          const number = Number(event.target.value);
          if (event.target.value.trim() && Number.isInteger(number) && number >= 0 && number <= 255) onChange(event.target.value);
        }}
        onBlur={() => {
          const number = Number(draft);
          const normalized = draft.trim() && Number.isFinite(number) ? Math.max(0, Math.min(255, Math.round(number))) : value;
          setDraft(String(normalized));
          onChange(String(normalized));
        }} />
    </label>
  );
}

export function ThemeColorPicker() {
  const { tint, setTint } = useTheme();
  const channels = [1, 3, 5].map(offset => parseInt(tint.slice(offset, offset + 2), 16));
  const changeChannel = (index: number, value: string) => {
    if (value.trim() === "") return;
    const number = Number(value);
    if (!Number.isFinite(number)) return;
    const next = channels.map((channel, i) => i === index ? Math.max(0, Math.min(255, Math.round(number))) : channel);
    setTint(`#${next.map(channel => channel.toString(16).padStart(2, "0")).join("")}`);
  };
  return (
    <div className="theme-color-editor">
      <div className="theme-color-description">
        <h3>Màu giao diện</h3>
        <p>Màu nền kính và điểm nhấn thay đổi ngay khi chọn. Màu chữ được điều chỉnh theo chế độ sáng/tối để dễ đọc.</p>
      </div>
      <div className="theme-color-controls">
        <label className="theme-color-well">
          <input type="color" value={tint} onChange={event => setTint(event.target.value)} aria-label="Bảng màu giao diện" />
          <span>Chọn màu <strong>{tint.toUpperCase()}</strong></span>
        </label>
        <fieldset className="theme-rgb">
          <legend>RGB · 0–255</legend>
          {["R", "G", "B"].map((label, index) => (
            <ColorChannel key={label} label={label} value={channels[index]} onChange={value => changeChannel(index, value)} />
          ))}
        </fieldset>
      </div>
      <div className="theme-color-presets" role="group" aria-label="Màu gợi ý">
        {presets.map(([label, color]) => (
          <button key={color} type="button" aria-pressed={tint === color}
            onClick={() => setTint(color)}>
            <i style={{ backgroundColor: color }} aria-hidden="true" />{label}
          </button>
        ))}
        <button type="button" className="theme-color-reset" onClick={() => setTint(DEFAULT_TINT)}>Khôi phục màu mặc định</button>
      </div>
      <p className="theme-color-note">Tự động lưu trên trình duyệt này. Màu cảnh báo và màu thông số biểu đồ giữ nguyên ý nghĩa.</p>
    </div>
  );
}
