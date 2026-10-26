# Lưu lịch sử thiết bị vào MongoDB

Luồng: ESP32 → Firebase `devices/{id}/latest` → backend subscriber → MongoDB `climasense.firebase_readings`.
Web vẫn đọc số đo trực tiếp từ Firebase; biểu đồ, lịch sử và báo cáo đọc API backend.
Không thêm nhánh hàng đợi và không cần nạp lại firmware hoặc đổi rules hiện tại.

## Chạy cục bộ

1. Chạy `powershell -ExecutionPolicy Bypass -File scripts/start-local-mongodb.ps1` từ thư mục dự án.
2. Chạy `npm run dev:backend` (hoặc build backend rồi `npm -w @climasense/backend start`). Chỉ chạy một backend thu thập cho database này.
3. Chạy web như trước. `VITE_API_URL=http://localhost:3000/api`.

MongoDB chỉ bind `127.0.0.1:27017`. Dữ liệu nằm ở `.local/mongodb/data`; log `.local/mongodb/mongo.log`. Không xóa thư mục này nếu cần giữ lịch sử. Không tự khởi động cùng Windows; sau khi khởi động máy cần chạy lại MongoDB/backend. Đóng web không dừng thu thập; tắt backend hoặc tắt máy sẽ dừng.

Cấu hình backend ở `.env` gốc (không commit thông tin đăng nhập):

```dotenv
DATA_SOURCE=module
MONGODB_URI=mongodb://127.0.0.1:27017/climasense
FIREBASE_DATABASE_URL=https://YOUR_DATABASE.firebasedatabase.app
FIREBASE_API_KEY=YOUR_WEB_API_KEY
FIREBASE_AUTH_EMAIL=YOUR_DEVICE_ACCOUNT
FIREBASE_AUTH_PASSWORD=YOUR_PASSWORD
FRONTEND_URL=http://localhost:5173,http://localhost:5178,http://127.0.0.1:5178
```

SDK Firebase tự gia hạn token; tài khoản phải có quyền đọc `devices`. Backend không ghi vào Firebase. Nếu triển khai backend công khai cần bổ sung xác thực API; cấu hình này dành cho máy local.

## Bản ghi

- Lưu temperature, humidity, pressure, pm1, pm25, pm10, latitude, longitude và các thông số khí nếu có.
- Thiếu hoặc sai kiểu/phạm vi → `null`, không tạo số 0 giả. Payload hoàn toàn không có số đo hợp lệ không tạo bản ghi.
- `timestamp`: thời điểm đo nếu latest có timestamp hợp lệ; nếu không, thời điểm backend nhận.
- `timestampSource`: `device` hoặc `backend_received`. `receivedAt` luôn là thời điểm backend lưu nhận.
- Với firmware hiện tại latest không có timestamp nên sử dụng `backend_received`; snapshot nhận ngay lúc khởi động có thể là số đo cũ. Không coi thời gian nhận là thời gian đo.
- So sánh nội dung chuẩn hóa và timestamp với bản ghi cuối của thiết bị để chống lưu trùng sau reconnect/restart. Không có timestamp/sampleId thì những lần đo liên tiếp có giá trị hoàn toàn giống nhau không phân biệt được và chỉ lưu một lần. Thay đổi status không tạo thêm số đo.
- Bản ghi đã lưu giữ nguyên sau restart. Không thay đổi collection `sensor_readings` cũ.
- Khi backend/Firebase mất kết nối, không lấy lại được các mẫu đã bị latest ghi đè. Khi MongoDB lỗi, chỉ giữ mẫu mới nhất cần thử lại cho mỗi thiết bị trong bộ nhớ; không có hàng đợi bền vững.

## API và giao diện

- `GET /api/readings/archive/status`: kết nối, số thiết bị chờ lưu, lần lưu cuối và lỗi.
- `GET /api/readings/{id}/history?from=ISO&to=ISO&limit=1000&before=recordId`: mới đến cũ; giới hạn tối đa 1000/trang. before là id dòng cuối trang trước; thứ tự timestamp + id để không mất mẫu cùng thời điểm.
- Web tự tải tiếp các trang để báo cáo không bị cắt ở 1000 dòng. Lọc ngày gửi lên backend trước khi phân trang.
- Tổng quan/Phân tích tải lịch sử 24 giờ, Dữ liệu quan trắc tải 7 ngày và cập nhật mỗi 30 giây. Báo cáo theo khoảng người dùng chọn; CSV dựa trên dữ liệu đã lưu.

## Kiểm tra

`npm run lint`, `npm -w @climasense/backend test -- --runInBand`, build frontend/backend.
Unit test kiểm tra null/phạm vi, chống trùng sau restart, giá trị quay lại, thời điểm đo/nhận và lỗi MongoDB.

Tên nguồn backend là `DATA_SOURCE=module`; giá trị cũ `firebase` vẫn được hỗ trợ. Transport và các biến `FIREBASE_*` giữ nguyên. Bản ghi mới có `source: "module"`; lịch sử cũ không bị sửa. Cấu hình nguồn của frontend độc lập, không đổi `VITE_DATA_SOURCE`.
