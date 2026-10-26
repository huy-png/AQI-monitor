#include <Arduino.h>
#include <TinyGPSPlus.h>
#include "config.h"
#include "sensors.h"
namespace gpsSensor {
using namespace config;
namespace {
TinyGPSPlus gps;
HardwareSerial gpsSerial(1);
uint32_t gpsBytes = 0, gpsSentences = 0, lastGpsOK = 0;
}
void begin() {
  gpsSerial.setRxBufferSize(1024);
  gpsSerial.begin(SENSOR_BAUD, SERIAL_8N1, GPS_RX, GPS_TX);
}
void update() {
  while (gpsSerial.available()) {
    const char c = char(gpsSerial.read());
    ++gpsBytes;
    if (gps.encode(c)) {
      ++gpsSentences;
      lastGpsOK = millis();
    }
  }
}

ModuleStatus status() {
  return uartStatus(gpsBytes, gpsSentences, lastGpsOK, millis(), STALE_MS);
}
bool sampledSince(uint32_t since) { return gps.location.isValid() && gps.location.age() < config::STALE_MS && int32_t((millis() - gps.location.age()) - since) > 0; }
bool read(Reading& reading) {
  if (status() != ModuleStatus::Online || !gps.location.isValid()
      || gps.location.age() >= config::STALE_MS) return false;
  reading.latitude = gps.location.lat();
  reading.longitude = gps.location.lng();
  return true;
}
void report() {
  if (gpsSentences > 0 && millis() - lastGpsOK < config::STALE_MS) {
    Serial.println("[GPS] UART OK: nhan duoc NMEA hop le.");
    if (gps.location.isValid() && gps.location.age() < config::STALE_MS) {
      Serial.printf("  Lat=%.6f | Lng=%.6f\n", gps.location.lat(), gps.location.lng());
    } else {
      Serial.println("  CHUA CO TOA DO MOI: dua anten ra noi thoang troi.");
    }
    if (gps.satellites.isValid() && gps.satellites.age() < config::STALE_MS) {
      Serial.printf("  Ve tinh: %lu\n", (unsigned long)gps.satellites.value());
    }
  } else if (gpsBytes == 0) {
    Serial.printf("[GPS] CHUA CO BYTE: kiem tra nguon/TX -> GPIO%d.\n", GPS_RX);
  } else {
    Serial.println("[GPS] CHUA CO NMEA MOI HOP LE: kiem tra baud/day.");
  }
  Serial.printf("  GPS: bytes=%lu, valid sentences=%lu\n",
                (unsigned long)gpsBytes, (unsigned long)gpsSentences);
}
}
