# Cảnh báo môi trường

Backend kiểm tra số đo mới trong MongoDB `firebase_readings` mỗi 2 giây. Cấu hình chung cho tất cả thiết bị được lưu trong `alert_settings`, cảnh báo lưu trong `environment_alerts`. Hoạt động ngay cả khi đóng web, miễn backend và MongoDB chạy. Web tải cảnh báo mỗi 5 giây và hiện thanh thông báo có liên kết khi có cảnh báo chưa đọc.

## Cài đặt

Vào Cài đặt → Cảnh báo môi trường. Với từng thông số có thể bật/tắt, đặt ngưỡng thấp/cao, mức tăng/giảm tuyệt đối, cửa sổ so sánh (10–3.600 giây), thời gian chờ lặp (10–86.400 giây). Để trống một ngưỡng để tắt riêng điều kiện đó. Nhấn Lưu cấu hình cảnh báo để áp dụng cho các bản ghi mới; không tạo lại cảnh báo cho lịch sử trước thời điểm lưu.

Các mức ban đầu là cấu hình vận hành tham khảo, không phải chuẩn môi trường: nhiệt độ ±5 °C, độ ẩm ±20 điểm phần trăm, áp suất ±10 hPa, bụi/khí ±25 theo đơn vị hiện hiển thị; cửa sổ 300 giây, chờ lặp 600 giây. Chưa đặt ngưỡng tuyệt đối thấp/cao. Cần điều chỉnh theo cảm biến và mục tiêu giám sát.

## Cách phát hiện

- Chỉ so sánh cùng thiết bị và thông số, bỏ qua null/NaN. Không biến giá trị thiếu thành 0.
- Lấy số đo hợp lệ cũ nhất trong cửa sổ trước mẫu hiện tại. Nếu chênh lệch tăng >= mức tăng, hoặc chênh lệch giảm >= mức giảm, tạo cảnh báo mức warning. Ví dụ PM2.5 từ 20 lên 50 trong 120 giây, cấu hình tăng 25 trong 300 giây → cảnh báo.
- Thấp hơn ngưỡng thấp hoặc cao hơn ngưỡng cao tạo cảnh báo mức critical. Bằng đúng ngưỡng tuyệt đối chưa cảnh báo. Quy tắc tuyệt đối không cần mẫu so sánh.
- Thời gian dựa trên `receivedAt` (backend nhận/lưu), vì firmware hiện chưa có thời điểm đo trong latest. Đây không phải tính trung bình theo QCVN và không khẳng định vi phạm quy chuẩn.
- Lưu bằng chứng: thiết bị, thông số, loại cảnh báo, số đo mới, số đo so sánh, chênh thời gian, ngưỡng, id mẫu và thời điểm.
- Chờ lặp tính riêng cho thiết bị + thông số + loại (tăng/giảm/cao/thấp); hết thời gian chờ, nếu điều kiện vẫn xuất hiện trên mẫu mới sẽ cảnh báo tiếp. Không có thông báo tự phục hồi trong phiên bản này.
- ID theo mẫu/thông số/loại và dấu đã đánh giá trên mẫu giúp chống trùng khi retry/restart. Nếu DB lỗi, backend thử lại các mẫu chưa xử lý. Không thêm hàng đợi Firebase.
- Khi khởi tạo lần đầu không quét lại toàn bộ lịch sử. Cấu hình, cảnh báo và trạng thái đã đọc vẫn còn sau khi khởi động lại.

## API

- `GET /api/alerts`: 200 cảnh báo gần nhất, mới trước. Các bộ đếm/lọc trên web áp dụng cho danh sách này.
- `GET /api/alerts/settings`: cấu hình hiện tại.
- `PUT /api/alerts/settings`: lưu toàn bộ 11 quy tắc. Kiểm tra kiểu, khoảng thời gian, ngưỡng dương cho tăng/giảm, ngưỡng thấp < cao, không trùng thông số.
- `PATCH /api/alerts/{id}/read`: lưu trạng thái đã đọc.

API này hiện chạy local. Chưa triển khai email/SMS, phân quyền nhiều người dùng hoặc cấu hình riêng từng thiết bị.

## Kiểm thử

12 unit tests toàn dự án đạt. Kiểm thử MongoDB ở database tạm riêng xác nhận tăng/giảm, cách ly thiết bị, chờ lặp, tắt quy tắc, lưu cấu hình và đã đọc qua restart. Không chèn cảnh báo giả vào database thực.
