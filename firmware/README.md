# ESP32-S3: test cảm biến bằng PlatformIO

Mở thư mục `firmware` bằng VS Code + PlatformIO. Điểm vào chương trình ở `src/main.cpp`; cấu hình và từng cảm biến đã tách riêng.
PlatformIO tự cài thư viện theo `platformio.ini` khi build lần đầu.

Board mặc định: ESP32-S3-DevKitC-1 N8 (8 MB flash, không bật PSRAM).
Đây là cấu hình giả định vì chưa có mã board cụ thể; nếu board khác, cần
chỉnh `board`/cấu hình bộ nhớ theo phần cứng thực tế.

| Module | Nguồn | Kết nối tới ESP32-S3 |
| --- | --- | --- |
| BME280 | 3.3V | SDA → GPIO9, SCL → GPIO8 |
| PMS7003 | 5V | TX → GPIO17, RX → GPIO18 |
| GPS NEO-6M | Theo board module đang dùng | TX → GPIO15, RX → GPIO16 |

Tất cả chung GND. Số chân là số GPIO, không phải vị trí chân trên header.

## Chạy

Trong PlatformIO chọn môi trường phù hợp với cổng USB đang cắm:

- `esp32-s3-usb`: cổng USB native của ESP32-S3.
- `esp32-s3-uart`: cổng USB qua chip CP210x/CH340/CH343 hoặc USB–UART tương đương (mặc định).

Chọn Build, Upload, rồi Monitor (115200 baud). Nếu dùng terminal PlatformIO,
chạy các lệnh sau từ thư mục `firmware`:

```sh
pio run -e esp32-s3-uart
pio run -e esp32-s3-uart -t upload
pio device monitor -e esp32-s3-uart
```

Thay tên môi trường bằng `esp32-s3-usb` nếu dùng cổng USB native.
Môi trường khi nạp phải khớp với cổng dùng xem Serial. Chỉ đổi môi trường
Monitor mà không nạp lại firmware sẽ không đổi nơi chương trình xuất log.
Nếu tự nhận sai cổng, thêm `upload_port = COMx` và `monitor_port = COMx`
trong môi trường tương ứng, với COMx là cổng thực tế. Cổng native USB có thể
đổi COM sau khi nạp. Bấm RESET sau khi mở Monitor để xem lại log quét I2C.

## Cấu trúc để chỉnh sửa

```text
firmware/
  include/
    config.h           Chân GPIO, baud rate, chu kỳ báo cáo và timeout
    module_status.h    Trạng thái và quy tắc phát hiện mất dữ liệu
    sensors.h          Giao diện begin/update/report/status của các module
    diagnostics.h      Giao diện báo cáo Serial
  src/
    main.cpp           Chỉ khởi tạo và điều phối vòng lặp
    diagnostics.cpp    Bảng tổng hợp, log thay đổi trạng thái
    sensors/
      bme280.cpp       I2C, đo môi trường, tự thử kết nối lại
      pms7003.cpp      UART, giải mã frame và checksum bụi
      gps.cpp          UART, NMEA và tọa độ
  tests/status_test.cpp Kiểm tra quy tắc trạng thái tại thời điểm biên dịch
  platformio.ini       Board, thư viện, môi trường USB
```

Đổi dây hoặc thời gian chờ trong `include/config.h`. Sửa cách đọc cảm biến
trong file tương ứng ở `src/sensors/`. Sửa nội dung bảng tổng hợp trong
`src/diagnostics.cpp`; nội dung số đo riêng ở hàm `report()` của mỗi cảm biến.
Thêm cảm biến bằng cách khai báo giao diện trong `sensors.h`, tạo file xử lý,
gọi `begin/update` từ `main.cpp` và thêm vào bảng diagnostics.

## Đọc kết quả

Serial chạy 115200 baud, báo cáo mỗi 3 giây; khi trạng thái đổi sẽ có dòng
`[THAY DOI]`. Bảng tổng hợp cho biết số module đang phản hồi hợp lệ trên tổng 3.

