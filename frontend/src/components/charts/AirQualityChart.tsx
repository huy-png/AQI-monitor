import { usePageState } from "../../hooks/usePageState";
import { Activity, Sun, Moon } from "lucide-react";
import { analysisDayRange, dayPeriod, VIETNAM_TIME_ZONE } from "../../utils/analysisTime";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AlertSettings, ClimateReading } from "@climasense/shared";
import { Link } from "react-router-dom";
import {
  metrics,
  metricValue,
  type Metric,
  type MetricKey,
} from "../../config/metrics";
import { pollutants } from "../../config/pollutants";
import { useChartZoom } from "../../hooks/useChartZoom";
import { analyzeTrend } from "../../utils/analysisTrend";

export function AirQualityChart({
  readings,
  selectedKey,
  onSelect,
  analysisDay,
  alertSettings,
  thresholdError = false,
  visibleMetrics = metrics.filter((item) =>
    pollutants.some((p) => p.key === item.key),
  ),
}: {
  readings: ClimateReading[];
  selectedKey?: MetricKey;
  onSelect?: (key: MetricKey) => void;
  analysisDay?: string;
  alertSettings?: AlertSettings | null;
  thresholdError?: boolean;
  visibleMetrics?: readonly Metric[];
}) {
  const [selection, setSelection] = usePageState<MetricKey>("chart-metric", "pm25");
  const [period, setPeriod] = usePageState<"all" | "1h" | "24h">("chart-period", "all");
  const dayRange = analysisDay ? analysisDayRange(analysisDay) : null;
  const zoom = useChartZoom(dayRange?.start, dayRange?.end);
  const pollutant =
    visibleMetrics.find((item) => item.key === (selectedKey ?? selection)) ??
    visibleMetrics[0];
  if (!pollutant) return null;
  const key = pollutant.key;
  const showDustThresholds = Boolean(analysisDay) && (key === "pm25" || key === "pm10");
  const rule = showDustThresholds ? alertSettings?.rules.find(item => item.metric === key) : undefined;
  const thresholdLines = rule?.enabled ? [
    { value: rule.lower, label: "Ngưỡng thấp", color: "#0284c7" },
    { value: rule.upper, label: "Ngưỡng cao", color: "#dc2626" },
  ].filter((item): item is { value: number; label: string; color: string } => typeof item.value === "number" && Number.isFinite(item.value)) : [];
  const cutoff =
    dayRange ? dayRange.start : period === "all"
      ? -Infinity
      : Date.now() - (period === "1h" ? 3600000 : 86400000);
  const points = readings
    .filter(
      (reading) =>
        Number.isFinite(Date.parse(reading.timestamp)) &&
        Date.parse(reading.timestamp) >= cutoff &&
        (!dayRange || Date.parse(reading.timestamp) < dayRange.end),
    )
    .map((reading) => ({
      timestamp: Date.parse(reading.timestamp),
      value: metricValue(reading, key),
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
  const visiblePoints = zoom.window ? points.filter(point => point.timestamp >= zoom.window![0] && point.timestamp <= zoom.window![1]) : points;
  const trend = analysisDay ? analyzeTrend(visiblePoints) : null;
  const values = visiblePoints.flatMap((point) =>
    point.value === null ? [] : [point.value],
  );
  const stats = values.length
    ? [
        values.reduce((min, value) => Math.min(min, value), Infinity),
        values.reduce((sum, value) => sum + value, 0) / values.length,
        values.reduce((max, value) => Math.max(max, value), -Infinity),
      ]
    : [null, null, null];
  const count = values.length;
  const hasData = points.some(point => point.value !== null);
  const span =
    points.length > 1
      ? points[points.length - 1].timestamp - points[0].timestamp
      : 0;
  return (
    <section className="glass-card p-5 monitor-chart">
      <div className="air-section-heading">
        <div>
          <p className="monitor-kicker">DIỄN BIẾN QUAN TRẮC</p>
          <h2 className="section-title">{pollutant.symbol} theo thời gian</h2>
        </div>
        <label className="text-muted text-sm">
          <span className="sr-only">Thông số biểu đồ</span>
          <select
            className="glass-select rounded-lg px-3 py-2"
            value={key}
            onChange={(event) => {
              setSelection(event.target.value as MetricKey);
              onSelect?.(event.target.value as MetricKey);
            }}
          >
            {visibleMetrics.map((item) => (
              <option key={item.key} value={item.key}>
                {item.symbol} · {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-muted mb-4 mt-2 text-xs">
        {pollutant.symbol} · {pollutant.unit} · Các bản ghi hiện có của thiết bị
        đang chọn{analysisDay ? ` · Ngày ${analysisDay.split("-").reverse().join("/")} (UTC+7)` : ""}
      </p>
      <div className="monitor-chart-tools">
        {!dayRange && <div
          className="monitor-period"
          role="group"
          aria-label="Khoảng thời gian"
        >
          {(["1h", "24h", "all"] as const).map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={period === value}
              onClick={() => setPeriod(value)}
            >
              {value === "all"
                ? "Tất cả bản ghi"
                : value === "1h"
                  ? "1 giờ"
                  : "24 giờ"}
            </button>
          ))}
        </div>}
        <span>{count} số đo hợp lệ</span>
      </div>
      {dayRange && <div className="mb-3 flex flex-wrap gap-4 text-xs text-muted" aria-label="Chú giải ngày và đêm">
        <span className="inline-flex items-center gap-2"><Sun size={16} color="#d97706" /> Ban ngày: 06:00–18:00</span>
        <span className="inline-flex items-center gap-2"><Moon size={16} color="#818cf8" /> Ban đêm: 18:00–06:00</span>
        <span>Quy ước theo giờ Việt Nam, không phải giờ mặt trời mọc/lặn.</span>
      </div>}
      {dayRange && <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
        <button type="button" className="glass-select rounded-lg px-3 py-2" onClick={() => zoom.adjust(0.5)} aria-label="Phóng to biểu đồ">＋</button>
        <button type="button" className="glass-select rounded-lg px-3 py-2" onClick={() => zoom.adjust(2)} aria-label="Thu nhỏ biểu đồ">−</button>
        <button type="button" className="glass-select rounded-lg px-3 py-2" onClick={zoom.reset}>Xem cả ngày</button>
        <span className="text-muted text-xs">Cuộn lên để phóng to tại con trỏ, cuộn xuống để thu nhỏ (tối thiểu 1 phút).</span>
      </div>}
      {hasData ? (
        <div className="h-72" ref={zoom.ref}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={visiblePoints}
              margin={{ top: 10, right: 15, bottom: 10, left: 0 }}
            >
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
              <XAxis
                dataKey="timestamp"
                type="number"
                scale="time"
                domain={zoom.window ?? ["dataMin", "dataMax"]}
                ticks={zoom.window ? Array.from({ length: 5 }, (_, index) => zoom.window![0] + (zoom.window![1] - zoom.window![0]) * index / 4) : undefined}
                allowDataOverflow={Boolean(dayRange)}
                stroke="var(--text-muted)"
                minTickGap={40}
                tickFormatter={(value: number) =>
                  dayRange && value === dayRange.end ? "24:00" : new Date(value).toLocaleTimeString("vi-VN", {
                    ...(dayRange ? { timeZone: VIETNAM_TIME_ZONE } : {}),
                    ...(span >= 86400000
                      ? { day: "2-digit", month: "2-digit" }
                      : {}),
                    hour: "2-digit",
                    minute: "2-digit",
                    ...(!dayRange && span < 600000 ? { second: "2-digit" } : {}),
                  })
                }
              />
              <YAxis
                stroke="var(--text-muted)"
                domain={
                  key === "humidity"
                    ? [0, 100]
                    : key === "temperature" || key === "pressure"
                      ? ["auto", "auto"]
                      : [0, "auto"]
                }
              />
              <Tooltip
                labelFormatter={(value) =>
                  new Date(Number(value)).toLocaleString("vi-VN", dayRange ? { timeZone: VIETNAM_TIME_ZONE } : undefined) + (dayRange ? ` · ${dayPeriod(Number(value))} (UTC+7)` : "")
                }
                contentStyle={{
                  background: "var(--tooltip-bg)",
                  border: "1px solid var(--glass-border)",
                  borderRadius: 12,
                  color: "var(--text-primary)",
                }}
              />
              {dayRange && [
                { from: 0, to: 6, color: "#818cf8" },
                { from: 6, to: 18, color: "#fbbf24" },
                { from: 18, to: 24, color: "#818cf8" },
              ].map(band => ({ ...band, start: Math.max(zoom.window![0], dayRange.start + band.from * 3600000), end: Math.min(zoom.window![1], dayRange.start + band.to * 3600000) })).filter(band => band.start < band.end).map(band => <ReferenceArea key={band.from} x1={band.start} x2={band.end} fill={band.color} fillOpacity={0.12} strokeOpacity={0} />)}
              <Line
                dataKey="value"
                name={pollutant.symbol + " (" + pollutant.unit + ")"}
                stroke={pollutant.color}
                strokeWidth={2.5}
                dot={count < 3 ? { r: 4 } : false}
                connectNulls={false}
                isAnimationActive={false}
              />
              {thresholdLines.map(item => <ReferenceLine key={item.label} y={item.value} stroke={item.color} strokeWidth={2} strokeDasharray="6 4" ifOverflow="extendDomain" label={{ value: `${item.label}: ${item.value}`, position: "insideTopRight", fill: item.color, fontSize: 12 }} />)}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="air-chart-empty">
          <Activity size={32} className="text-muted" aria-hidden="true" />
          <h3 className="mt-3 font-semibold">
            Chưa có dữ liệu {pollutant.symbol}
          </h3>
          <p className="text-muted mt-2 max-w-sm text-sm">
            {dayRange ? "Không có số đo cho thông số này trong ngày đã chọn. Hãy chọn ngày khác hoặc thiết bị khác." : period === "all"
              ? "Biểu đồ sẽ hiển thị khi thiết bị gửi số liệu cho thông số này."
              : "Không có số đo trong khoảng thời gian đã chọn. Chọn “Tất cả bản ghi” để xem dữ liệu cũ hơn."}
          </p>
        </div>
      )}
      {showDustThresholds && <div className="my-4 rounded-lg border border-[var(--glass-border)] p-4">
        <h3 className="font-semibold">Chú thích cảnh báo {pollutant.symbol}</h3>
        {thresholdError ? <p role="status" className="text-muted mt-2 text-sm">Không tải được ngưỡng từ máy chủ. Chưa thể đối chiếu cảnh báo.</p>
          : !alertSettings ? <p className="text-muted mt-2 text-sm">Đang tải ngưỡng cảnh báo…</p>
          : !rule ? <p className="text-muted mt-2 text-sm">Chưa có cấu hình cảnh báo cho thông số này.</p>
          : <>
            {!rule.enabled && <p className="mt-2 text-sm">Cảnh báo thông số này đang tắt; không áp dụng các ngưỡng đã lưu.</p>}
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="font-semibold">Ngưỡng thấp (nét đứt xanh)</dt><dd className="text-muted">{rule.lower === null ? "Chưa đặt" : `Số đo < ${rule.lower.toLocaleString("vi-VN")} ${pollutant.unit}`}</dd></div>
              <div><dt className="font-semibold">Ngưỡng cao (nét đứt đỏ)</dt><dd className="text-muted">{rule.upper === null ? "Chưa đặt" : `Số đo > ${rule.upper.toLocaleString("vi-VN")} ${pollutant.unit}`}</dd></div>
              <div><dt className="font-semibold">Tăng nhanh</dt><dd className="text-muted">{rule.rise === null ? "Chưa đặt" : `Tăng ≥ ${rule.rise.toLocaleString("vi-VN")} ${pollutant.unit} trong ${rule.windowSeconds} giây`}</dd></div>
              <div><dt className="font-semibold">Giảm nhanh</dt><dd className="text-muted">{rule.fall === null ? "Chưa đặt" : `Giảm ≥ ${rule.fall.toLocaleString("vi-VN")} ${pollutant.unit} trong ${rule.windowSeconds} giây`}</dd></div>
            </dl>
            {rule.enabled && <p className="mt-3 text-sm">Trong khoảng đang xem: {count ? `${rule.lower === null ? "chưa đặt ngưỡng thấp" : `${values.filter(value => value < rule.lower!).length} số đo dưới ngưỡng thấp`}; ${rule.upper === null ? "chưa đặt ngưỡng cao" : `${values.filter(value => value > rule.upper!).length} số đo trên ngưỡng cao`}.` : "chưa có số đo hợp lệ để đối chiếu."}</p>}
            <p className="text-muted mt-2 text-xs">Biến động so với số đo hợp lệ cũ nhất trong cửa sổ, theo thời gian backend nhận. Thời gian chờ lặp cảnh báo: {rule.cooldownSeconds} giây. Ngưỡng tăng/giảm là chênh lệch, không phải đường nồng độ cố định.</p>
          </>}
        <p className="text-muted mt-3 text-xs">Đây là ngưỡng vận hành đang cấu hình, không phải mức AQI hay giới hạn quy chuẩn. Đối chiếu dữ liệu cũ dùng cấu hình hiện tại; số mẫu vượt ngưỡng không phải số sự kiện cảnh báo đã phát.</p>
        <Link className="monitor-inline-link mt-2 inline-block text-sm" to="/settings#alert-settings">Xem hoặc chỉnh ngưỡng cảnh báo →</Link>
      </div>}
      {analysisDay && key === "humidity" && <div className="my-4 rounded-lg border border-[var(--glass-border)] p-4">
        <h3 className="font-semibold">Độ ẩm có cho biết trời mưa không?</h3>
        <p className="mt-2 text-sm">Trạng thái mưa: chưa xác định từ dữ liệu hiện có.</p>
        <p className="text-muted mt-2 text-sm">Độ ẩm tương đối cao, kể cả 100%, không đồng nghĩa đang mưa. Độ ẩm cũng thay đổi theo nhiệt độ; không thể dùng riêng chỉ số này để kết luận mưa hoặc không mưa.</p>
        <p className="text-muted mt-2 text-sm">Để xác nhận mưa tại trạm, cần thêm cảm biến mưa hoặc thiết bị đo lượng mưa. Nhiệt độ, độ ẩm và áp suất có thể là đầu vào cho mô hình dự báo sau khi có dữ liệu mưa thực tế để kiểm chứng.</p>
        <a className="monitor-inline-link mt-2 inline-block text-xs" href="https://www.weather.gov/lmk/humidity" target="_blank" rel="noreferrer">Giải thích về độ ẩm — NOAA/NWS ↗</a>
      </div>}
      {analysisDay && <div className="my-4 rounded-lg border border-[var(--glass-border)] p-4" aria-live="polite">
        <h3 className="font-semibold">Xu hướng trong khoảng đang xem</h3>
        {trend ? <>
          <p className="mt-2 font-semibold">{trend.label}</p>
          <p className="text-muted mt-2 text-sm">Độ dốc: {trend.slope.toLocaleString("vi-VN", { maximumFractionDigits: 3 })} {pollutant.unit}/giờ · Thay đổi theo đường khớp: {trend.change.toLocaleString("vi-VN", { maximumFractionDigits: 3 })} {pollutant.unit} · R²: {trend.r2.toFixed(2)}.</p>
          <p className="text-muted mt-2 text-xs">{trend.buckets} khoảng 5 phút có dữ liệu · Độ phủ giữa khoảng đầu và cuối: {(trend.coverage * 100).toFixed(0)}%. {trend.coverage < 0.5 ? "Thiếu nhiều khoảng đo, chưa kết luận chiều xu hướng." : ""}</p>
        </> : <p className="text-muted mt-2 text-sm">Chưa đủ dữ liệu: cần ít nhất 3 khoảng 5 phút có số đo hợp lệ. Hãy thu nhỏ hoặc chọn ngày khác.</p>}
        <p className="text-muted mt-2 text-xs">Hồi quy tuyến tính trên trung bình từng khoảng 5 phút; bỏ giá trị thiếu, không điền các khoảng mất dữ liệu. R² dưới 0,30 được ghi là chưa rõ xu hướng. Đây là mô tả dữ liệu đã thu thập, không phải dự báo hay đánh giá đạt/vượt chuẩn.</p>
      </div>}
      <div className="monitor-chart-stats">
        {["Thấp nhất", "Trung bình mẫu", "Cao nhất"].map((label, index) => (
          <div key={label}>
            <span>{label}</span>
            <strong>
              {stats[index] === null
                ? "—"
                : stats[index]!.toLocaleString("vi-VN", {
                    maximumFractionDigits: 2,
                  })}
              <small>{pollutant.unit}</small>
            </strong>
          </div>
        ))}
      </div>
      <p className="monitor-footnote">
        Thống kê từ các bản ghi hiện có trong khoảng chọn; trung bình mẫu không
        phải trung bình quy chuẩn.{" "}
        {count === 1 ? "Chỉ có một bản ghi, chưa đủ để thể hiện xu hướng." : ""}
      </p>
    </section>
  );
}
