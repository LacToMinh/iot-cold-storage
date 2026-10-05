# 🎬 KỊCH BẢN DEMO KIỂM THỬ HỆ THỐNG IoT KHO LẠNH & TỦ THUỐC
> **Đề tài**: Giám sát và điều khiển làm mát kho lạnh, tủ thuốc y tế thông minh bằng ESP32-C3 Super Mini  
> **Kiến trúc 5 tầng**: Cảm biến (DHT11/Relay/LED) $\rightarrow$ Mạng (MQTT Broker local/cloud) $\rightarrow$ CSDL (PostgreSQL) $\rightarrow$ Backend (ExpressJS + Socket.IO) $\rightarrow$ Giao diện (ReactJS Dashboard)

---

## ⏱️ THỜI LƯỢNG DEMO: Chạy liên tục 30 phút (Hệ thống lưu log tự động)

---

## GIAI ĐOẠN 1: KHỞI ĐỘNG HỆ THỐNG & ĐĂNG NHẬP (MÀN HÌNH 1)
* **Mục tiêu**: Trình bày tính năng xác thực JWT, cơ chế bảo mật Protected Route của React Router và giao diện đăng nhập hiện đại.
1. Mở trình duyệt truy cập: `http://localhost:3000` (hoặc IP LAN máy tính).
2. Hệ thống tự động chuyển hướng về trang `/login` do cơ chế **React Router bảo vệ route** (người dùng chưa có JWT).
3. Nhập tài khoản quản trị:
   - **Tên đăng nhập**: `admin`
   - **Mật khẩu**: `123456` (hoặc bấm nút bấm nhanh *"admin / 123456"*).
4. Nhấn **"Đăng Nhập Hệ Thống"**:
   - Backend Express xử lý `POST /api/auth/login`, mã hóa bcrypt và sinh **JSON Web Token (JWT)** có thời hạn 7 ngày.
   - Frontend lưu JWT vào `localStorage` và tự động gắn vào Header `Authorization: Bearer <token>` qua **Axios Interceptor** cho mọi request sau đó.
   - Chuyển hướng người dùng thành công vào màn hình Danh sách thiết bị (`/devices`).

---

## GIAI ĐOẠN 2: QUẢN LÝ THỜI GIAN THỰC (MÀN HÌNH 2: DANH SÁCH THIẾT BỊ)
* **Mục tiêu**: Thể hiện khả năng giám sát nhiều kho lạnh / tủ thuốc cùng lúc, trạng thái Online/Offline và các thông số telemetry tức thời.
1. Quan sát thẻ thiết bị **"Tủ Thuốc & Vắc-xin ESP32-C3 Node"** (`esp32_c3_cold_01`):
   - Đèn hiệu **ONLINE** chớp xanh (dựa vào `last_seen` trong PostgreSQL và Socket.IO).
   - Hai loại Telemetry hiển thị rõ:
     - **Nhiệt độ**: Hiển thị số đo thời gian thực kèm đơn vị °C.
     - **Độ ẩm**: Hiển thị mức ẩm (%) kèm khuyến nghị tối ưu (40-70%).
   - Trạng thái quạt làm mát: Biểu tượng quạt quay animation sinh động khi đang BẬT, hoặc đứng yên khi TẮT.
   - Chế độ vận hành: Hiển thị badge **AUTO** hoặc **MANUAL**.
2. Thử nghiệm thanh tìm kiếm theo tên hoặc vị trí phòng.
3. Bấm nút **"Chi Tiết & Biểu Đồ"** để chuyển sang Màn hình 3.

---

## GIAI ĐOẠN 3: PHÂN TÍCH TELEMETRY & ĐỒ THỊ RECHARTS (MÀN HÌNH 3: CHI TIẾT & BIỂU ĐỒ)
* **Mục tiêu**: Thể hiện kỹ thuật dùng thư viện **Recharts** vẽ 2 loại telemetry (Nhiệt độ & Độ ẩm) theo thời gian thực và tổng hợp dữ liệu PostgreSQL.
1. Quan sát **4 Thẻ Chỉ Số Đo Lớn (Live Metric Cards)**:
   - Nhiệt độ tức thời (°C) kèm cảnh báo vượt ngưỡng an toàn.
   - Độ ẩm tức thời (%).
   - Trạng thái Quạt làm mát (Relay GPIO 5).
   - Tổng số mẫu đo đã tích lũy trong bảng `telemetries` của PostgreSQL.