| Trạng thái | Ý nghĩa |
| --- | --- |
| CHUA NHAN MODULE | Chưa có byte UART hoặc chưa khởi tạo được BME280 |
| CO BYTE / CHUA CO DU LIEU HOP LE | Có tín hiệu UART nhưng chưa có frame/câu NMEA hợp lệ |
| DA NHAN MODULE | BME280 đọc thành công; UART có dữ liệu hợp lệ trong 10 giây gần nhất |
| MAT PHAN HOI / HET DU LIEU MOI | BME280 mất phản hồi hoặc UART không có dữ liệu hợp lệ mới trong ít nhất 10 giây |
| DA NHAN CHIP / LOI DOC | BME280 đã khởi tạo nhưng lần đọc gặp lỗi |

- BME280: quét I2C lúc khởi động, kiểm tra chip ID 0x60 tại 0x76/0x77.
  Một địa chỉ ACK chưa đủ để xác nhận BME280. Khi lỗi, tự thử khởi tạo lại
  mỗi 5 giây, không cần reset sau khi sửa dây. In nhiệt độ, độ ẩm, áp suất.
- PMS7003: chỉ xác nhận sau khi nhận frame đúng độ dài và checksum;
  in PM1/PM2.5/PM10 (µg/m³), số byte, frame hợp lệ và lỗi checksum.
- GPS: xác nhận UART qua NMEA hợp lệ, độc lập với việc có tọa độ.
  Chỉ in tọa độ/số vệ tinh còn mới; chưa có tọa độ thì đưa anten ra nơi thoáng trời.
- UART tự chuyển về đã nhận khi dữ liệu hợp lệ xuất hiện trở lại.

Chỉ kiểm tra các GPIO đã cấu hình; không đo VCC/GND và không tự dò dây.
GPIO18/GPIO16 (ESP TX → module RX) chưa được kiểm chứng vì chương trình
chỉ nhận dữ liệu, không gửi lệnh. Hai UART dùng 9600 baud. PMS cần chế độ
gửi chủ động mặc định; SET/RESET không được bị kéo thấp.
Đây là kiểm tra giao tiếp, không xác thực chính xác model của thiết bị UART.
Firmware xuất Serial và có thể gửi Firebase sau khi điền cấu hình bên dưới.

## Kiểm tra sau khi nạp

1. Chạy đủ module: bảng đạt 3/3 khi nhận dữ liệu hợp lệ; GPS có thể chưa có tọa độ.
2. Ngắt dây TX PMS/GPS: sau 10 giây trạng thái chuyển sang hết dữ liệu mới,
   không in lại số đo cũ như dữ liệu hiện tại. Nối lại để kiểm tra phục hồi.
3. Khởi động thiếu BME280 rồi nối đúng: chương trình tự nhận ở lần thử tiếp theo.
4. Ngắt/nối lại BME280: kiểm tra log mất phản hồi và tự khởi tạo lại.

Ngắt nguồn trước khi thay đổi dây nguồn; các bước phần cứng phải kiểm tra trên board thực tế.

## Gửi Firebase Realtime Database

Các file mới:
- `include/secrets.h`: Wi-Fi và Firebase Authentication; được Git bỏ qua.
- `include/secrets.example.h`: mẫu trống, có thể commit. Khi thiếu secrets.h,
  firmware vẫn build và đọc cảm biến nhưng không bật upload.
- `include/firebase_config.h`: API key, Database URL, chu kỳ gửi 15 giây,
  khoảng thử lại 30 giây, giới hạn tuổi mẫu chờ gửi 10 giây.
- `include/reading.h`: mẫu số đo và kiểm tra giá trị trước khi gửi.
- `src/firebase_uploader.cpp`: Wi-Fi, NTP, xác thực, làm mới token, HTTPS PUT.
- `certs/google-roots.pem`: chứng chỉ gốc tải từ https://pki.goog/roots.pem;
  được nhúng vào firmware để xác minh máy chủ TLS. Cần cập nhật khi Google
  thay đổi trust roots; không sử dụng kết nối bỏ kiểm tra chứng chỉ.
