#pragma once
#include <stdint.h>

// An old queued sample must never cross a reconnect/verification boundary.
constexpr bool canUpload(bool verified, bool fresh,
                         uint32_t sampleEpoch, uint32_t activeEpoch,
                         uint32_t age, uint32_t maxAge) {
  return verified && fresh && sampleEpoch == activeEpoch && age < maxAge;
}