2. Quan sát **Biểu Đồ Recharts Trực Quan**:
   - **Đường màu vàng cam**: Thể hiện biến thiên nhiệt độ (Trục Y bên trái, đơn vị °C).
   - **Đường nét đứt màu xanh dương**: Thể hiện biến thiên độ ẩm (Trục Y bên phải, đơn vị %).
   - **Đường kẻ đỏ nằm ngang (ReferenceLine)**: Đánh dấu ngưỡng nhiệt độ quá nhiệt cần kích quạt làm mát (mặc định 26.0°C).
   - Biểu đồ tự động trượt vẽ các điểm mới mỗi 3 giây khi có bản tin MQTT từ ESP32 gửi về qua WebSocket Socket.IO.
3. Xem **Thống Kê 24 Giờ (PostgreSQL Aggregation)**:
   - Nhiệt độ Min, Max, Average và Độ ẩm Average tính toán tự động qua câu lệnh SQL `MIN()`, `MAX()`, `AVG()`.
4. Xem **Bảng Lịch Sử Đo Gần Nhất**:
   - 10 mẫu đo mới nhất với thời gian chính xác đến từng giây.
5. Bấm nút **"Gửi Lệnh Điều Khiển"** ở góc trên bên phải để vào Màn hình 4.

---

## GIAI ĐOẠN 4: GỬI LỆNH ĐIỀU KHIỂN & NHẬN PHẢN HỒI ACK (MÀN HÌNH 4: GỬI LỆNH)
* **Mục tiêu**: Thực hiện gửi lệnh điều khiển từ Web Dashboard xuống phần cứng ESP32-C3 qua MQTT và nhận phản hồi xác nhận (ACK).

### Thao tác 1: Điều khiển Bật/Tắt quạt thủ công (Relay GPIO 5)
1. Trên giao diện, chọn chuyển sang chế độ **"THỦ CÔNG (MANUAL)"**.
2. Bấm nút **"BẬT QUẠT (ON)"**:
   - Frontend gửi `POST /api/devices/esp32_c3_cold_01/commands` với payload `{"action":"SET_FAN","payload":{"fan":true}}`.
   - Backend publish lên MQTT topic `v1/devices/esp32_c3_cold_01/command`.
   - ESP32-C3 (hoặc simulator) nhận lệnh, kéo GPIO 5 lên HIGH, đóng tiếp điểm Relay cấp điện cho quạt quay.
   - Thiết bị gửi bản tin phản hồi lên topic `v1/devices/esp32_c3_cold_01/response`.
   - Bảng Lịch sử lệnh trên Dashboard ngay lập tức chuyển trạng thái sang **ĐÃ NHẬN (ACK)** với thông báo: *"Đã BẬT quạt tản nhiệt thành công."*
3. Bấm nút **"TẮT QUẠT (OFF)"**:
   - Relay ngắt, quạt dừng quay, phản hồi ACK ghi nhận tức thời.

### Thao tác 2: Cài đặt ngưỡng nhiệt độ tự động (SET_THRESHOLD)
1. Tại khối số 3 "Cài Đặt Ngưỡng Nhiệt Độ Làm Mát":
   - Đặt lại **Ngưỡng Bật Quạt (High)**: Ví dụ đổi thành `25.0` °C.
   - Đặt lại **Ngưỡng Tắt Quạt (Low)**: Ví dụ đổi thành `21.5` °C.
2. Bấm **"Phát Lệnh Cập Nhật Ngưỡng"**:
   - Lệnh được lưu vào CSDL và gửi qua MQTT. Thiết bị cập nhật ngưỡng và gửi ACK xác nhận.

### Thao tác 3: Kiểm chứng cơ chế Tự Động Kích Quạt (AUTO COOL-DOWN)
1. Chuyển thiết bị về chế độ **"TỰ ĐỘNG (AUTO)"**.
2. Khi nhiệt độ môi trường đo được từ cảm biến DHT11 $\ge 25.0$ °C:
   - Phần cứng tự động kích hoạt Relay bật quạt làm mát đồng thời bật **LED 2** (GPIO 6) cảnh báo quá nhiệt!
   - Đèn **LED 3** (GPIO 7) luôn sáng để báo hiệu hệ thống đang ở chế độ AUTO.
   - Khi quạt thổi làm nhiệt độ hạ xuống $\le 21.5$ °C:
   - Hệ thống tự ngắt Relay tắt quạt để tiết kiệm điện và tắt LED báo động.

---

## GIAI ĐOẠN 5: CHẠY KIỂM THỬ LIÊN TỤC 30 PHÚT
* Mở terminal hoặc để hệ thống chạy song song:
  - ESP32-C3 gửi telemetry đều đặn mỗi 3 giây.
  - PostgreSQL ghi nhận hơn 600 bản ghi dữ liệu đo mà không bị gián đoạn.
  - Đồ thị Recharts hiển thị chuỗi thời gian liên tục mượt mà.