- `firebase/database.rules.json`: rules đề xuất dựa trên bản người dùng cung cấp.

### Cấu hình một lần

1. Điền `WIFI_SSID`, `WIFI_PASSWORD`, `FIREBASE_EMAIL`, `FIREBASE_PASSWORD`
   trong `include/secrets.h`. Nếu chưa có file, copy từ `secrets.example.h`.
   Tài khoản phải tồn tại trong Firebase Authentication của project test1-7399f,
   bật Email/Password; email phải khớp `esp…@gmail.com` theo rules.
2. Trong Firebase Console → Realtime Database → Rules, cập nhật điều kiện cuối:
   giữ `newData.child('simulated').isBoolean()` và bỏ
   `&& newData.child('simulated').val() === true`.
   File rules đề xuất giữ nguyên các quyền và ràng buộc khác, cho phép cả
   mô phỏng (true) lẫn dữ liệu thật (false). Rules chưa được tự động publish.
   Không thay cả rules nếu Console đã có thay đổi khác sau bản được cung cấp.
3. Build và nạp qua CH343/COM4 (đóng Serial Monitor trước khi Upload):

```powershell
pio run -e esp32-s3-uart -t upload --upload-port COM4
pio device monitor -e esp32-s3-uart -p COM4 -b 115200
```

### Dữ liệu và trạng thái

ID lấy từ MAC Wi-Fi STA, viết hoa và bỏ dấu hai chấm: `esp32-587B04D9B4DC`.
Firmware PUT mẫu vào `devices/<nodeId>/latest`. Mỗi lần ghi thay toàn bộ latest,
không ghi lịch sử. Metadata chuyển vào status: `timestamp` là Unix giây tại lúc chụp mẫu; `timestampIso`
là UTC (`Z`), cùng thời điểm với timestamp. `sampleNumber` tăng sau mỗi lần
server xác nhận thành công và bắt đầu lại khi reset. `simulated` luôn false.
Đơn vị: °C, %, hPa và µg/m³; không tự chuyển bụi sang µg/Nm³.

Gửi sau khi NTP và Firebase đã được xác nhận. Module có số đo mới hợp lệ
sẽ gửi số; module thiếu/lỗi/hết dữ liệu gửi null cho cả nhóm trường, không dùng số 0 giả.
Nếu GPS chưa fix, latest vẫn cập nhật số đo BME/PMS; latitude/longitude gửi null và status báo no_fix.
Khi mất mạng không lưu hàng đợi lịch sử; giữ mẫu mới nhất và bỏ mẫu quá hạn.
Tác vụ mạng chạy riêng, cảm biến chỉ được đọc ở loop chính và chuyển bản sao
qua hàng đợi để không bị chặn khi HTTPS đang chờ phản hồi.

Log cần thấy:

```text
[WiFi] Da ket noi, IP=...
[Firebase] Dang nhap thanh cong.
[Firebase] GUI OK #1 -> devices/esp32-.../latest
```

- `Chua cau hinh`: chưa điền secrets.h; cần điền rồi nạp lại.
- `CHUA GUI`: xem BME/PMS/GPS-fix/NTP đang chờ gì.
- `Auth HTTP 400`: kiểm tra tài khoản, mật khẩu, bật Email/Password và API key.
- `GUI LOI HTTP 401/403`: kiểm tra email, rules và simulated=false.
- Mã HTTP âm: lỗi kết nối/TLS; kiểm tra Wi-Fi, NTP và chứng chỉ.
- Mất Wi-Fi: thử lại; token được làm mới trước khi hết hạn.

### Kiểm tra với thiết bị thật

