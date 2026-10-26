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
  /** Ambient pollutant concentrations in µg/Nm³; absent when not measured. */
  so2?: number;
  co?: number;
  no2?: number;
  o3?: number;
  tsp?: number;
  pm10?: number;
  pm25?: number;
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
