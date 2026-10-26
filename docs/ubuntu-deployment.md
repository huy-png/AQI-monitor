# Backend Ubuntu — PostgreSQL

Đã triển khai ngày 13/10/2026 tại `huy1111@100.114.150.77`, thư mục `/home/huy1111/apps/datn-monitor`.

Luồng hoạt động: ESP32 → Firebase Realtime Database → backend Ubuntu → PostgreSQL. Backend và database tự khởi động lại theo chính sách Docker `unless-stopped`; Docker đã được bật khởi động cùng hệ điều hành. Laptop không cần chạy để thu thập dữ liệu. Firmware không cần nạp lại.

## Dữ liệu và kiểm tra

Đã nhập 1.086 số đo, 23 cảnh báo và 1 bộ cấu hình gồm 11 quy tắc từ MongoDB laptop bằng giao dịch PostgreSQL. Dữ liệu gốc vẫn giữ trên laptop; bản xuất nằm trong `.local/deployment` và thư mục `migration` trên server. Đã xác nhận server tiếp tục lưu số đo mới, API lịch sử/cảnh báo hoạt động, và hai container đều healthy.

17 kiểm thử backend đạt; build và lint đạt. Kiểm tra tích hợp PostgreSQL trong schema tạm đã xác minh null, lưu trùng sau khởi động lại, lọc ngày, phân trang, tách thiết bị, lưu cấu hình, cảnh báo, cooldown và trạng thái đã đọc. Script kiểm tra: `scripts/verify-postgres.cjs`.

PostgreSQL lưu các bản ghi trong JSONB với khóa chính và chỉ mục phục vụ lịch sử/cảnh báo, giữ nguyên cấu trúc API. Tên bảng `firebase_readings` được giữ để tương thích dữ liệu cũ. Driver PostgreSQL hiện phục vụ `DATA_SOURCE=module` (hoặc alias `firebase`); chế độ MQTT/Mongoose cũ vẫn dùng MongoDB.

## Mở web từ laptop

Frontend `.env` hiện dùng `VITE_API_URL=http://localhost:3001/api` và `VITE_SOCKET_URL=http://localhost:3001`.

Chạy `scripts/connect-server.ps1` trong PowerShell rồi giữ cửa sổ đó mở khi xem lịch sử/cảnh báo. Lệnh tương đương:

```powershell
ssh -N -L 127.0.0.1:3001:127.0.0.1:3000 -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 huy1111@100.114.150.77
```

Cần kết nối mạng riêng tới địa chỉ server. Nếu cổng 3001 đang được sử dụng bởi tunnel đã mở, không mở tunnel thứ hai. Khởi động frontend như trước (`npm run dev:frontend`). Đóng tunnel hoặc tắt laptop chỉ ngắt việc xem API từ laptop; backend server vẫn thu thập. Website chưa được đưa lên tên miền công khai.

## Quản lý trên server

```bash
cd ~/apps/datn-monitor
sudo docker compose -f docker-compose.server.yml ps
sudo docker compose -f docker-compose.server.yml logs --tail 50 backend
curl http://127.0.0.1:3000/api/health
curl http://127.0.0.1:3000/api/readings/archive/status
```

`health` kiểm tra PostgreSQL; `archive/status` kiểm tra kết nối thu thập, dữ liệu chờ và lỗi lưu. Nếu chủ động stop container, cần chạy lại `sudo docker compose -f docker-compose.server.yml up -d`.

`.env.server` chứa thông tin Firebase và POSTGRES_URL; `.env.postgres` chứa mật khẩu database. Cả hai có quyền 600, không đưa vào Git hoặc Docker image. Database không mở cổng ra host; API chỉ mở trên localhost server. Dịch vụ có sẵn trên cổng 80 không bị thay đổi.

## Sao lưu

Đã tạo bản sao PostgreSQL đầu tiên trong `backups/climasense-20261013T083001Z.dump`. Tạo bản sao mới:

```bash
cd ~/apps/datn-monitor
sudo bash scripts/backup-server.sh
```

Script dùng `pg_dump -Fc`; chỉ đổi tên file sau khi dump thành công. Bản sao đang cùng server, chưa có lịch tự động hoặc bản sao ngoài máy. Không chạy `docker compose down -v` vì sẽ xóa volume database.

MongoDB 8 trước đó không chạy được trên CPU Pentium G4400 thiếu AVX. Container cũ đã dừng, không dùng cho hệ thống mới. PostgreSQL có volume riêng `datn-monitor_server-postgres`.

Chưa có hàng đợi: mẫu bị ghi đè trong Firebase `latest` khi backend hoặc mạng mất kết nối không thể phục hồi. Nếu thiết bị không gửi timestamp, lịch sử dùng thời điểm backend nhận; số đo hoàn toàn giống lần trước được bỏ trùng như trước đây.

## Nguồn dữ liệu trên web

Trong Cài đặt → Nguồn dữ liệu:

- **Thiết bị**: số đo trực tiếp từ Firebase.
- **Máy chủ**: số đo gần nhất của từng thiết bị đã lưu trong database, lấy qua `/api/readings/archive/dashboard` và cập nhật mỗi 5 giây. Chế độ này thay WebSocket cũ và không tự chuyển sang Firebase khi API lỗi. Thiết bị có dữ liệu lịch sử vẫn xuất hiện khi ngừng gửi số đo. Trạng thái hoạt động được ước tính theo lần lưu gần nhất, không phải xác nhận kết nối phần cứng.

Lịch sử, phân tích, báo cáo và cảnh báo tiếp tục sử dụng API server. Cần giữ kết nối SSH khi truy cập từ laptop như hướng dẫn phía trên.
