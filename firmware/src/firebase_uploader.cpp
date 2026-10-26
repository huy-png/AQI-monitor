#include <Arduino.h>
#include <ArduinoJson.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <time.h>
#include <atomic>
#include "firebase_config.h"
#include "firebase_uploader.h"
#include "sensors.h"
#include "upload_gate.h"
#include "firmware_version.h"
#if __has_include("secrets.h")
#include "secrets.h"
#else
#include "secrets.example.h"
#endif

extern const char googleRoots[] asm("_binary_certs_google_roots_pem_start");
namespace firebaseUploader {
namespace {
struct Snapshot {
  Reading reading;
  uint32_t collectionEpoch;
  ModuleStatus bme, pms, gps;
  bool bmeReady, pmsReady, gpsReady, ready, newSample;
};
QueueHandle_t queue = nullptr;
std::atomic<bool> collectionAllowed{false};
std::atomic<uint32_t> collectionStarted{0};
enum class NetworkStep { Waiting, Authenticating, Status, Snapshot, Latest, Idle };
std::atomic<NetworkStep> networkStep{NetworkStep::Waiting};
std::atomic<uint32_t> networkStepStarted{0};
void setNetworkStep(NetworkStep step) {
  networkStepStarted.store(millis());
  networkStep.store(step);
}
const char* stepName(NetworkStep step) {
  switch (step) {
    case NetworkStep::Authenticating: return "AUTH";
    case NetworkStep::Status: return "STATUS";
    case NetworkStep::Snapshot: return "SNAPSHOT";
    case NetworkStep::Latest: return "LATEST";
    case NetworkStep::Idle: return "CHO_CHU_KY";
    default: return "CHO_WIFI_NTP";
  }
}
void pauseCollection() {
  if (collectionAllowed.exchange(false))
    Serial.println("[TIEN TRINH] Tam dung so do; can xac nhan lai Firebase.");
}

const char* stateCode(ModuleStatus state, bool ready, bool gps) {
  if (ready) return "ok";
  switch (state) {
    case ModuleStatus::Waiting: return "no_data";
    case ModuleStatus::InvalidData: return "invalid_data";
    case ModuleStatus::Stale: return "stale";
    case ModuleStatus::ReadError: return "read_error";
    case ModuleStatus::Online: return gps ? "no_fix" : "invalid_data";
  }
  return "invalid_data";
}
void addModule(JsonObject object, ModuleStatus state, bool ready, bool gps, const char* check) {
  object["state"] = stateCode(state, ready, gps);
  object["ready"] = ready;
  object["dataMissing"] = !ready;
  object["message"] = ready ? String("Du lieu hop le") :
    String("Khong co du lieu hop le; cac truong cua module gui null. ") +
    (gps && state == ModuleStatus::Online ? "Chua co toa do moi; dua anten ra noi thoang troi" : check);
}
bool enabled = false;
String nodeId, idToken, refreshToken;
uint32_t tokenIssued = 0, tokenLifetime = 0, sampleNumber = 0;
int64_t lastLatestTimestamp = 0;

// Never print request URLs, bodies, passwords or authentication responses.
int request(const String& url, const String& body, const char* contentType,
            bool put, String& response) {
  WiFiClientSecure client;
  client.setCACert(googleRoots);
  client.setHandshakeTimeout(10);
  HTTPClient http;
  // Auth responses use an identity body; do not depend on keep-alive closing.
  http.useHTTP10(true);
  http.setReuse(false);
  http.setConnectTimeout(10000);
  http.setTimeout(10000);
  if (!http.begin(client, url)) return -1;
  http.addHeader("Content-Type", contentType);
  int code = put ? http.PUT(body) : http.POST(body);
  response = "";
  // PUT uses print=silent. Never wait for a body on 204 or database writes.
  // Only a successful auth request needs a response body.
  if (!put && code == 200) {
    const int expected = http.getSize();
    constexpr size_t MAX_AUTH_BODY = 16384;
    if (expected > int(MAX_AUTH_BODY)) {
      http.end();
      return -1001;
    }
    const uint32_t started = millis();
    while (expected < 0 || response.length() < size_t(expected)) {
      if (millis() - started >= 10000) { code = -1002; break; }
      const int available = client.available();
      if (available > 0) {
        char buffer[256];
        size_t count = size_t(available) < sizeof(buffer) ? size_t(available) : sizeof(buffer);
        if (expected >= 0 && count > size_t(expected) - response.length())
          count = size_t(expected) - response.length();
        const int received = client.read(reinterpret_cast<uint8_t*>(buffer), count);
        if (received > 0) {
          if (response.length() + size_t(received) > MAX_AUTH_BODY) { code = -1001; break; }
          if (!response.concat(buffer, size_t(received))) { code = -1003; break; }
        }
      } else if (!client.connected()) {
        if (expected >= 0 && response.length() != size_t(expected)) code = -1002;
        break;
      } else {
        vTaskDelay(pdMS_TO_TICKS(10));
      }
    }
  }
  http.end();
  return code;
}
String urlEncode(const String& text) {
  String result;
  const char hex[] = "0123456789ABCDEF";
  for (size_t i = 0; i < text.length(); ++i) {
    unsigned char c = text[i];
    if (isalnum(c) || c == '-' || c == '_' || c == '.' || c == '~') result += char(c);
    else { result += '%'; result += hex[c >> 4]; result += hex[c & 15]; }
  }
  return result;
}
bool authenticate() {
  setNetworkStep(NetworkStep::Authenticating);
  const bool refresh = !refreshToken.isEmpty();
  String url, body, response;
  if (refresh) {
    url = String("https://securetoken.googleapis.com/v1/token?key=") + firebaseConfig::API_KEY;
    body = "grant_type=refresh_token&refresh_token=" + urlEncode(refreshToken);
  } else {
    url = String("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=") + firebaseConfig::API_KEY;
    StaticJsonDocument<1024> login;
    login["email"] = FIREBASE_EMAIL;
    login["password"] = FIREBASE_PASSWORD;
    login["returnSecureToken"] = true;
    if (login.overflowed()) return false;
    serializeJson(login, body);
  }
  int code = request(url, body, refresh ? "application/x-www-form-urlencoded" : "application/json", false, response);
  if (code != 200) {
    Serial.printf("[Firebase] Auth HTTP %d; kiem tra tai khoan/Email-Password/API key/mang. Thu lai sau 30s.\n", code);
    if (refresh && code == 400) refreshToken = "";
    return false;
  }
  DynamicJsonDocument result(12288);
  if (deserializeJson(result, response)) {
    Serial.println("[Firebase] Khong doc duoc phan hoi Auth.");
    return false;
  }
  String nextToken = result[refresh ? "id_token" : "idToken"].as<String>();
  String nextRefresh = result[refresh ? "refresh_token" : "refreshToken"].as<String>();
  long seconds = result[refresh ? "expires_in" : "expiresIn"].as<String>().toInt();
  if (nextToken.isEmpty() || nextRefresh.isEmpty() || seconds <= 60) return false;
  idToken = nextToken;
  refreshToken = nextRefresh;
  tokenLifetime = uint32_t(seconds > 3600 ? 3540 : seconds - 60) * 1000;
  tokenIssued = millis();
  Serial.println(refresh ? "[Firebase] Da gia han token." : "[Firebase] Dang nhap thanh cong.");
  return true;
}
void worker(void*) {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  nodeId = WiFi.macAddress();
  nodeId.replace(":", "");
  nodeId.toUpperCase();
  nodeId = "esp32-" + nodeId;
  Serial.printf("[Firebase] Node: %s\n", nodeId.c_str());
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  configTime(0, 0, "time.google.com", "pool.ntp.org");
  uint32_t lastWifiTry = millis();
  bool wasConnected = false;
  for (;;) {
    if (WiFi.status() != WL_CONNECTED) {
      setNetworkStep(NetworkStep::Waiting);
      pauseCollection();
      if (wasConnected) Serial.println("[WiFi] Mat ket noi.");
      wasConnected = false;
      if (millis() - lastWifiTry >= firebaseConfig::RETRY_MS) {
        Serial.println("[WiFi] Dang thu ket noi lai; kiem tra SSID/mat khau/song Wi-Fi.");
        WiFi.reconnect();
        lastWifiTry = millis();
      }
      vTaskDelay(pdMS_TO_TICKS(1000));
      continue;
    }
    if (!wasConnected) Serial.printf("[WiFi] Da ket noi, IP=%s\n", WiFi.localIP().toString().c_str());
    wasConnected = true;
    if (time(nullptr) < firebaseConfig::MIN_UNIX_TIME) {
      pauseCollection();
      Serial.println("[Firebase] Cho dong bo NTP de xac minh TLS va gan timestamp.");
      vTaskDelay(pdMS_TO_TICKS(10000));
      continue;
    }
    if (idToken.isEmpty() || millis() - tokenIssued >= tokenLifetime) {
      pauseCollection();
      if (!authenticate()) {
        vTaskDelay(pdMS_TO_TICKS(firebaseConfig::RETRY_MS));
        continue;
      }
    }
    Snapshot snapshot;
    if (xQueueReceive(queue, &snapshot, pdMS_TO_TICKS(1000)) != pdTRUE) {
      Serial.println("[Firebase] CHO SNAPSHOT: chua nhan ban chup tu loop cam bien.");
      continue;
    }
    const Reading& reading = snapshot.reading;
    if (millis() - reading.capturedAt >= firebaseConfig::MAX_SAMPLE_AGE_MS
        || reading.timestamp < firebaseConfig::MIN_UNIX_TIME) {
      Serial.println("[Firebase] BO SNAPSHOT: mau qua han hoac thoi gian chua hop le.");
      continue;
    }

    // Status does not require a GPS fix or valid measurements.
    StaticJsonDocument<2048> health;
    health["nodeId"] = nodeId;
    health["firmwareVersion"] = FIRMWARE_VERSION;
    health["timestamp"] = reading.timestamp;
    time_t capturedTime = reading.timestamp;
    struct tm utc;
    gmtime_r(&capturedTime, &utc);
    char iso[25];
    strftime(iso, sizeof(iso), "%Y-%m-%dT%H:%M:%SZ", &utc);
    health["timestampIso"] = iso;
    health["simulated"] = false;
    health["sampleNumber"] = sampleNumber; // Latest writes confirmed before this status report.
    health["lastLatestTimestamp"] = lastLatestTimestamp;
    health["receivedAt"][".sv"] = "timestamp"; // Firebase server time in milliseconds.
    health["ready"] = snapshot.ready;
    health["phase"] = !collectionAllowed.load() ? "verifying_firebase" :
      (snapshot.newSample ? "collecting" : "waiting_for_data");
    health["message"] = snapshot.ready ? "Tat ca module san sang" : "Kiem tra cac module chua san sang";
    JsonObject modules = health.createNestedObject("modules");
    addModule(modules.createNestedObject("bme280"), snapshot.bme, snapshot.bmeReady, false,
              "Kiem tra nguon, GND, SDA/SCL va module BME280");
    addModule(modules.createNestedObject("pms7003"), snapshot.pms, snapshot.pmsReady, false,
              "Kiem tra nguon, GND, TX/RX va baud PMS7003");
    addModule(modules.createNestedObject("gps"), snapshot.gps, snapshot.gpsReady, true,
              "Kiem tra nguon, GND, TX/RX va baud GPS");
    String healthBody, healthResponse;
    if (health.overflowed()) {
      Serial.println("[Firebase] STATUS JSON qua lon; khong gui ban ghi thieu truong.");
      vTaskDelay(pdMS_TO_TICKS(firebaseConfig::RETRY_MS));
      continue;
    }
    serializeJson(health, healthBody);
    String healthUrl = String(firebaseConfig::DATABASE_URL) + "/devices/" + nodeId + "/status.json?auth=" + idToken + "&print=silent";
    Serial.println("[Firebase] DANG GUI STATUS...");
    setNetworkStep(NetworkStep::Status);
    int healthCode = request(healthUrl, healthBody, "application/json", true, healthResponse);
    bool healthOK = healthCode == 200 || healthCode == 204;
    Serial.printf("[Firebase] STATUS %s HTTP %d -> devices/%s/status\n", healthOK ? "OK" : "LOI", healthCode, nodeId.c_str());
    if (healthCode == 401 || healthCode == 403) {
      Serial.println("[Firebase] Can cap nhat rules cho nhanh status va kiem tra tai khoan.");
      idToken = "";
    }
    if (!healthOK) pauseCollection();
    if (healthOK && !collectionAllowed.load()) {
      // Only permit new sensor samples after the server acknowledges a status write.
      collectionStarted.store(millis());
      xQueueReset(queue);
      collectionAllowed.store(true);
      Serial.println("[BUOC 2/3] OK: Wi-Fi + NTP + Auth + ghi Firebase status thanh cong.");
      Serial.println("[BUOC 3/3] Bat dau gui mau moi; module thieu du lieu se gui null va bao loi status.");
      // Continue directly to a fresh snapshot in this same cycle.
    }
    if (!healthOK) {
      vTaskDelay(pdMS_TO_TICKS(firebaseConfig::RETRY_MS));
      continue;
    }
    // HTTPS status may take longer than the snapshot lifetime. Get the newest
    // snapshot produced while the network task was waiting, rather than dropping
    // every latest write on a slow connection. `reading` references snapshot.
    setNetworkStep(NetworkStep::Snapshot);
    if (xQueueReceive(queue, &snapshot, pdMS_TO_TICKS(1500)) != pdTRUE) {
      Serial.println("[Firebase] CHUA GUI LATEST: khong co snapshot moi sau status.");
      vTaskDelay(pdMS_TO_TICKS(1000));
      continue;
    }
    if (reading.timestamp < firebaseConfig::MIN_UNIX_TIME
        || !canUpload(collectionAllowed.load(), snapshot.newSample,
          snapshot.collectionEpoch, collectionStarted.load(),
          millis() - reading.capturedAt, firebaseConfig::MAX_SAMPLE_AGE_MS)) {
      Serial.printf("[Firebase] CHUA GUI LATEST: verified=%d fresh=%d epoch=%lu/%lu age=%lu ms.\n",
                    int(collectionAllowed.load()), int(snapshot.newSample),
                    (unsigned long)snapshot.collectionEpoch, (unsigned long)collectionStarted.load(),
                    (unsigned long)(millis() - reading.capturedAt));
      vTaskDelay(pdMS_TO_TICKS(1000));
      continue;
    }
    StaticJsonDocument<1024> json;
    if (snapshot.bmeReady) json["temperature"] = reading.temperature;
    else json["temperature"] = nullptr;
    if (snapshot.bmeReady) json["humidity"] = reading.humidity;
    else json["humidity"] = nullptr;
    if (snapshot.bmeReady) json["pressure"] = reading.pressure;
    else json["pressure"] = nullptr;
    if (snapshot.pmsReady) json["pm1"] = reading.pm1;
    else json["pm1"] = nullptr;
    if (snapshot.pmsReady) json["pm25"] = reading.pm25;
    else json["pm25"] = nullptr;
    if (snapshot.pmsReady) json["pm10"] = reading.pm10;
    else json["pm10"] = nullptr;
    if (snapshot.gpsReady) json["latitude"] = reading.latitude;
    else json["latitude"] = nullptr;
    if (snapshot.gpsReady) json["longitude"] = reading.longitude;
    else json["longitude"] = nullptr;
    String body, response;
    if (json.overflowed()) {
      Serial.println("[Firebase] LATEST JSON qua lon; khong gui ban ghi thieu truong.");
      vTaskDelay(pdMS_TO_TICKS(firebaseConfig::RETRY_MS));
      continue;
    }
    serializeJson(json, body);
    String url = String(firebaseConfig::DATABASE_URL) + "/devices/" + nodeId + "/latest.json?auth=" + idToken + "&print=silent";
    Serial.printf("[Firebase] DANG GUI LATEST: BME=%s PMS=%s GPS=%s age=%lu ms.\n",
                  snapshot.bmeReady ? "OK" : "NULL", snapshot.pmsReady ? "OK" : "NULL",
                  snapshot.gpsReady ? "OK" : "NULL", (unsigned long)(millis() - reading.capturedAt));
    setNetworkStep(NetworkStep::Latest);
    const uint32_t latestStarted = millis();
    int code = request(url, body, "application/json", true, response);
    Serial.printf("[Firebase] LATEST HTTP %d (%lu ms)\n", code, (unsigned long)(millis() - latestStarted));
    if (code == 200 || code == 204) {
      ++sampleNumber;
      lastLatestTimestamp = reading.timestamp;
      Serial.printf("[Firebase] GUI OK #%lu -> devices/%s/latest\n", (unsigned long)sampleNumber, nodeId.c_str());
    } else {
      pauseCollection();
      Serial.printf("[Firebase] GUI LOI HTTP %d.\n", code);
      if (code == 401 || code == 403) {
        Serial.println("[Firebase] Kiem tra rules/email; latest chi gom so do, cho phep null. Se lam moi token.");
        idToken = "";
      }
    }
    setNetworkStep(NetworkStep::Idle);
    vTaskDelay(pdMS_TO_TICKS(code == 200 || code == 204 ? firebaseConfig::UPLOAD_MS : firebaseConfig::RETRY_MS));
  }
}
}
bool collecting() { return collectionAllowed.load(); }
void begin() {
  if (!strlen(WIFI_SSID) || !strlen(FIREBASE_EMAIL) || !strlen(FIREBASE_PASSWORD)) {
    Serial.println("[Firebase] Chua cau hinh: dien include/secrets.h. Serial cam bien van hoat dong.");
    return;
  }
  queue = xQueueCreate(1, sizeof(Snapshot));
  if (!queue) { Serial.println("[Firebase] Khong du RAM tao hang doi."); return; }
  if (xTaskCreate(worker, "firebase", 16384, nullptr, 1, nullptr) != pdPASS) {
    vQueueDelete(queue);
    queue = nullptr;
    Serial.println("[Firebase] Khong tao duoc tac vu mang.");
    return;
  }
  enabled = true;
}
void update() {
  static uint32_t lastSnapshot = 0, lastWarning = 0;
  if (!enabled || millis() - lastSnapshot < 1000) return;
  lastSnapshot = millis();
  static uint32_t lastProgress = 0;
  if (millis() - lastProgress >= firebaseConfig::UPLOAD_MS) {
    Serial.printf("[Firebase] TIEN TRINH %s: %s (%lu ms), verified=%d\n", FIRMWARE_VERSION,
      stepName(networkStep.load()), (unsigned long)(millis() - networkStepStarted.load()),
      int(collectionAllowed.load()));
    lastProgress = millis();
  }
  Snapshot snapshot{};
  Reading& reading = snapshot.reading;
  const bool bmeOK = bmeSensor::read(reading);
  const bool pmsOK = pmsSensor::read(reading);
  const bool gpsOK = gpsSensor::read(reading);
  reading.timestamp = time(nullptr);
  reading.capturedAt = millis();
  snapshot.bme = bmeSensor::status();
  snapshot.pms = pmsSensor::status();
  snapshot.gps = gpsSensor::status();
  const bool allowed = collectionAllowed.load();
  const uint32_t since = collectionStarted.load();
  snapshot.collectionEpoch = since;
  // Each module is independent; reject invalid or pre-verification cached values.
  snapshot.bmeReady = bmeOK && (!allowed || bmeSensor::sampledSince(since))
    && isfinite(reading.temperature) && isfinite(reading.humidity)
    && reading.humidity >= 0 && reading.humidity <= 100
    && isfinite(reading.pressure) && reading.pressure > 0;
  snapshot.pmsReady = pmsOK && (!allowed || pmsSensor::sampledSince(since))
    && isfinite(reading.pm1) && reading.pm1 >= 0
    && isfinite(reading.pm25) && reading.pm25 >= 0
    && isfinite(reading.pm10) && reading.pm10 >= 0;
  snapshot.gpsReady = gpsOK && (!allowed || gpsSensor::sampledSince(since))
    && isfinite(reading.latitude) && reading.latitude >= -90 && reading.latitude <= 90
    && isfinite(reading.longitude) && reading.longitude >= -180 && reading.longitude <= 180;
  snapshot.ready = snapshot.bmeReady && snapshot.pmsReady && snapshot.gpsReady;
  snapshot.newSample = allowed && int32_t(reading.capturedAt - since) > 0;
  // Always publish module health, including startup without any module.
  xQueueOverwrite(queue, &snapshot);
  if (!snapshot.ready || !snapshot.newSample || reading.timestamp < firebaseConfig::MIN_UNIX_TIME) {
    if (millis() - lastWarning >= firebaseConfig::UPLOAD_MS) {
      Serial.printf("[Firebase] Mau: BME=%s PMS=%s GPS=%s NTP=%s; thieu du lieu gui null sau xac nhan Firebase.\n",
        snapshot.bmeReady ? "OK" : "NULL", snapshot.pmsReady ? "OK" : "NULL", snapshot.gpsReady ? "OK" : "NULL",
        reading.timestamp >= firebaseConfig::MIN_UNIX_TIME ? "OK" : "CHO");
      lastWarning = millis();
    }
  }
}
}
