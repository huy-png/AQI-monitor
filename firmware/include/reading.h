#pragma once
#include <stdint.h>
#include <math.h>
struct Reading {
  float temperature = NAN, humidity = NAN, pressure = NAN;
  float pm1 = NAN, pm25 = NAN, pm10 = NAN;
  double latitude = NAN, longitude = NAN;
  int64_t timestamp = 0;
  uint32_t capturedAt = 0;
};
inline bool validReading(const Reading& r) {
  return isfinite(r.temperature) && isfinite(r.humidity) && r.humidity >= 0 && r.humidity <= 100
    && isfinite(r.pressure) && r.pressure > 0
    && isfinite(r.pm1) && r.pm1 >= 0 && isfinite(r.pm25) && r.pm25 >= 0
    && isfinite(r.pm10) && r.pm10 >= 0
    && isfinite(r.latitude) && r.latitude >= -90 && r.latitude <= 90
    && isfinite(r.longitude) && r.longitude >= -180 && r.longitude <= 180;
}
