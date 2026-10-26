import { ArrowUpRight } from "lucide-react";
import type { ClimateReading } from "@climasense/shared";
import { formatConcentration } from "../../config/pollutants";
import {
  metrics,
  metricValue,
  type Metric,
  type MetricKey,
} from "../../config/metrics";

export function AirQualityPanel({
  reading,
  visibleMetrics = metrics,
  selectedKey,
  onSelect,
}: {
  reading?: ClimateReading | null;
  visibleMetrics?: readonly Metric[];
  selectedKey?: MetricKey;
  onSelect?: (key: MetricKey) => void;
}) {
  return (
    <section aria-label="Số đo mới nhất" className="monitor-readings">
      <div className="monitor-section-label">
        <h2>Số đo mới nhất</h2>
        <span>Chọn một thông số để xem biểu đồ</span>
      </div>
      {!visibleMetrics.length && (
        <div className="monitor-notice">
          Đang ẩn tất cả thông số. Mở “Thông số hiển thị” để chọn số đo cần theo
          dõi.
        </div>
      )}
      <div className="monitor-metric-grid">
        {visibleMetrics.map((item) => {
          const value = metricValue(reading, item.key);
          return (
            <button
              type="button"
              key={item.key}
              onClick={() => onSelect?.(item.key)}
              aria-pressed={selectedKey === item.key}
              className={
                "monitor-metric " +
                (selectedKey === item.key ? "is-active " : "") +
                (value === null ? "is-missing" : "")
              }
            >
              <span className="monitor-metric-top">
                <span>{item.symbol}</span>
                <ArrowUpRight size={15} />
              </span>
              <span className="monitor-metric-value">
                {formatConcentration(value)}
                <small>{item.unit}</small>
              </span>
              <span className="monitor-metric-bottom">
                <i />
                {value === null
                  ? "Chưa có số đo"
                  : item.group === "Khí tượng"
                    ? "Khí tượng"
                    : "Nồng độ tức thời"}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
