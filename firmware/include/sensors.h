#pragma once
#include "module_status.h"
#include "reading.h"

namespace bmeSensor {
bool read(Reading& reading);
bool sampledSince(uint32_t since);
void begin();
void update();
void report();
ModuleStatus status();
}
namespace pmsSensor {
bool read(Reading& reading);
bool sampledSince(uint32_t since);
void begin();
void update();
void report();
ModuleStatus status();
}
namespace gpsSensor {
bool read(Reading& reading);
bool sampledSince(uint32_t since);
void begin();
void update();
void report();
ModuleStatus status();
}
