import { usePageState } from "../../hooks/usePageState";
import { useEffect, useRef, type ComponentRef } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import type { Device } from "@climasense/shared";

export function ReportDevicePicker({
  devices,
  selected,
  onChange,
}: {
  devices: Device[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = usePageState("device-query", "");
  const pickerRef = useRef<ComponentRef<"details">>(null);
  useEffect(() => {
    const closeOutside = (event: InstanceType<typeof window.PointerEvent>) => {
      if (
        pickerRef.current &&
        event.target instanceof window.Node &&
        !pickerRef.current.contains(event.target)
      ) {
        pickerRef.current.open = false;
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);
  const visible = devices.filter((device) =>
    `${device.deviceId} ${device.name}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  const selectedIds = devices
    .filter((device) => selected.includes(device.deviceId))
    .map((device) => device.deviceId);
  const allSelected =
    devices.length > 0 && selectedIds.length === devices.length;
  const summary = !selectedIds.length
    ? "Chọn thiết bị"
    : allSelected
      ? `Tất cả thiết bị (${devices.length})`
      : `${selectedIds.length} thiết bị đã chọn`;
  return (
    <div className="report-device-filter">
      <span className="filter-label" id="report-device-label">
        Thiết bị / trạm
      </span>
      <details
        ref={pickerRef}
        className="report-device-picker"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.currentTarget.open = false;
            event.currentTarget.querySelector("summary")?.focus();
          }
        }}
      >
        <summary aria-labelledby="report-device-label report-device-summary">
          <span id="report-device-summary">{summary}</span>
          <ChevronDown size={16} aria-hidden="true" />
        </summary>
        <div className="report-device-menu">
          <label className="report-device-search">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              aria-label="Tìm thiết bị báo cáo"
              placeholder="Tìm theo tên hoặc mã thiết bị…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="report-device-actions">
            <button
              type="button"
              disabled={!visible.length}
              onClick={() =>
                onChange([
                  ...new Set([
                    ...selectedIds,
                    ...visible.map((device) => device.deviceId),
                  ]),
                ])
              }
            >
              {query.trim() ? "Chọn kết quả" : "Chọn tất cả"}
            </button>
            <button
              type="button"
              disabled={!selectedIds.length}
              onClick={() => onChange([])}
            >
              Bỏ chọn tất cả
            </button>
            <span>
              {selectedIds.length}/{devices.length}
            </span>
          </div>
          <fieldset className="report-device-list">
            <legend className="sr-only">Danh sách thiết bị báo cáo</legend>
            {visible.map((device) => (
              <label key={device.deviceId}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(device.deviceId)}
                  onChange={(event) =>
                    onChange(
                      event.target.checked
                        ? [...selectedIds, device.deviceId]
                        : selectedIds.filter((id) => id !== device.deviceId),
                    )
                  }
                />
                <span>
                  <strong>{device.deviceId}</strong>
                  <small>{device.name}</small>
                </span>
              </label>
            ))}
            {!visible.length && <p>Không tìm thấy thiết bị phù hợp.</p>}
          </fieldset>
        </div>
      </details>
      <div className="report-device-selection" aria-live="polite">
        {allSelected ? (
          <span>Bao gồm toàn bộ {devices.length} trạm hiện có</span>
        ) : selectedIds.length ? (
          <>
            {selectedIds.slice(0, 2).map((id) => (
              <button
                key={id}
                type="button"
                aria-label={`Bỏ chọn ${id}`}
                onClick={() =>
                  onChange(selectedIds.filter((value) => value !== id))
                }
              >
                {id}
                <X size={12} aria-hidden="true" />
              </button>
            ))}
            {selectedIds.length > 2 && (
              <span>+{selectedIds.length - 2} thiết bị</span>
            )}
          </>
        ) : (
          <span>Chưa chọn thiết bị để lập báo cáo</span>
        )}
      </div>
    </div>
  );
}
