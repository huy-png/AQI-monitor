#include <Arduino.h>
#include "config.h"
#include "sensors.h"
namespace pmsSensor {
using namespace config;
namespace {
HardwareSerial pmsSerial(2);
uint8_t frame[32];
size_t frameIndex = 0;
uint16_t pm1 = 0, pm25 = 0, pm10 = 0;
uint32_t pmsBytes = 0, pmsFrames = 0, pmsErrors = 0;
uint32_t lastPmsOK = 0, lastPmsByte = 0;
}
void begin() {
  pmsSerial.setRxBufferSize(512);
  pmsSerial.begin(SENSOR_BAUD, SERIAL_8N1, PMS_RX, PMS_TX);
}
uint16_t read16(const uint8_t *p) {
  return (uint16_t(p[0]) << 8) | p[1];
}

void update() {
  if (frameIndex > 0 && millis() - lastPmsByte > config::PMS_FRAME_TIMEOUT_MS) frameIndex = 0;
  while (pmsSerial.available()) {
    const uint8_t c = uint8_t(pmsSerial.read());
    ++pmsBytes;
    lastPmsByte = millis();
    if (frameIndex == 0) {
      if (c == 0x42) frame[frameIndex++] = c;
      continue;
    }
    if (frameIndex == 1) {
      if (c == 0x4D) frame[frameIndex++] = c;
      else frameIndex = (c == 0x42) ? 1 : 0;
      continue;
    }
    frame[frameIndex++] = c;
    if (frameIndex == 4 && read16(&frame[2]) != 28) {
      ++pmsErrors;
      frameIndex = 0;
      continue;
    }
    if (frameIndex == sizeof(frame)) {
      uint16_t checksum = 0;
      for (size_t i = 0; i < 30; ++i) checksum += frame[i];
      if (checksum == read16(&frame[30])) {
        // Atmospheric environment concentrations, ug/m3.
        pm1 = read16(&frame[10]);
        pm25 = read16(&frame[12]);
        pm10 = read16(&frame[14]);
        ++pmsFrames;
        lastPmsOK = millis();
      } else {
        ++pmsErrors;
      }
      frameIndex = 0;
    }
  }
}

ModuleStatus status() {
  return uartStatus(pmsBytes, pmsFrames, lastPmsOK, millis(), STALE_MS);
}
bool sampledSince(uint32_t since) { return status() == ModuleStatus::Online && int32_t(lastPmsOK - since) > 0; }
bool read(Reading& reading) {
  if (status() != ModuleStatus::Online) return false;
  reading.pm1 = pm1;
  reading.pm25 = pm25;
  reading.pm10 = pm10;
  return true;
}
void report() {
  if (pmsFrames > 0 && millis() - lastPmsOK < config::STALE_MS) {
    Serial.printf("[PMS7003] OK: PM1=%u | PM2.5=%u | PM10=%u ug/m3\n",
                  unsigned(pm1), unsigned(pm25), unsigned(pm10));
  } else if (pmsBytes == 0) {
    Serial.printf("[PMS7003] CHUA CO BYTE: kiem tra nguon/TX -> GPIO%d.\n", PMS_RX);
  } else {
    Serial.println("[PMS7003] CHUA CO FRAME MOI HOP LE: kiem tra baud/day.");
  }
  Serial.printf("  PMS: bytes=%lu, frames=%lu, errors=%lu\n",
                (unsigned long)pmsBytes, (unsigned long)pmsFrames, (unsigned long)pmsErrors);

}
}
