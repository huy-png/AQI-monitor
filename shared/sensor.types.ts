export interface ClimateReading {
  deviceId: string;
  timestamp: string;
  temperature: number;
  humidity: number;
  pressure: number;
  airQuality: number;
  rainfall: number;
  windSpeed: number;
  latitude?: number;
  longitude?: number;
}

export interface ReadingSummary {
  minTemperature: number;
  maxTemperature: number;
  avgTemperature: number;
  avgHumidity: number;
  totalRainfall: number;
  maxWindSpeed: number;
}

export type HistoryInterval = "1h" | "1d" | "1w" | "1mo";
