import { ReadingsService } from "./readings.service";

describe("ReadingsService", () => {
  it("calculates summary values from history", async () => {
    const service = new ReadingsService({} as never, {} as never, {} as never, {} as never, {} as never);
    jest.spyOn(service, "history").mockResolvedValue([
      {
        deviceId: "esp32",
        timestamp: "2026-07-28T00:00:00Z",
        temperature: 20,
        humidity: 60,
        pressure: 1010,
        airQuality: 40,
        rainfall: 1,
        windSpeed: 3
      },
      {
        deviceId: "esp32",
        timestamp: "2026-07-28T01:00:00Z",
        temperature: 24,
        humidity: 70,
        pressure: 1011,
        airQuality: 42,
        rainfall: 2,
        windSpeed: 5
      }
    ]);

    await expect(service.summary("esp32", {})).resolves.toEqual({
      minTemperature: 20,
      maxTemperature: 24,
      avgTemperature: 22,
      avgHumidity: 65,
      totalRainfall: 3,
      maxWindSpeed: 5
    });
  });
});
