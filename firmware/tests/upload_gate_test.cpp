#include "upload_gate.h"
static_assert(!canUpload(false, true, 10, 10, 0, 10000), "Auth/status must be verified");
static_assert(canUpload(true, true, 10, 10, 0, 10000), "Snapshot may contain only null measurements");
static_assert(!canUpload(true, false, 10, 10, 0, 10000), "Probe samples must not upload");
static_assert(!canUpload(true, true, 10, 20, 0, 10000), "Reconnect invalidates old queued sample");
static_assert(!canUpload(true, true, 20, 20, 10000, 10000), "Expired sample must not upload");
static_assert(canUpload(true, true, 20, 20, 1, 10000), "Fresh sample after verification can upload");
