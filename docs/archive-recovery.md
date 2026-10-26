# Bộ thu thập Firebase ngừng lưu — 15/10/2026

## Bằng chứng

- Khoảng 13:27 UTC+7, API health và PostgreSQL vẫn kết nối.
- Archive báo connected=true, pendingDevices=0, error=null nhưng lastSavedAt dừng ở 13:11:56.
- Firebase có trạng thái 13:27:25 và PM2.5=62, database vẫn PM2.5=48.
- Sau khi người vận hành restart backend, API history đã có bản ghi 13:32:36.
- Lỗi FirebaseRealtimeService 401 lúc 13:27:03 đến từ API latest được gọi để chẩn đoán. API đó dùng REST auth cấu hình riêng; chưa có bằng chứng lỗi này làm dừng ArchiveService dùng Firebase Auth SDK.

Chưa xác định được nguyên nhân transport bị đứng từ log hiện có. Không coi connected=true là bằng chứng đang nhận đủ số đo.

## Bản tăng khả năng phục hồi

ArchiveService đối chiếu `/devices` qua REST mỗi 30 giây, dùng ID token tự làm mới của phiên Firebase Auth hiện có. REST bỏ qua cache realtime; request và bước lấy token có giới hạn thời gian. Nếu REST thấy giá trị chưa nhận qua luồng realtime, collector đưa vào hàng ghi và kết nối lại transport. Không ghi token vào log.

Nếu realtime nhận sự kiện mới trong lúc REST đang đọc, không áp dụng snapshot REST có thể cũ hơn. Giá trị không đổi vẫn bỏ trùng; không tự tạo bản ghi chỉ vì đã đến chu kỳ kiểm tra. Lỗi đối chiếu không bị xóa bởi một lần ghi database thành công.

API archive/status bổ sung lastSnapshotAt, lastVerifiedAt và recoveryCount. lastVerifiedAt xác nhận REST đọc thành công, lastSavedAt xác nhận đã lưu, không đồng nghĩa thiết bị gửi mẫu mới. Các mẫu đã bị ghi đè trên Firebase latest không được khôi phục.

## Triển khai

Trong PowerShell trên laptop, tại thư mục dự án:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy-archive-recovery.ps1
```

Nhập mật khẩu SSH/sudo trực tiếp khi được hỏi. Script chỉ cập nhật archive.service.ts, sao lưu bản gốc trên server, build image rồi tạo lại riêng container backend. Không thay đổi database, volume hoặc env. Nếu build thất bại, container đang chạy vẫn được giữ. Script xác nhận collector đã đọc Firebase và ghi database sau triển khai; nếu chưa xác nhận được thì in log và trả lỗi.

Kiểm thử local: backend build/lint và 22 tests đạt, gồm phục hồi sự kiện bị bỏ lỡ, không ghi đè dữ liệu realtime mới hơn, giới hạn nhịp đối chiếu và giữ lỗi kiểm tra quyền đọc.
