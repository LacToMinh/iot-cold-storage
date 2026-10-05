# ❄️ HỆ THỐNG GIÁM SÁT & ĐIỀU KHIỂN KHO LẠNH, TỦ THUỐC & VẮC-XIN THÔNG MINH (IoT & EDGE COMPUTING)

> **Đồ Án Cuối Kỳ Môn Hệ Thống IoT & Lập Trình Nhúng**  
> **Chủ đề**: Giám sát Nhiệt độ/Độ ẩm Kho Lạnh Y Tế & Điều Khiển Làm Mát Tự Động  
> **Vi điều khiển Biên (Edge MCU)**: ESP32-C3 Super Mini (RISC-V 32-bit Core)  
> **Message Broker**: EMQX Message Broker (Docker Container) + Cloud Bridge (`broker.emqx.io`)  
> **Backend**: Node.js (Express.js) + Realtime Socket.IO + PostgreSQL Connection Pool  
> **Frontend**: React.js (Vite) + Recharts + React Router v6 + Axios Interceptor + Dual Theme (Light/Dark)  
> **Cơ sở dữ liệu**: PostgreSQL 18  

---

## 📑 MỤC LỤC
1. [Giới Thiệu & Mục Tiêu Dự Án](#-giới-thiệu--mục-tiêu-dự-án)
2. [Kiến Trúc Toàn Hệ Thống (5-Tier Architecture)](#-kiến-trúc-toàn-hệ-thống-5-tier-architecture)
3. [Thiết Kế Phần Cứng & Đấu Nối Chân (ESP32-C3)](#-thiết-kế-phần-cứng--đấu-nối-chân-esp32-c3)
4. [Cấu Trúc Giao Thức MQTT & Payloads](#-cấu-trúc-giao-thức-mqtt--payloads)
5. [Cơ Sở Dữ Liệu PostgreSQL](#-cơ-sở-dữ-liệu-postgresql)
6. [Giao Diện Người Dùng Web Dashboard](#-giao-diện-người-dùng-web-dashboard)
7. [Hướng Dẫn Cài Đặt & Vận Hành Hệ Thống](#-hướng-dẫn-cài-đặt--vận-hành-hệ-thống)
8. [Cấu Trúc Thư Mục Dự Án](#-cấu-trúc-thư-mục-dự-án)
9. [Điểm Sáng Học Thuật & Đánh Giá Đồ Án](#-điểm-sáng-học-thuật--đánh-giá-đồ-án)

---

## 🎯 GIỚI THIỆU & MỤC TIÊU DỰ ÁN

Trong bảo quản y tế, dược phẩm (đặc biệt là vắc-xin, sinh phẩm, thuốc nhạy nhiệt), việc duy trì dải nhiệt độ nghiêm ngặt là yêu cầu bắt buộc:
* **Mục tiêu:** Xây dựng hệ thống IoT hoàn chỉnh (End-to-End) có khả năng giám sát nhiệt độ và độ ẩm liên tục, kích hoạt quạt làm mát tức thì, cảnh báo quá nhiệt tại chỗ và từ xa, lưu vết toàn bộ dữ liệu đo và nhật ký điều khiển.
* **Đặc tính biên (Edge Resilience):** Vi điều khiển ESP32-C3 có khả năng vận hành độc lập, tự động đóng cắt relay bảo vệ khi quá nhiệt ngay cả khi mất kết nối mạng máy chủ.

---

## 🏛️ KIẾN TRÚC TOÀN HỆ THỐNG (5-TIER ARCHITECTURE)

```
[ TẦNG 1: THIẾT BỊ BIÊN / PERCEPTION & EDGE ]
  - Vi điều khiển: ESP32-C3 Super Mini (RISC-V 160MHz, Wi-Fi 2.4GHz)
  - Cảm biến: DHT11 (Nhiệt độ & Độ ẩm) trên chân GPIO 4
  - Chấp hành: Module Relay 5V kích quạt làm mát trên chân GPIO 5
  - Chỉ báo trạng thái: LED 2 Đỏ (Cảnh báo quá nhiệt) GPIO 6, LED 3 Xanh (Chế độ AUTO) GPIO 7
  - Logic biên độc lập: Tự kích hoạt quạt khi T >= Ngưỡng mà không cần Server
          │
          │ Wi-Fi 802.11 b/g/n (MQTT Protocol - TCP Port 1883)
          ▼
[ TẦNG 2: MẠNG TRUYỀN THÔNG & MESSAGE BROKER / NETWORK ]
  - Local Broker: EMQX Message Broker v6 triển khai qua Docker Container
  - Cloud Broker: EMQX Public Cloud (`broker.emqx.io`) với tiền tố `kholanh_tominh_2026`
  - Quản lý phiên: Last Will and Testament (LWT), QoS 1 cho lệnh điều khiển
          │
          │ MQTT TCP Stream & Pub/Sub Events
          ▼
[ TẦNG 3: LƯU TRỮ DỮ LIỆU / STORAGE ]
  - PostgreSQL 18: Lưu trữ quan hệ 4 bảng chuẩn hóa: `users`, `devices`, `telemetries`, `commands`
  - Đánh chỉ mục hiệu năng cao (Indexing) trên cặp trường `(device_id, created_at DESC)`
          │
          │ SQL Queries (Connection Pool pg)
          ▼
[ TẦNG 4: MÁY CHỦ XỬ LÝ / BACKEND APPLICATION ]
  - Node.js (v22, ES Modules) + Express.js RESTful API
  - Xác thực an toàn: JSON Web Token (JWT) + Bcrypt hashing (10 rounds)
  - Realtime Gateway: Socket.IO phát tán sự kiện tức thời xuống trình duyệt (< 50ms)
          │
          │ REST API (JSON) + WebSocket (Socket.IO)
          ▼
[ TẦNG 5: GIAO DIỆN TRÌNH DIỄN / PRESENTATION & CONTROL ]
  - React.js 18 SPA (Vite) + Dual Theme (Light Mode / Dark Mode)
  - Trực quan hóa dữ liệu: Biểu đồ đường động đa trục Recharts (Nhiệt độ & Độ ẩm)
  - Kiểm toán lệnh điều khiển: Bảng Audit Log thời gian thực hiển thị trạng thái SENT -> ACK
```

---

## 🔌 THIẾT KẾ PHẦN CỨNG & ĐẤU NỐI CHÂN (ESP32-C3)

### Bảng sơ đồ chân vi điều khiển ESP32-C3 Super Mini:

| Chân trên ESP32-C3 | Linh kiện kết nối | Chân linh kiện | Chức năng chi tiết |
| :--- | :--- | :--- | :--- |
| **3.3V** | Cảm biến DHT11 | VCC | Cấp nguồn nuôi an toàn cho cảm biến |
| **5V** | Module Relay 1 kênh | VCC / DC+ | Cấp nguồn nuôi cuộn hút Relay |
| **GND** | Chung toàn mạch | GND / DC- / Cathode LED | Đường mass chung của hệ thống |
| **GPIO 4** | Cảm biến DHT11 | DATA / OUT | Đọc tín hiệu nhiệt độ & độ ẩm chuẩn 1-Wire |
| **GPIO 5** | Module Relay | IN | Mức CAO (HIGH) kích đóng relay, cấp điện quạt |
| **GPIO 6** | Đèn LED 2 (Đỏ) | Anode (+) qua trở $220\Omega$ | Đèn sáng cảnh báo khi nhiệt độ $\ge$ Ngưỡng Bật |
| **GPIO 7** | Đèn LED 3 (Xanh) | Anode (+) qua trở $220\Omega$ | Đèn sáng khi chế độ AUTO, tắt khi MANUAL |

### Đấu nối Quạt tản nhiệt với tiếp điểm Relay:
* **Dây Đỏ của Quạt (+):** Đấu vào cọc **NO** (Normally Open - Tiếp điểm thường mở) của Relay.
* **Dây Đen của Quạt (-):** Đấu chung về cọc **GND** / **DC-**.
* **Nguồn cấp tiếp điểm:** Đấu từ cọc **COM** (Cổng chung ở giữa Relay) sang nguồn dương (+5V hoặc +12V ngoài tùy loại quạt).

---

## 📡 CẤU TRÚC GIAO THỨC MQTT & PAYLOADS

Hệ thống tuân thủ cấu trúc Topic phân cấp theo chuẩn IoT công nghiệp:

### 1. Kênh dữ liệu đo đạc (Telemetry Stream)
* **Topic:** `v1/devices/{device_id}/telemetry` (Ví dụ: `v1/devices/esp32_c3_cold_01/telemetry`)
* **Chu kỳ phát:** 3 giây / lần
* **Payload JSON:**
  ```json
  {
    "temperature": 25.8,
    "humidity": 59.8,
    "fan_status": false,
    "mode": "MANUAL"
  }
  ```

### 2. Kênh phát lệnh điều khiển (Control Command)
* **Topic:** `v1/devices/{device_id}/command`
* **Độ tin cậy:** QoS 1 (At least once)
* **Ví dụ các lệnh hỗ trợ:**
  * **Đổi chế độ:**
    ```json
    { "command_id": 255, "action": "SET_MODE", "payload": { "mode": "AUTO" } }
    ```
  * **Bật/Tắt quạt thủ công:**
    ```json
    { "command_id": 256, "action": "SET_FAN", "payload": { "fan": true } }
    ```
  * **Cài đặt ngưỡng nhiệt độ:**
    ```json
    { "command_id": 257, "action": "SET_THRESHOLD", "payload": { "low": 20.0, "high": 26.0 } }
    ```

### 3. Kênh xác nhận phản hồi (Response / ACK)
* **Topic:** `v1/devices/{device_id}/response`
* **Cơ chế:** Ngay sau khi thực thi lệnh vật lý, ESP32 đóng gói phản hồi ACK gửi ngược lên:
  ```json
  {
    "command_id": 255,
    "action": "SET_MODE",
    "status": "ACK",
    "message": "Da doi sang che do AUTO",
    "fan_status": false,
    "mode": "AUTO"
  }
  ```

### 4. Kênh trạng thái sống còn (Heartbeat & LWT)
* **Topic:** `v1/devices/{device_id}/status`
* **Nội dung:** `ONLINE` khi thiết bị khởi động thành công; tự động phát `OFFLINE` (Last Will and Testament) nếu ESP32 mất nguồn hoặc đứt kết nối mạng đột ngột.

---

## 🗄️ CƠ SỞ DỮ LIỆU POSTGRESQL

Cơ sở dữ liệu: `iot_cold_storage`

1. **Bảng `users`:** Quản lý tài khoản quản trị viên.
   * `id`, `username` (UNIQUE), `password_hash` (bcrypt), `full_name`, `role`, `created_at`.
2. **Bảng `devices`:** Quản lý danh mục kho lạnh / tủ thuốc.
   * `id` (PK - ví dụ: `esp32_c3_cold_01`), `name`, `location`, `status` (ONLINE/OFFLINE), `mode` (AUTO/MANUAL), `fan_status`, `temp_threshold_high`, `temp_threshold_low`, `last_seen`.
3. **Bảng `telemetries`:** Lưu trữ lịch sử toàn bộ các lần đo đạc.
   * `id` (BIGSERIAL), `device_id` (FK), `temperature`, `humidity`, `fan_status`, `mode`, `is_alert`, `created_at`.
4. **Bảng `commands`:** Nhật ký kiểm toán các lệnh điều khiển (Audit Trail).
   * `id` (BIGSERIAL), `device_id` (FK), `action`, `payload` (JSONB), `status` (SENT/ACK/FAILED), `sent_by`, `response_message`, `created_at`, `ack_at`.

---

## 💻 GIAO DIỆN NGƯỜI DÙNG WEB DASHBOARD

Ứng dụng Web Single Page Application (SPA) xây dựng trên React.js 18 và Vite:

### 1. Bốn Màn Hình Hoàn Chỉnh:
1. **Màn hình Đăng nhập (`/login`):** Giao diện xác thực bảo mật JWT, có nút nạp nhanh tài khoản kiểm thử `admin` / `123456`.
2. **Màn hình Danh sách Thiết bị (`/devices`):** Thẻ card trực quan hóa trạng thái từng kho lạnh (Online/Offline, nhiệt độ, độ ẩm hiện tại, quạt quay realtime).
3. **Màn hình Chi tiết & Biểu đồ (`/devices/:id`):**
   * Các thẻ Metric tổng hợp (Min, Max, Avg trong 24 giờ).
   * Biểu đồ đường động đa trục (Recharts LineChart) tự động cuộn thêm điểm đo mới tức thời qua WebSocket.
   * Bảng lịch sử dữ liệu phân trang có cảnh báo màu.
4. **Màn hình Điều khiển & Kiểm toán Lệnh (`/control`):**
   * Module đổi chế độ AUTO / MANUAL.
   * Module Bật/Tắt quạt làm mát tức thời.
   * Module thiết lập ngưỡng High/Low động từ xa.
   * Bảng lịch sử 25 lệnh gần nhất với huy hiệu chuyển trạng thái thời gian thực: `ĐÃ GỬI (SENT)` $\rightarrow$ `ĐÃ NHẬN (ACK)`.

### 2. Bốn Kỹ Thuật Lập Trình Frontend Bắt Buộc:
* **Kỹ thuật 1 - `useEffect` gọi API:** Tự động đồng bộ danh sách thiết bị và lịch sử đo khi tải trang.
* **Kỹ thuật 2 - `axios` gắn JWT Interceptor:** Tự động đính kèm token vào Header `Authorization: Bearer <token>` và xử lý tự động đăng xuất khi hết hạn token (401/403).
* **Kỹ thuật 3 - `React Router` bảo vệ route (`<ProtectedRoute>`):** Ngăn chặn người dùng chưa xác thực truy cập vào khu vực quản trị.
* **Kỹ thuật 4 - `Recharts` trực quan hóa:** Vẽ đồ thị nhiệt độ (°C) và độ ẩm (%) mượt mà kèm vạch ngưỡng cảnh báo (`ReferenceLine`).

---

## 🚀 HƯỚNG DẪN CÀI ĐẶT & VẬN HÀNH HỆ THỐNG

### Bước 1: Khởi động Docker EMQX Broker
Đảm bảo Docker Desktop đã bật, chạy lệnh:
```powershell
docker run -d --name emqx -p 1883:1883 -p 18083:18083 emqx/emqx:latest
```
* **Dashboard EMQX:** `http://localhost:18083` (Tài khoản: `admin` / `public`).

### Bước 2: Khởi tạo Cơ sở dữ liệu PostgreSQL
* Tạo cơ sở dữ liệu `iot_cold_storage` trong PostgreSQL (cổng 5432).
* Nạp cấu trúc bảng và dữ liệu mẫu:
```powershell
Get-Content "d:\Bài nộp\final_iot\database\init.sql" -Raw -Encoding UTF8 | & "D:\Lac To Minh\postgre\bin\psql.exe" -U postgres -d iot_cold_storage
```

### Bước 3: Khởi chạy Backend Node.js
Mở Terminal 1:
```powershell
cd "d:\Bài nộp\final_iot\backend"
node src/server.js
```
* Backend sẽ lắng nghe tại: `http://localhost:5000`

### Bước 4: Khởi chạy Frontend React.js
Mở Terminal 2:
```powershell
cd "d:\Bài nộp\final_iot\frontend"
npm run dev
```
* Mở trình duyệt truy cập: **`http://localhost:3000`**
* Đăng nhập: `admin` / `123456`.

### Bước 5: Nạp Firmware cho ESP32-C3
1. Mở Arduino IDE, mở file [`firmware/cold_storage_esp32/cold_storage_esp32.ino`](file:///d:/Bài%20nộp/final_iot/firmware/cold_storage_esp32/cold_storage_esp32.ino).
2. Điền thông tin WiFi và địa chỉ IP của máy tính (xem bằng lệnh `ipconfig`):
   ```cpp
   const char* WIFI_SSID     = "TÊN_WIFI";
   const char* WIFI_PASSWORD = "MẬT_KHẨU_WIFI";
   const char* MQTT_BROKER   = "172.20.10.4"; // Địa chỉ IP máy tính chạy Docker EMQX
   ```
3. Chọn board: **ESP32C3 Dev Module** và cổng COM tương ứng $\rightarrow$ Bấm **Upload**.

*(Ghi chú: Nếu chưa có phần cứng thật, có thể chạy giả lập qua `cd simulator && node device_simulator.js` để kiểm thử full tính năng).*

---

## 📁 CẤU TRÚC THƯ MỤC DỰ ÁN

```
d:\Bài nộp\final_iot\
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js             # Kết nối PostgreSQL Pool
│   │   │   └── initDb.js         # Tự động khởi tạo bảng khi cần
│   │   ├── controllers/          # Bộ điều khiển: Auth, Device, Telemetry, Command
│   │   ├── middleware/auth.js    # Xác thực quyền truy cập JWT
│   │   ├── mqtt/
│   │   │   └── mqttManager.js    # Quản lý kết nối MQTT Broker & Phản hồi ACK
│   │   ├── routes/api.js         # Định tuyến các API RESTful
│   │   ├── socket/socket.js      # Gateway WebSocket Realtime (Socket.IO)
│   │   └── server.js             # Khởi động dịch vụ Backend
│   ├── package.json
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── api/axiosClient.js    # KỸ THUẬT 2: Axios Interceptor gắn JWT
│   │   ├── components/           # Navbar, ProtectedRoute (KỸ THUẬT 3)
│   │   ├── context/              # AuthContext, SocketContext
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx       # MÀN HÌNH 1: Đăng nhập
│   │   │   ├── DeviceListPage.jsx  # MÀN HÌNH 2: Danh sách thiết bị (KỸ THUẬT 1: useEffect)
│   │   │   ├── DeviceDetailPage.jsx# MÀN HÌNH 3: Chi tiết & Đồ thị (KỸ THUẬT 4: Recharts)
│   │   │   └── ControlPage.jsx     # MÀN HÌNH 4: Bảng điều khiển & Lịch sử lệnh ACK
│   │   ├── App.jsx
│   │   ├── index.css             # Hệ thống CSS Design System & Dual Theme
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── firmware/
│   └── cold_storage_esp32/
│       └── cold_storage_esp32.ino# Firmware C++ cho ESP32-C3 Super Mini
├── simulator/
│   └── device_simulator.js       # Bộ giả lập vi điều khiển test tự động
├── database/
│   └── init.sql                  # Script DDL PostgreSQL & Seed Data
└── README.md                     # Tài liệu hướng dẫn đồ án
```

---

## 🏆 ĐIỂM SÁNG HỌC THUẬT & ĐÁNH GIÁ ĐỒ ÁN

1. **Tính chịu lỗi tại biên (Edge Autonomy):** Vi điều khiển tự động điều khiển Relay và bật LED cảnh báo độc lập khi quá nhiệt, không bị lệ thuộc thụ động vào đường truyền Internet.
2. **Cơ chế xác thực điều khiển 2 giai đoạn (2-Phase Command Execution with ACK):** Đảm bảo lệnh điều khiển phần cứng được xác nhận thành công trước khi hiển thị trên giao diện người dùng, ngăn ngừa hiện tượng báo ảo.
3. **Độ trễ thấp & Hiệu năng cao:** Kết hợp MQTT Broker và WebSocket mang lại trải nghiệm thời gian thực (< 100ms) với chi phí tài nguyên tối thiểu.
4. **Kiểm toán dữ liệu minh bạch (Full Audit Trail):** Mọi tác vụ điều khiển và dữ liệu cảm biến đều được lưu trữ vĩnh viễn và có thể đối soát minh bạch.
