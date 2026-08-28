import { Cloud, CloudRain, CloudSun, Droplets, Sun, Wind } from "lucide-react";
import type { ClimateReading } from "@climasense/shared";

export function ForecastPanel({ latest, history }: { latest: ClimateReading; history: ClimateReading[] }) {
  const last = history.at(-1) ?? latest;
  const previous = history.at(-2) ?? last;
  const trend = last.temperature - previous.temperature;
  const items = [
    { label: "Hiện tại", temp: latest.temperature, humidity: latest.humidity, Icon: CloudSun },
    { label: "+3 giờ", temp: latest.temperature + trend * 0.7 + 0.4, humidity: latest.humidity - 2, Icon: Sun },
    { label: "+6 giờ", temp: latest.temperature + trend + 0.8, humidity: latest.humidity - 4, Icon: Cloud },
    { label: "+9 giờ", temp: latest.temperature + trend * 0.5, humidity: latest.humidity + 1, Icon: CloudRain }
  ];

  return (
    <section className="glass-card forecast-panel p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Dự báo tham khảo</p>
          <h2 className="section-title">Xu hướng 9 giờ tới</h2>
        </div>
        <span className="data-badge">Từ xu hướng quan trắc</span>
      </div>
      <div className="forecast-list">
        {items.map(({ label, temp, humidity, Icon }, index) => (
          <div key={label} className={`forecast-row ${index === 0 ? "is-current" : ""}`}>
            <span className="forecast-time">{label}</span>
            <Icon className="text-cyanCore" size={21} aria-hidden="true" />
            <strong>{temp.toFixed(1)}°</strong>
            <span className="forecast-humidity"><Droplets size={14} aria-hidden="true" /> {Math.max(0, humidity).toFixed(0)}%</span>
          </div>
        ))}
      </div>
      <div className="forecast-footnote">
        <Wind size={15} aria-hidden="true" /> Mô hình tham khảo sẽ được thay thế khi có dữ liệu dự báo chuyên dụng.
      </div>
    </section>
  );
}
