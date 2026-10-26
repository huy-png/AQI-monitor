import { usePageState } from "../hooks/usePageState";
import {
  Activity,
  ArrowUpRight,
  MapPin,
  SlidersHorizontal,
  RadioTower,
  Database,
} from "lucide-react";
import { useEffect, useState } from "react";
import { AirQualityChart } from "../components/charts/AirQualityChart";
import { AirQualityPanel } from "../components/dashboard/AirQualityPanel";
import { Link } from "react-router-dom";
import { getRuntimeDataSource } from "../services/dataSource";
import { useStoredReadings } from "../hooks/useStoredReadings";
import { useDashboardData } from "../hooks/useDashboardData";
import { metrics, metricValue, type MetricKey } from "../config/metrics";

export function DashboardPage() {
  const { data, error, isLoading } = useDashboardData("24h");
  const [activeMetric, setActiveMetric] = usePageState<MetricKey>("metric", "pm25");
  const [selection, setSelection] = usePageState("device", "");
  const [visibleKeys, setVisibleKeys] = useState<MetricKey[]>(() => {
    try {
      const saved: unknown = JSON.parse(
        window.localStorage.getItem("dashboard-visible-metrics-v1") ?? "null",
      );
      if (Array.isArray(saved))
        return metrics
          .filter((item) => saved.includes(item.key))
          .map((item) => item.key);
    } catch {
      /* Use defaults if browser storage is unavailable. */
    }
    return ["pm25", "pm10", "temperature", "humidity", "pressure"];
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(
        "dashboard-visible-metrics-v1",
        JSON.stringify(visibleKeys),
      );
    } catch {
      /* Preferences still work for this session. */
    }
  }, [visibleKeys]);
  const visibleMetrics = metrics.filter((item) =>
    visibleKeys.includes(item.key),
  );
  const devices = data?.devices ?? [];
  const selectedDeviceId = devices.some(
    (device) => device.deviceId === selection,
  )
    ? selection
    : (devices[0]?.deviceId ?? data?.latest?.deviceId ?? "");
  const reading = data?.deviceReadings[selectedDeviceId];
  const stored = useStoredReadings(selectedDeviceId ? [selectedDeviceId] : []);
  const selectedHistory = stored.readings;
  const available = visibleMetrics.filter(
    ({ key }) => metricValue(reading, key) !== null,
  ).length;

  const selectedMetric =
    visibleMetrics.find((item) => item.key === activeMetric)?.key ??
    visibleMetrics[0]?.key;
  const source = getRuntimeDataSource();
  const latitude = reading?.latitude;
  const longitude = reading?.longitude;
  const hasLocation =
    typeof latitude === "number" &&
    Number.isFinite(latitude) &&
    Math.abs(latitude) <= 90 &&
    typeof longitude === "number" &&
    Number.isFinite(longitude) &&
    Math.abs(longitude) <= 180;
  const groups = [
    {
      name: "Khí tượng",
      label: "Nhiệt độ · Độ ẩm · Áp suất",
      keys: ["temperature", "humidity", "pressure"] as MetricKey[],
    },
    {
      name: "Bụi",
      label: "PM2.5 · PM10",
      keys: ["pm25", "pm10"] as MetricKey[],
    },
    {
      name: "Chất khí",
      label: "SO₂ · NO₂ · CO · O₃",
      keys: ["so2", "no2", "co", "o3"] as MetricKey[],
    },
  ];
  return (
    <div className="monitor-dashboard">
      <header className="monitor-heading">
        <div>
          <p className="monitor-kicker">QUANTRAC / TRUNG TÂM GIÁM SÁT</p>
          <h1>Tổng quan quan trắc</h1>
          <p className="text-muted text-sm">
            Số đo tại trạm và diễn biến môi trường
          </p>
        </div>
        <span className="monitor-source">
          <Database size={14} />
          {source === "mock"
            ? "Dữ liệu mẫu"
            : source === "firebase"
              ? "Thiết bị"
              : "Máy chủ"}
        </span>
      </header>
      <div className="monitor-toolbar">
        <label className="monitor-device">
          <RadioTower size={17} />
          <span className="sr-only">Thiết bị</span>
          <select
            aria-label="Thiết bị"
            value={selectedDeviceId}
            disabled={!devices.length}
            onChange={(event) => setSelection(event.target.value)}
          >
            {!devices.length && <option value="">Chưa có thiết bị</option>}
            {devices.map((item) => (
              <option key={item.deviceId} value={item.deviceId}>
                {item.deviceId}
              </option>
            ))}
          </select>
        </label>
        <details
          className="monitor-options"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.currentTarget.open = false;
              event.currentTarget.querySelector("summary")?.focus();
            }
          }}
        >
          <summary>
            <SlidersHorizontal size={15} />
            Thông số hiển thị <span>{visibleKeys.length}</span>
          </summary>
          <fieldset>
            <legend className="sr-only">Thông số hiển thị</legend>
            <div className="monitor-presets">
              <button
                type="button"
                onClick={() =>
                  setVisibleKeys([
                    "pm25",
                    "pm10",
                    "temperature",
                    "humidity",
                    "pressure",
                  ])
                }
              >
                Bụi & khí tượng
              </button>
              <button
                type="button"
                onClick={() => setVisibleKeys(metrics.map((item) => item.key))}
              >
                Tất cả
              </button>
              <button type="button" onClick={() => setVisibleKeys([])}>
                Ẩn tất cả
              </button>
            </div>
            {metrics.map((item) => (
              <label key={item.key}>
                <input
                  type="checkbox"
                  checked={visibleKeys.includes(item.key)}
                  onChange={(event) =>
                    setVisibleKeys((current) =>
                      event.target.checked
                        ? [...current, item.key]
                        : current.filter((key) => key !== item.key),
                    )
                  }
                />
                {item.symbol}
              </label>
            ))}
          </fieldset>
        </details>
      </div>
      {isLoading && (
        <p className="monitor-notice" role="status">
          Đang tải số liệu quan trắc…
        </p>
      )}
      {error && (
        <p className="monitor-notice" role="alert">
          Chưa tải được dữ liệu. Kiểm tra kết nối và nguồn dữ liệu trong Cài
          đặt.
        </p>
      )}
      <AirQualityPanel
        reading={reading}
        visibleMetrics={visibleMetrics}
        selectedKey={selectedMetric}
        onSelect={setActiveMetric}
      />
      <div className="monitor-analysis">
        <div className="monitor-chart-wrap">
          {stored.error && <p role="alert" className="air-data-notice">{stored.error}</p>}
          {visibleMetrics.length ? (
          <AirQualityChart
              visibleMetrics={visibleMetrics}
              selectedKey={selectedMetric}
              onSelect={setActiveMetric}
              readings={selectedHistory}
            />
          ) : (
            <section className="monitor-empty">
              <Activity size={28} />
              <h2>Chọn thông số để xem diễn biến</h2>
              <p>Bật các thông số trong tùy chọn phía trên.</p>
            </section>
          )}
        </div>
        <aside className="monitor-side">
          <section className="monitor-box">
            <div className="monitor-box-heading">
              <h2>Độ đầy đủ dữ liệu</h2>
              <Activity size={17} />
            </div>
            <div className="monitor-coverage">
              <strong>
                {available}
                <small> / {visibleMetrics.length}</small>
              </strong>
              <span>
                thông số đã chọn
                <br />
                có số đo
              </span>
            </div>
            <div
              className="monitor-meter"
              role="img"
              aria-label={
                available +
                " trên " +
                visibleMetrics.length +
                " thông số có số đo"
              }
            >
              <i
                style={{
                  width:
                    (visibleMetrics.length
                      ? (available / visibleMetrics.length) * 100
                      : 0) + "%",
                }}
              />
            </div>
            <div className="monitor-groups">
              {groups.map((group) => {
                const count = group.keys.filter(
                  (key) => metricValue(reading, key) !== null,
                ).length;
                return (
                  <div key={group.name}>
                    <div>
                      <strong>{group.name}</strong>
                      <small>{group.label}</small>
                    </div>
                    <span
                      className={
                        count === group.keys.length
                          ? "has-data"
                          : "missing-data"
                      }
                    >
                      {count}/{group.keys.length}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="monitor-footnote">
              Tính từ bản ghi hiện có; không thay thế trạng thái kết nối của
              module.
            </p>
          </section>
          <section className="monitor-box monitor-location">
            <div className="monitor-box-heading">
              <h2>Vị trí trạm</h2>
              <MapPin size={17} />
            </div>
            <div className="monitor-coordinates">
              <span>
                Vĩ độ
                <strong>{hasLocation ? latitude.toFixed(6) + "°" : "—"}</strong>
              </span>
              <span>
                Kinh độ
                <strong>
                  {hasLocation ? longitude.toFixed(6) + "°" : "—"}
                </strong>
              </span>
            </div>
            <Link to="/map">
              Xem bản đồ trạm <ArrowUpRight size={16} />
            </Link>
          </section>
        </aside>
      </div>
      <section className="monitor-box monitor-network">
        <div className="monitor-box-heading">
          <div>
            <p className="monitor-kicker">MẠNG LƯỚI</p>
            <h2>
              Các trạm quan trắc{" "}
              <span className="monitor-count">{devices.length}</span>
            </h2>
          </div>
          <Link to="/devices">
            Quản lý trạm <ArrowUpRight size={15} />
          </Link>
        </div>
        <div className="monitor-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Thiết bị</th>
                {visibleMetrics.map((metric) => (
                  <th key={metric.key}>{metric.symbol}</th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {devices.map((item) => {
                const sample = data?.deviceReadings[item.deviceId];
                return (
                  <tr
                    key={item.deviceId}
                    className={
                      item.deviceId === selectedDeviceId ? "is-selected" : ""
                    }
                  >
                    <th scope="row">
                      <span className="monitor-device-name">
                        {item.deviceId}
                      </span>
                      <small>
                        {item.deviceId === selectedDeviceId
                          ? "Trạm đang xem"
                          : item.name}
                      </small>
                    </th>
                    {visibleMetrics.map((metric) => {
                      const key = metric.key;
                      const value = metricValue(sample, key);
                      return (
                        <td key={key}>
                          {value === null
                            ? "—"
                            : value.toLocaleString("vi-VN", {
                                maximumFractionDigits: 1,
                              })}
                          <small>{value === null ? "" : metric.unit}</small>
                        </td>
                      );
                    })}
                    <td>
                      <button
                        type="button"
                        aria-label={"Xem trạm " + item.deviceId}
                        onClick={() => setSelection(item.deviceId)}
                      >
                        <ArrowUpRight size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!devices.length && (
                <tr>
                  <td colSpan={visibleMetrics.length + 2}>
                    Chưa có thiết bị. Các trạm sẽ xuất hiện khi nguồn dữ liệu
                    được kết nối.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <footer className="monitor-footer">
        <span>
          <span className="monitor-reference-dot" />
          Bản ghi từ nguồn đã chọn
        </span>
        <p>
          Đối chiếu QCVN 05:2023/BTNMT cần giá trị trung bình theo thời gian
          tương ứng. Không đánh giá đạt/vượt từ một số đo tức thời.
        </p>
      </footer>
    </div>
  );
}
