# ClimaSense

ClimaSense là monorepo dashboard giám sát khí hậu từ thiết bị IoT. Frontend React hiển thị dữ liệu mock mặc định, backend NestJS nhận MQTT, lưu MongoDB Time Series Collection, cung cấp REST API và đẩy dữ liệu mới qua WebSocket.

## Yêu cầu môi trường

- Node.js 22+
- npm 10+
- Docker Desktop hoặc Docker Engine
- MQTT client để thử payload, ví dụ `mosquitto_pub`

## Cấu trúc

```text
frontend/  React + Vite + TypeScript + Tailwind + Recharts
backend/   NestJS + Mongoose + MQTT.js + Socket.IO
shared/    Kiểu dữ liệu dùng chung
docker/    Cấu hình Mosquitto
```

## Cài đặt

```bash
npm install
```

Sao chép biến môi trường:

```bash
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
```

Frontend có thể dùng Firebase Realtime Database, dữ liệu mô phỏng hoặc REST API backend:

```env
VITE_DATA_SOURCE=mock
```

Firebase:

```env
VITE_DATA_SOURCE=firebase
VITE_FIREBASE_DATABASE_URL=https://test1-7399f-default-rtdb.asia-southeast1.firebasedatabase.app
VITE_FIREBASE_LATEST_PATH=readings/esp32-garden-01/latest
VITE_FIREBASE_HISTORY_PATH=readings/esp32-garden-01/history
VITE_FIREBASE_DEVICES_PATH=devices
VITE_FIREBASE_ALERTS_PATH=alerts
```

Để dùng backend thật:

```env
VITE_DATA_SOURCE=api
VITE_API_URL=http://localhost:3000/api
VITE_SOCKET_URL=http://localhost:3000
```

## Firebase Realtime Database

File `frontend/.env` hiện đã được cấu hình để đọc Firebase project `test1-7399f`.

Các path mặc định:

```text
readings/esp32-garden-01/latest
readings/esp32-garden-01/history
devices
alerts
```

Reading mẫu:

```json
{
  "deviceId": "esp32-garden-01",
  "timestamp": "2026-07-28T10:30:00Z",
  "temperature": 24.6,
  "humidity": 68,
  "pressure": 1012,
  "airQuality": 42,
  "rainfall": 0,
  "windSpeed": 7.2
}
```

Adapter frontend cũng chấp nhận alias như `temp`, `t`, `temperature_c`, `hum`, `aqi`, `rain_mm`, `wind_kmh`.

## Chạy MongoDB, MQTT Broker và backend bằng Docker

```bash
docker compose up --build
```

Health check:

```bash
curl http://localhost:3000/api/health
```

## Chạy phát triển

Backend:

```bash
npm run dev:backend
```

Frontend:

```bash
npm run dev:frontend
```

## Build production

```bash
npm run build
```

## REST API

```text
GET    /api/devices
GET    /api/devices/:deviceId
POST   /api/devices
PATCH  /api/devices/:deviceId
DELETE /api/devices/:deviceId

GET /api/readings/latest
GET /api/readings/:deviceId/latest
GET /api/readings/:deviceId/history?from=2026-07-01&to=2026-07-28&interval=1h&limit=200
GET /api/readings/:deviceId/summary

GET  /api/alerts
PATCH /api/alerts/:alertId/read

POST /api/devices/:deviceId/commands
```

## MQTT topics

Thiết bị gửi dữ liệu:

```text
climasense/devices/+/readings
climasense/devices/+/status
```

Backend gửi lệnh:

```text
climasense/devices/{deviceId}/commands
```

Payload ESP32 mẫu:

```json
{
  "deviceId": "esp32-garden-01",
  "timestamp": "2026-07-28T10:30:00Z",
  "temperature": 24.6,
  "humidity": 68,
  "pressure": 1012,
  "airQuality": 42,
  "rainfall": 0,
  "windSpeed": 7.2
}
```

Adapter backend cũng chấp nhận các alias như `temp`, `t`, `temperature_c`, `hum`, `aqi`, `rain_mm`, `wind_kmh`.

Gửi thử:

```bash
mosquitto_pub -h localhost -t climasense/devices/esp32-garden-01/readings -m '{"temp":24.6,"hum":68,"pressure_hpa":1012,"aqi":42,"rain_mm":0,"wind_kmh":7.2}'
```

Khi frontend dùng `VITE_DATA_SOURCE=api`, bản ghi mới sẽ được lưu vào MongoDB và cập nhật dashboard qua sự kiện WebSocket `reading:new`.

### Backend đọc Firebase theo cấu trúc thiết bị

Backend hỗ trợ `DATA_SOURCE=firebase` và đọc dữ liệu tại `devices/{deviceId}/latest`. Tạo file `.env` ở thư mục gốc:

```env
DATA_SOURCE=firebase
FIREBASE_DATABASE_URL=https://test1-7399f-default-rtdb.asia-southeast1.firebasedatabase.app
FIREBASE_DATABASE_AUTH=
```

Các API backend vẫn giữ nguyên:

```text
GET /api/readings/latest
GET /api/readings/esp32-587B04D9B4DC/latest
GET /api/readings/esp32-587B04D9B4DC/history
GET /api/devices
```

Nếu Firebase chỉ có `latest` như cấu trúc hiện tại, API history sẽ trả về một bản ghi latest. Muốn biểu đồ có nhiều điểm, cần bổ sung `devices/{deviceId}/history/{readingId}`.

## Kiểm tra

```bash
npm test
```

Test hiện có cho adapter chuẩn hóa payload và summary của readings service.

## Ghi chú bảo mật

Không commit `.env`, mật khẩu MQTT, token hoặc khóa thật. Các giá trị trong `.env.example` và `docker-compose.yml` chỉ là mẫu phát triển cục bộ.
