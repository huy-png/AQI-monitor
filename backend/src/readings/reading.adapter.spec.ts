import { BadRequestException } from "@nestjs/common";
import { ReadingAdapter } from "./reading.adapter";

describe("ReadingAdapter", () => {
  const adapter = new ReadingAdapter();

  it("normalizes alternate sensor field names", () => {
    const reading = adapter.normalize(
      {
        t: "24.6",
        hum: 68,
        pressure_hpa: 1012,
        aqi: 42,
        rain_mm: 0,
        wind_kmh: 7.2
      },
      "esp32-garden-01"
    );

    expect(reading).toMatchObject({
      deviceId: "esp32-garden-01",
      temperature: 24.6,
      humidity: 68,
      pressure: 1012,
      airQuality: 42,
      rainfall: 0,
      windSpeed: 7.2
    });
  });

  it("rejects invalid humidity", () => {
    expect(() =>
      adapter.normalize({
        deviceId: "bad",
        timestamp: "2026-07-28T10:30:00Z",
        temperature: 20,
        humidity: 150,
        pressure: 1010,
        airQuality: 20,
        rainfall: 0,
        windSpeed: 1
      })
    ).toThrow(BadRequestException);
  });
});
