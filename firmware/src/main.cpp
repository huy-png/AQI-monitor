#include <Arduino.h>
#include "config.h"
#include "sensors.h"
#include "diagnostics.h"
#include "firebase_uploader.h"
#include "firmware_version.h"

void setup() {
  Serial.begin(config::SERIAL_BAUD);
  delay(2000);
  Serial.printf("[FIRMWARE] %s | build %s %s\n", FIRMWARE_VERSION, __DATE__, __TIME__);
  Serial.println("\n=== CLIMASENSE: KIEM TRA MODULE ===");
  pmsSensor::begin();
  gpsSensor::begin();
  bmeSensor::begin();
  diagnostics::begin();
  Serial.println("[BUOC 1/3] Kiem tra module toi da 10 giay...");
}

void loop() {
  pmsSensor::update();
  gpsSensor::update();
  bmeSensor::update();
  diagnostics::update();
  static bool networkStarted = false;
  static uint32_t checkStarted = millis();
  if (!networkStarted) {
    bool allDetected = bmeSensor::status() == ModuleStatus::Online
      && pmsSensor::status() == ModuleStatus::Online
      && gpsSensor::status() == ModuleStatus::Online;
    if (allDetected || millis() - checkStarted >= 10000) {
      Serial.printf("[BUOC 1/3] Ket qua: BME=%s | PMS=%s | GPS-UART=%s\n",
        statusText(bmeSensor::status()), statusText(pmsSensor::status()), statusText(gpsSensor::status()));
      Serial.println("[BUOC 2/3] Kiem tra Wi-Fi, NTP, Auth va quyen ghi Firebase status.");
      firebaseUploader::begin();
      networkStarted = true;
    }
  }
  if (networkStarted) firebaseUploader::update();
  delay(1);
}
