#include <Arduino.h>
#include "config.h"
#include "sensors.h"
#include "diagnostics.h"
#include "firebase_uploader.h"

namespace diagnostics {
namespace {
const char* names[] = {"BME280", "PMS7003", "GPS"};
ModuleStatus previous[3];
uint32_t lastReport = 0;
void readStatuses(ModuleStatus (&states)[3]) {
  states[0] = bmeSensor::status();
  states[1] = pmsSensor::status();
  states[2] = gpsSensor::status();
}
}
void report() {
  ModuleStatus states[3];
  readStatuses(states);
  unsigned online = 0;
  Serial.println("\n=== TRANG THAI MODULE ===");
  for (unsigned i = 0; i < 3; ++i) {
    Serial.printf("%-8s | %s\n", names[i], statusText(states[i]));
    if (states[i] == ModuleStatus::Online) ++online;
  }
  Serial.printf("Dang phan hoi hop le: %u/3 module\n", online);
  if (firebaseUploader::collecting()) {
    bmeSensor::report();
    pmsSensor::report();
    gpsSensor::report();
  } else {
    Serial.println("Dang kiem tra giao tiep; chua bat dau bao cao so do.");
  }
}
void begin() {
  Serial.printf("BME280: SDA=%d SCL=%d | PMS: RX=%d TX=%d | GPS: RX=%d TX=%d\n",
                config::BME_SDA, config::BME_SCL, config::PMS_RX, config::PMS_TX,
                config::GPS_RX, config::GPS_TX);
  Serial.println("UART: chi xac nhan duong module TX -> ESP RX qua du lieu hop le.");
  Serial.println("Khong do VCC/GND; khong tu tim GPIO. GPS UART OK khong dong nghia co toa do.");
  Serial.printf("Bao cao moi %lu ms; UART het du lieu moi sau %lu ms.\n",
                (unsigned long)config::REPORT_MS, (unsigned long)config::STALE_MS);
  readStatuses(previous);
  report();
  lastReport = millis();
}
void update() {
  ModuleStatus states[3];
  readStatuses(states);
  for (unsigned i = 0; i < 3; ++i) {
    if (states[i] != previous[i]) {
      Serial.printf("[THAY DOI] %s: %s -> %s\n", names[i],
                    statusText(previous[i]), statusText(states[i]));
      previous[i] = states[i];
    }
  }
  if (millis() - lastReport >= config::REPORT_MS) {
    lastReport = millis();
    report();
  }
}
}
