#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_BME280.h>
#include <math.h>
#include "config.h"
#include "sensors.h"
namespace bmeSensor {
namespace {
Adafruit_BME280 bme;
bool initialized = false, everSeen = false;
uint8_t address = 0;
uint32_t lastAttempt = 0, lastSample = 0;
float temperature = NAN, humidity = NAN, pressure = NAN;
ModuleStatus current = ModuleStatus::Waiting;

bool responds(uint8_t candidate) {
  Wire.beginTransmission(candidate);
  Wire.write(0xD0);
  if (Wire.endTransmission(false) != 0) return false;
  if (Wire.requestFrom(candidate, uint8_t(1)) != 1) return false;
  return Wire.read() == 0x60;
}
void connect() {
  lastAttempt = millis();
  for (uint8_t candidate : {uint8_t(0x76), uint8_t(0x77)}) {
    if (responds(candidate) && bme.begin(candidate, &Wire)) {
      address = candidate;
      initialized = true;
      everSeen = true;
      return;
    }
  }
}
void sample() {
  lastSample = millis();
  if (!initialized || !responds(address)) {
    initialized = false;
    current = everSeen ? ModuleStatus::Stale : ModuleStatus::Waiting;
    return;
  }
  temperature = bme.readTemperature();
  humidity = bme.readHumidity();
  pressure = bme.readPressure() / 100.0F;
  if (!isfinite(temperature) || !isfinite(humidity) || !isfinite(pressure) || !responds(address)) {
    current = ModuleStatus::ReadError;
    initialized = false;
    return;
  }
  current = ModuleStatus::Online;
}
}
void begin() {
  Wire.begin(config::BME_SDA, config::BME_SCL);
  Wire.setClock(100000);
  Wire.setTimeOut(50);
  Serial.println("[I2C] Quet thiet bi (ACK khong dong nghia BME280):");
  for (uint8_t candidate = 1; candidate < 127; ++candidate) {
    Wire.beginTransmission(candidate);
    if (Wire.endTransmission() == 0) Serial.printf("  ACK 0x%02X\n", unsigned(candidate));
  }
  connect();
  sample();
}
void update() {
  if (!initialized) {
    if (millis() - lastAttempt < config::BME_RETRY_MS) return;
    connect();
    sample();
  } else if (millis() - lastSample >= config::REPORT_MS) {
    sample();
  }
}
ModuleStatus status() { return current; }
bool sampledSince(uint32_t since) { return current == ModuleStatus::Online && int32_t(lastSample - since) > 0; }
bool read(Reading& reading) {
  if (current != ModuleStatus::Online || millis() - lastSample >= config::STALE_MS) return false;
  reading.temperature = temperature;
  reading.humidity = humidity;
  reading.pressure = pressure;
  return true;
}
void report() {
  if (current == ModuleStatus::Online) {
    Serial.printf("[BME280] 0x%02X: T=%.2f C | H=%.2f %% | P=%.2f hPa\n",
                  unsigned(address), temperature, humidity, pressure);
  } else {
    Serial.println("[BME280] Kiem tra nguon/I2C/loai chip; tu thu ket noi lai.");
  }
}
}
