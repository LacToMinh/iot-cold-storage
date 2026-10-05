/*
 * ==============================================================================
 * HỆ THỐNG GIÁM SÁT & ĐIỀU KHIỂN KHO LẠNH, TỦ THUỐC THÔNG MINH (IoT)
 * Vi điều khiển: ESP32-C3 Super Mini
 * 
 * SƠ ĐỒ CHÂN (THEO ĐÚNG HÌNH ẢNH & YÊU CẦU PHẦN CỨNG):
 * - DHT11 Data        : GPIO 4  (VCC -> 3.3V, GND -> GND)
 * - Relay IN (Quạt)   : GPIO 5  (DC+ -> 5V, DC- -> GND, NO -> Quạt Đỏ, COM -> 5V/12V)
 * - LED 2 (Quá nhiệt) : GPIO 6  (Chân dài + Trở -> GPIO 6, Chân ngắn -> GND)
 * - LED 3 (Chế độ)    : GPIO 7  (Chân dài + Trở -> GPIO 7, Chân ngắn -> GND)
 * 
 * THƯ VIỆN CẦN CÀI ĐẶT QUA ARDUINO LIBRARY MANAGER:
 * 1. "DHT sensor library" by Adafruit
 * 2. "PubSubClient" by Nick O'Leary
 * 3. "ArduinoJson" by Benoit Blanchon (phiên bản 6 hoặc 7)
 * ==============================================================================
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <ArduinoJson.h>

// ---------------------- 1. CẤU HÌNH MẠNG & MQTT ----------------------
const char* WIFI_SSID     = "YOUR_WIFI_SSID";         // Thay bằng tên WiFi của bạn
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";     // Thay bằng mật khẩu WiFi

// Địa chỉ IP của máy tính chạy Backend Node.js / MQTT Broker
const char* MQTT_BROKER   = "172.20.10.4";            // Đã điền sẵn IP máy tính hiện tại của bạn (kiểm tra lại bằng ipconfig nếu đổi mạng)
const int   MQTT_PORT     = 1883;
const char* MQTT_USER     = "";                       // Để trống nếu không dùng user/pass
const char* MQTT_PASS     = "";

const char* DEVICE_ID     = "esp32_c3_cold_01";

// MQTT Topics
const String TOPIC_TELEMETRY = "v1/devices/" + String(DEVICE_ID) + "/telemetry";
const String TOPIC_COMMAND   = "v1/devices/" + String(DEVICE_ID) + "/command";
const String TOPIC_RESPONSE  = "v1/devices/" + String(DEVICE_ID) + "/response";
const String TOPIC_STATUS    = "v1/devices/" + String(DEVICE_ID) + "/status";

// ---------------------- 2. CẤU HÌNH CHÂN PHẦN CỨNG ----------------------
#define PIN_DHT         4
#define PIN_RELAY_FAN   5
#define PIN_LED_ALERT   6
#define PIN_LED_MODE    7

#define DHTTYPE DHT11

// Nếu Relay kích mức CAO (Jumper H): dùng HIGH. Nếu kích mức THẤP (Jumper L): dùng LOW.
#define RELAY_ON        HIGH
#define RELAY_OFF       LOW

DHT dht(PIN_DHT, DHTTYPE);
WiFiClient espClient;
PubSubClient mqttClient(espClient);

// ---------------------- 3. BIẾN TRẠNG THÁI HỆ THỐNG ----------------------
float temperature = 0.0;
float humidity = 0.0;
bool  fanStatus = false;
String currentMode = "AUTO"; // "AUTO" hoặc "MANUAL"

float tempThresholdHigh = 26.0; // Ngưỡng bật quạt làm mát
float tempThresholdLow  = 21.0; // Ngưỡng ngắt quạt khi đã mát

unsigned long lastTelemetryTime = 0;
const unsigned long TELEMETRY_INTERVAL = 3000; // Gửi dữ liệu mỗi 3 giây

// ---------------------- 4. HÀM XỬ LÝ LỆNH TỪ SERVER ----------------------
void handleMqttCallback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }

  Serial.println("\n----------------------------------------------------");
  Serial.print("📥 [MQTT Inbound] Topic: ");
  Serial.println(topic);
  Serial.print("Payload: ");
  Serial.println(message);

  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, message);
  if (error) {
    Serial.print("❌ Lỗi parse JSON: ");
    Serial.println(error.f_str());
    return;
  }

  long commandId = doc["command_id"].as<long>();
  if (commandId == 0 && doc["command_id"].is<const char*>()) {
    commandId = atol(doc["command_id"].as<const char*>());
  }
  String action = doc["action"] | "";
  JsonObject payloadObj = doc["payload"];

  String ackMessage = "OK";

  if (action == "SET_FAN") {
    // Điều khiển quạt thủ công
    fanStatus = payloadObj["fan"] | false;
    digitalWrite(PIN_RELAY_FAN, fanStatus ? RELAY_ON : RELAY_OFF);
    ackMessage = fanStatus ? "Quat da BAT" : "Quat da TAT";
    Serial.printf("⚡ [Relay Fan] %s\n", fanStatus ? "ON" : "OFF");
  } 
  else if (action == "SET_MODE") {
    // Đổi chế độ Auto / Manual
    String newMode = payloadObj["mode"] | "AUTO";
    newMode.toUpperCase();
    currentMode = newMode;
    ackMessage = "Da doi sang che do " + currentMode;

    // Cập nhật đèn LED Mode (GPIO 7)
    digitalWrite(PIN_LED_MODE, (currentMode == "AUTO") ? HIGH : LOW);
    Serial.printf("🔄 [Mode] Chuyen sang che do: %s\n", currentMode.c_str());
  } 
  else if (action == "SET_THRESHOLD") {
    // Cập nhật ngưỡng nhiệt độ
    if (payloadObj.containsKey("high")) {
      tempThresholdHigh = payloadObj["high"];
    }
    if (payloadObj.containsKey("low")) {
      tempThresholdLow = payloadObj["low"];
    }
    ackMessage = "Cap nhat nguong thanh cong";
    Serial.printf("🎯 [Threshold] High: %.1f C, Low: %.1f C\n", tempThresholdHigh, tempThresholdLow);
  }

  // Gửi ACK phản hồi về Backend
  StaticJsonDocument<256> respDoc;
  respDoc["command_id"] = commandId;
  respDoc["action"] = action;
  respDoc["status"] = "ACK";
  respDoc["message"] = ackMessage;
  respDoc["fan_status"] = fanStatus;
  respDoc["mode"] = currentMode;

  char respBuffer[256];
  serializeJson(respDoc, respBuffer);
  mqttClient.publish(TOPIC_RESPONSE.c_str(), respBuffer);
  Serial.print("📤 [ACK Sent]: ");
  Serial.println(respBuffer);
  Serial.println("----------------------------------------------------\n");
}

// ---------------------- 5. KẾT NỐI WIFI & MQTT ----------------------
void setupWiFi() {
  Serial.println();
  Serial.print("📡 Đang kết nối WiFi: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\n✅ WiFi đã kết nối thành công!");
  Serial.print("🌐 Địa chỉ IP của ESP32-C3: ");
  Serial.println(WiFi.localIP());
}

void reconnectMQTT() {
  while (!mqttClient.connected()) {
    Serial.print("🔄 Đang kết nối MQTT Broker...");
    String clientId = "ESP32C3_" + String(DEVICE_ID);

    // Thiết lập Last Will and Testament (LWT)
    if (mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASS, TOPIC_STATUS.c_str(), 1, true, "OFFLINE")) {
      Serial.println(" Kết nối thành công!");

      // Báo trạng thái ONLINE
      mqttClient.publish(TOPIC_STATUS.c_str(), "ONLINE", true);

      // Đăng ký nhận lệnh điều khiển
      mqttClient.subscribe(TOPIC_COMMAND.c_str());
      Serial.printf("📥 Đã subscribe topic lệnh: %s\n", TOPIC_COMMAND.c_str());
    } else {
      Serial.print(" Thất bại, rc=");
      Serial.print(mqttClient.state());
      Serial.println(". Thử lại sau 3 giây...");
      delay(3000);
    }
  }
}

// ---------------------- 6. SETUP & LOOP ----------------------
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("====================================================");
  Serial.println("   HỆ THỐNG KHO LẠNH/TỦ THUỐC ESP32-C3 SUPER MINI   ");
  Serial.println("====================================================");

  // Cấu hình chân GPIO
  pinMode(PIN_RELAY_FAN, OUTPUT);
  pinMode(PIN_LED_ALERT, OUTPUT);
  pinMode(PIN_LED_MODE, OUTPUT);

  // Trạng thái ban đầu
  digitalWrite(PIN_RELAY_FAN, RELAY_OFF);
  digitalWrite(PIN_LED_ALERT, LOW);
  digitalWrite(PIN_LED_MODE, HIGH); // Mặc định AUTO -> LED 3 sáng

  // Khởi động cảm biến DHT11
  dht.begin();
  Serial.println("🌡️ Cảm biến DHT11 sẵn sàng trên GPIO 4");

  // Kết nối mạng
  setupWiFi();

  // Cấu hình MQTT
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setBufferSize(512); // Tăng kích thước bộ đệm nhận gói tin MQTT JSON từ 128 bytes lên 512 bytes
  mqttClient.setCallback(handleMqttCallback);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    setupWiFi();
  }

  if (!mqttClient.connected()) {
    reconnectMQTT();
  }

  mqttClient.loop();

  unsigned long now = millis();
  if (now - lastTelemetryTime >= TELEMETRY_INTERVAL) {
    lastTelemetryTime = now;

    // Đọc cảm biến DHT11
    float t = dht.readTemperature();
    float h = dht.readHumidity();

    if (!isnan(t) && !isnan(h)) {
      temperature = t;
      humidity = h;
    } else {
      Serial.println("⚠️ Lỗi đọc cảm biến DHT11! Sử dụng dữ liệu đo gần nhất.");
    }

    // Logic xử lý cục bộ khi ở chế độ AUTO (Bảo vệ phần cứng độc lập)
    if (currentMode == "AUTO") {
      if (temperature >= tempThresholdHigh && !fanStatus) {
        fanStatus = true;
        digitalWrite(PIN_RELAY_FAN, RELAY_ON);
        Serial.printf("🔥 [CẢNH BÁO NHIỆT] %.1f C >= %.1f C -> BẬT QUẠT LÀM MÁT\n", temperature, tempThresholdHigh);
      } else if (temperature <= tempThresholdLow && fanStatus) {
        fanStatus = false;
        digitalWrite(PIN_RELAY_FAN, RELAY_OFF);
        Serial.printf("❄️ [ĐÃ HẠ NHIỆT] %.1f C <= %.1f C -> TẮT QUẠT\n", temperature, tempThresholdLow);
      }
    }

    // Điều khiển LED cảnh báo quá nhiệt (GPIO 6)
    if (temperature >= tempThresholdHigh) {
      digitalWrite(PIN_LED_ALERT, HIGH); // Bật LED đỏ báo động
    } else {
      digitalWrite(PIN_LED_ALERT, LOW);
    }

    // Đóng gói và gửi Telemetry JSON lên MQTT
    StaticJsonDocument<256> doc;
    doc["temperature"] = serialized(String(temperature, 1));
    doc["humidity"]    = serialized(String(humidity, 1));
    doc["fan_status"]  = fanStatus;
    doc["mode"]        = currentMode;

    char jsonBuffer[256];
    serializeJson(doc, jsonBuffer);

    mqttClient.publish(TOPIC_TELEMETRY.c_str(), jsonBuffer);
    Serial.printf("📤 [Telemetry] Nhiệt độ: %.1f C | Độ ẩm: %.1f %% | Quạt: %s | Mode: %s\n",
                  temperature, humidity, fanStatus ? "BẬT" : "TẮT", currentMode.c_str());
  }
}