1. Nạp với cấu hình đúng, chờ GPS fix, kiểm tra log GUI OK và latest trên Console.
2. Xác nhận nodeId trùng MAC STA, simulated=false, timestamp tăng và số đo khớp Serial.
3. Tắt Wi-Fi: Serial vẫn đọc cảm biến; bật lại và kiểm tra tự gửi mẫu mới.
4. Ngắt dữ liệu cảm biến: kiểm tra không gửi mẫu thiếu/giả; nối lại để tiếp tục.
5. Chạy hơn một giờ để kiểm tra log gia hạn token và upload tiếp tục.

Tham chiếu: https://firebase.google.com/docs/reference/rest/auth
và https://firebase.google.com/docs/database/rest/save-data.

## Báo lỗi module trên Firebase

Firmware gửi `devices/<nodeId>/status` mỗi chu kỳ khoảng 15 giây khi Wi-Fi,
NTP và đăng nhập đã sẵn sàng, kể cả khi chưa nhận bất kỳ module nào.
Cập nhật thêm nhánh `status` từ `firebase/database.rules.json` vào Rules rồi Publish;
rules cũ chỉ cho ghi latest sẽ từ chối status. Giữ các nhánh khác nếu Console
đã có thay đổi mới. Chưa có thao tác publish rules tự động.

Ví dụ BME/PMS hoạt động nhưng GPS chưa có tọa độ:

```json
{
  "nodeId": "esp32-587B04D9B4DC",
  "timestamp": 1785818743,
  "receivedAt": 1785818743000,
  "ready": false,
  "message": "Kiem tra cac module chua san sang",
  "modules": {
    "bme280": {"state": "ok", "ready": true, "message": "Du lieu hop le"},
    "pms7003": {"state": "ok", "ready": true, "message": "Du lieu hop le"},
    "gps": {"state": "no_fix", "ready": false, "message": "Chua co toa do moi; dua anten ra noi thoang troi"}
  }
}
```

- `no_data`: chưa nhận module/dữ liệu.
- `invalid_data`: có byte nhưng dữ liệu không hợp lệ.
- `stale`: từng nhận, hiện hết dữ liệu mới/mất phản hồi.
- `read_error`: lỗi đọc BME280.
- `no_fix`: GPS có NMEA hợp lệ nhưng chưa có tọa độ mới.
- `ok`: dữ liệu đã sẵn sàng. Khi phục hồi, status tự ghi đè trạng thái lỗi cũ.

`timestamp` tính bằng giây tại lúc kiểm tra. `receivedAt` do Firebase gán bằng
thời gian máy chủ (mili giây). Kiểm tra độ mới của trường này để tránh coi status
cũ là trạng thái hiện tại: khi thiết bị mất mạng/tắt nguồn, thiết bị không thể
đẩy lỗi lên Firebase. `ready` mô tả số đo, không đảm bảo lần ghi latest đã thành công.
`latest` vẫn cập nhật khi thiếu module; nhóm trường tương ứng gửi null và status báo dataMissing=true.
Status chỉ được lưu trong Firebase; thay đổi này chưa thêm giao diện cảnh báo trên web.

Kiểm tra sau khi nạp: khởi động thiếu module, chờ status báo no_data; nối lại
để kiểm tra ok; ngắt TX UART hơn 10 giây để kiểm tra stale; GPS chưa fix phải
báo no_fix. Mỗi lần gửi status thành công Serial có `[Firebase] STATUS OK`.

## Tiến trình khởi động và phục hồi

1. **Xác nhận module**: đọc thử giao tiếp tối đa 10 giây (hoặc kết thúc sớm
   khi cả ba module phản hồi). Serial in kết quả từng module. GPS UART được
   xác nhận bằng NMEA, chưa bắt buộc có tọa độ ở bước này. Dữ liệu đọc thử
   chưa được gửi vào latest.
2. **Xác nhận Firebase**: kết nối Wi-Fi, đồng bộ NTP, đăng nhập, rồi ghi status.
   Chỉ HTTP 200/204 từ thao tác ghi status mới mở bước thu thập số đo.
   Đăng nhập thành công đơn thuần chưa đủ. Việc này xác nhận quyền ghi status;
   quyền ghi latest được xác nhận riêng khi mẫu thật đầu tiên gửi thành công.
