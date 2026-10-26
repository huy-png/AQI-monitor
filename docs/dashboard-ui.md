# Dashboard quan trắc

## Sử dụng

- Chọn thiết bị bằng mã node ở đầu trang.
- Mở **Thông số hiển thị** để chọn từng chỉ số hoặc bộ **Bụi & khí tượng**. Lựa chọn được lưu trên trình duyệt và áp dụng cho thẻ số đo, biểu đồ, bảng trạm.
- Bấm thẻ số đo để đổi biểu đồ. Bộ lọc 1 giờ / 24 giờ / tất cả chỉ lọc các bản ghi đã tải; không truy vấn kho lịch sử mới.
- Thống kê trung bình là trung bình các mẫu hiện có, không phải phép đánh giá QCVN. Một bản ghi chỉ hiển thị một điểm.
- Độ đầy đủ dữ liệu tính từ các trường có số đo, không phải trạng thái giao tiếp phần cứng.
- Trên điện thoại, nút menu mở danh sách trang. Escape đóng bảng tùy chọn thông số.

## Mã nguồn

- `frontend/src/pages/DashboardPage.tsx`: bố cục, lựa chọn thiết bị và thông số.
- `frontend/src/config/metrics.ts`: danh mục và đơn vị thông số.
- `frontend/src/components/charts/AirQualityChart.tsx`: lọc thời gian, biểu đồ và thống kê.
- `frontend/src/styles/monitor-dashboard.css`: giao diện dashboard, responsive và khung điều hướng.

## Tham khảo thiết kế dữ liệu

- https://docs.openaq.org/resources/measurements
- https://docs.openaq.org/resources/latest
- https://open-meteo.com/en/docs/air-quality-api

Chỉ tham khảo cách tổ chức trạm, số đo và chuỗi thời gian; không tích hợp thêm nguồn API bên ngoài vào dữ liệu Firebase.

## Các trang còn lại

- Thiết bị & trạm: bảng tìm kiếm và lọc trạng thái; liên kết Phân tích mở đúng thiết bị.
- Phân tích: chọn trạm và thông số ngay trong biểu đồ; không hiển thị phần Số đo mới nhất.
- Dữ liệu quan trắc: tìm theo mã thiết bị, hiển thị các chỉ số không khí và khí tượng kèm đơn vị.
- Cảnh báo: lọc tất cả, chưa đọc hoặc nghiêm trọng. Chưa đọc không đồng nghĩa chưa xử lý.
- Báo cáo: chọn trạm/thời gian, xem trước tối đa 10 dòng; CSV gồm cả nhiệt độ, độ ẩm và áp suất. Có thể bỏ chọn toàn bộ thiết bị.
- Bản đồ: đồng bộ panel, bố cục responsive và nhãn tiếng Việt; giữ cơ chế bản đồ hiện có.
- Cài đặt: đồng bộ giao diện sáng/tối, chọn nguồn và quét thiết bị. Nhãn nguồn “Firebase” đổi thành “Thiết bị”; định danh kết nối trong mã nguồn không đổi.

Khung ứng dụng không còn container có viền bao ngoài. Sidebar cố định bên trái trên desktop, cuộn riêng khi cần; trên mobile dùng thanh menu sticky. Bộ chọn thiết bị báo cáo dạng dropdown có tìm kiếm, chọn nhiều, chọn các kết quả lọc, bỏ chọn tất cả và xóa từng lựa chọn. Escape hoặc bấm ngoài đóng danh sách. Tham khảo: https://grafana.com/docs/grafana/latest/visualizations/dashboards/variables/add-template-variables/

Đã kiểm tra điều hướng 7 trang trên desktop/mobile, không tràn ngang toàn trang, không có nhãn Firebase trong nội dung giao diện; tìm thiết bị, mở phân tích, quét thiết bị, bỏ chọn toàn bộ trạm trong báo cáo và khôi phục lựa chọn.

## Kiểm tra

Build và ESLint frontend; kiểm tra trình duyệt desktop 1440 px, mobile 390 px; menu mở/đóng, chọn trạm, chọn thông số qua thẻ, ẩn tất cả, khôi phục bộ mặc định, Escape và không tràn ngang toàn trang. Ảnh giao diện: `screenshots/dashboard-desktop.jpg`.
