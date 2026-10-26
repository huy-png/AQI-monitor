#pragma once
#include <stdint.h>

namespace config {
constexpr int BME_SDA = 9;
constexpr int BME_SCL = 8;
constexpr int PMS_RX = 17; // Module TX -> ESP RX
constexpr int PMS_TX = 18;
constexpr int GPS_RX = 16;
constexpr int GPS_TX = 15;
constexpr uint32_t SERIAL_BAUD = 115200;
constexpr uint32_t SENSOR_BAUD = 9600;
constexpr uint32_t REPORT_MS = 3000;
constexpr uint32_t STALE_MS = 10000;
constexpr uint32_t BME_RETRY_MS = 5000;
constexpr uint32_t PMS_FRAME_TIMEOUT_MS = 500;
}