3. **Thu thập và gửi**: tạo snapshot mới sau mốc xác nhận Firebase. Mỗi module
   độc lập: có mẫu mới hợp lệ thì gửi số, còn lại gửi null. Không dùng lại số đo cũ.

Nếu hết bước 1 mà thiếu module, vẫn sang bước 2 để báo lỗi module trên Firebase;
latest vẫn gửi với các nhóm số đo còn thiếu là null. Đây là cách giữ chức năng báo lỗi
module từ xa. Các hàm đọc ở loop vẫn chạy để kiểm tra giao tiếp và phục hồi.

Status có trường phase: verifying_firebase, waiting_for_data hoặc collecting.
Phase là trạng thái tại lúc gửi bản báo cáo (không phải xác nhận lần ghi latest).
Khi mất Wi-Fi, cần gia hạn token hoặc ghi Firebase thất bại, tạm dừng gửi số đo,
xác nhận lại Firebase, rồi chỉ nhận các mẫu thuộc phiên xác nhận mới.
Rules status đã cung cấp cho phép thêm phase nên không cần mở rộng quyền.

Kiểm tra: khởi động phải thấy BUOC 1/3, BUOC 2/3, BUOC 3/3 theo thứ tự;
không có GUI OK latest trước xác nhận status. Sai mật khẩu/rules phải dừng ở
bước 2. GPS chưa fix phải có status lỗi và latest có tọa độ null. Khi mạng phục hồi,
phải xác nhận lại status rồi mới gửi mẫu mới.

## Số đo thiếu: gửi null (hành vi hiện tại)

Sau bước xác nhận Firebase, vẫn gửi latest khoảng 15 giây/lần dù thiếu một hoặc
cả ba module. BME280 thiếu/lỗi: temperature, humidity, pressure đều null.
PMS7003 thiếu/lỗi: pm1, pm25, pm10 đều null. GPS thiếu hoặc chưa fix:
latitude, longitude đều null. Khi có dữ liệu mới hợp lệ, các trường tự trở lại số.
Module có dữ liệu số 0 hợp lệ vẫn được gửi số 0; không coi 0 là thiếu dữ liệu.

Status dùng snapshot tại lúc báo trạng thái; latest lấy snapshot mới sau khi gửi status. Mỗi module có ready, state,
`dataMissing: true/false`, message nêu dữ liệu null và hướng kiểm tra.
`status.ready=false` nghĩa là chưa đủ tất cả module, không còn là điều kiện chặn gửi.
Hai lần ghi status và latest là riêng biệt; latest không chứa metadata thời gian.
Nếu latest lỗi trong khi status thành công, latest có thể còn bản cũ.

**Bắt buộc Publish rules mới** trong firebase/database.rules.json:
latest chỉ cho phép 8 trường số đo; các trường có thể vắng mặt, nhưng nếu có
vẫn kiểm tra kiểu số và giới hạn như cũ. Metadata nằm trong status. Quyền đăng nhập không đổi.

Realtime Database coi null là xóa trường, nên Console có thể không hiện các trường
này. Payload HTTP vẫn có null; dùng status.modules.<module>.dataMissing để hiển thị
lỗi. PUT thay latest giúp số đo cũ không tồn tại khi module mất dữ liệu.
Tham khảo: https://firebase.google.com/docs/database/web/read-and-write#delete_data

Kiểm tra: tháo GPS hoặc chờ chưa fix vẫn phải GUI OK latest với số đo BME/PMS;
ngắt PMS >10 giây phải xóa các trường bụi cũ và status báo thiếu PMS; nối lại phải
khôi phục số; thiếu cả 3 module vẫn cập nhật timestamp và status, không gửi số giả.

## Cấu trúc latest chỉ gồm số đo

