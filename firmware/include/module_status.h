#pragma once
#include <stdint.h>

enum class ModuleStatus { Waiting, InvalidData, Online, Stale, ReadError };

constexpr ModuleStatus uartStatus(uint32_t bytes, uint32_t validCount,
                               uint32_t lastValid, uint32_t now, uint32_t timeout) {
  return validCount == 0
    ? (bytes == 0 ? ModuleStatus::Waiting : ModuleStatus::InvalidData)
    : (uint32_t(now - lastValid) < timeout ? ModuleStatus::Online : ModuleStatus::Stale);
}

inline const char* statusText(ModuleStatus status) {
  switch (status) {
    case ModuleStatus::Waiting: return "CHUA NHAN MODULE";
    case ModuleStatus::InvalidData: return "CO BYTE / CHUA CO DU LIEU HOP LE";
    case ModuleStatus::Online: return "DA NHAN MODULE";
    case ModuleStatus::Stale: return "MAT PHAN HOI / HET DU LIEU MOI";
    case ModuleStatus::ReadError: return "DA NHAN CHIP / LOI DOC";
  }
  return "KHONG XAC DINH";
}
