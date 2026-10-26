#include "module_status.h"

// Compile-time regression checks; no board required.
static_assert(uartStatus(0, 0, 0, 12000, 10000) == ModuleStatus::Waiting, "No module data");
static_assert(uartStatus(32, 0, 0, 12000, 10000) == ModuleStatus::InvalidData, "Noise is not detection");
static_assert(uartStatus(32, 1, 0, 9999, 10000) == ModuleStatus::Online, "Valid data is fresh");
static_assert(uartStatus(32, 1, 0, 10000, 10000) == ModuleStatus::Stale, "Timeout boundary");
static_assert(uartStatus(64, 2, 15000, 15001, 10000) == ModuleStatus::Online, "Recovery");
static_assert(uartStatus(32, 1, 0xfffffff0u, 20, 10000) == ModuleStatus::Online, "Clock wrap fresh");
static_assert(uartStatus(32, 1, 0xfffffff0u, 10000, 10000) == ModuleStatus::Stale, "Clock wrap stale");