```
devices/<MAC>/
  latest/
    temperature
    humidity
    pressure
    pm1
    pm25
    pm10
    latitude
    longitude
  status/
    nodeId
    timestamp
    timestampIso
    receivedAt
    simulated
    sampleNumber
    lastLatestTimestamp
    ready
    phase
    message
    modules/...
```

Firmware thay toàn bộ latest bằng PUT, nên các metadata cũ trong latest sẽ được
loại bỏ ở lần gửi thành công tiếp theo. Publish rules mới trước khi nạp firmware:
latest không yêu cầu nodeId/timestamp/simulated, chỉ chấp nhận 8 trường số đo.
Cho phép xóa riêng latest bằng tài khoản được cấp quyền, để bản ghi toàn null
xóa số đo cũ. Các quyền status và nhánh khác không đổi.

Khi tất cả module đều thiếu dữ liệu, payload chỉ có các số đo null nên Firebase
xóa toàn bộ latest; status vẫn tồn tại và nêu lỗi. Khi có số đo, latest tự xuất
hiện lại. Không dùng chuỗi "null" hay dữ liệu giả để giữ nhánh rỗng.

sampleNumber trong status là số lần ghi latest được xác nhận thành công trước
bản báo cáo status này (bắt đầu lại từ 0 khi reset). lastLatestTimestamp là thời
gian mẫu latest được xác nhận gần nhất trong phiên chạy, 0 nếu chưa có. Vì ghi
status trước latest, hai giá trị này phản ánh lần gửi trước và cập nhật ở chu kỳ
status tiếp theo. timestamp/receivedAt trong status là thời điểm báo trạng thái,
không được dùng để khẳng định lần ghi latest tiếp theo đã thành công.
Ứng dụng đọc thời gian/định danh từ latest cần chuyển sang nhánh status/ID nhánh cha;
thay đổi này chỉ sửa firmware và rules, chưa sửa frontend/backend.

## Chẩn đoán status có nhưng latest chưa xuất hiện

Firmware lấy lại snapshot mới sau khi HTTPS status hoàn tất để thời gian chờ
mạng không làm mẫu latest hết hạn liên tục. Status và latest có thể phản ánh
hai thời điểm gần nhau; thông tin module thay đổi giữa hai lần ghi sẽ được cập
nhật trên status ở chu kỳ tiếp theo.

Serial có DANG GUI STATUS, STATUS OK/LOI, DANG GUI LATEST, GUI OK/LOI.
Nếu bỏ qua một mẫu, có log CHUA GUI LATEST kèm lý do/tuổi mẫu/phiên xác nhận.
Log cảm biến hoạt động không tự chứng minh thao tác ghi Firebase đã thành công.

## Bản kiểm tra firebase-latest-review-20261012

Serial in `[FIRMWARE] firebase-latest-review-20261012` khi khởi động và status
có firmwareVersion để đối chiếu đúng firmware trên board. Mỗi 15 giây loop chính
in TIEN TRINH với bước mạng đang chạy và thời gian đã ở bước đó; log này vẫn
chạy khi tác vụ mạng đang chờ HTTP.

Sau xác nhận status lần đầu, đi thẳng tới snapshot mới và gửi latest trong
cùng chu kỳ, không cần lặp lại lần gửi status xác nhận thứ hai. Mẫu cũ/khác phiên
vẫn bị chặn. Có kiểm tra tràn bộ đệm JSON trước khi gửi.

Không đọc body cho PUT print=silent, đặc biệt HTTP 204. Auth dùng HTTP/1.0,
không tái sử dụng kết nối, body thành công giới hạn 16 KiB và 10 giây đọc.
Mã nội bộ -1001: body Auth quá lớn; -1002: body timeout/không đầy đủ;
-1003: không đủ bộ nhớ nối chuỗi phản hồi. Không in token hoặc mật khẩu.
LATEST HTTP in mã phản hồi và thời gian gửi để phân biệt lỗi rules với lỗi mạng.
