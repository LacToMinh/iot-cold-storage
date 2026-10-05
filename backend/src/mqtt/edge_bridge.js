import mqtt from 'mqtt';
import dotenv from 'dotenv';

dotenv.config();

// ----------------------------------------------------
// CẤU HÌNH CẦU NỐI BIÊN (EDGE GATEWAY BRIDGE)
// ----------------------------------------------------
const LOCAL_BROKER = process.env.LOCAL_MQTT_URL || 'mqtt://localhost:1883';
const CLOUD_BROKER = process.env.CLOUD_MQTT_URL || 'mqtt://broker.emqx.io:1883';
const CLOUD_PREFIX = process.env.CLOUD_MQTT_PREFIX || 'kholanh_tominh_2026';

console.log('====================================================');
console.log('❄️  IOT COLD STORAGE - EDGE TO CLOUD GATEWAY BRIDGE');
console.log('====================================================');
console.log(`🏠 [Local Broker] : ${LOCAL_BROKER} (Docker EMQX)`);
console.log(`☁️  [Cloud Broker] : ${CLOUD_BROKER} (Public Internet)`);
console.log(`🔑 [Topic Prefix] : ${CLOUD_PREFIX}`);
console.log('====================================================\n');

// 1. Kết nối Docker Broker Local trên máy tính
const localClient = mqtt.connect(LOCAL_BROKER, {
  clientId: `edge_bridge_local_${Math.random().toString(16).substring(2, 8)}`,
  clean: true,
  reconnectPeriod: 3000,
});

// 2. Kết nối Public Cloud Broker ngoài Internet
const cloudClient = mqtt.connect(CLOUD_BROKER, {
  clientId: `edge_bridge_cloud_${Math.random().toString(16).substring(2, 8)}`,
  clean: true,
  reconnectPeriod: 5000,
});

// Khi Local Broker kết nối
localClient.on('connect', () => {
  console.log('✅ [Local Edge] Đã kết nối thành công tới Docker EMQX!');
  // Lắng nghe dữ liệu từ mạch ESP32
  localClient.subscribe('v1/devices/+/telemetry');
  localClient.subscribe('v1/devices/+/response');
  localClient.subscribe('v1/devices/+/ack');
  localClient.subscribe('v1/devices/+/status');
  console.log('👂 [Local Edge] Đang lắng nghe: v1/devices/+/telemetry, response, status');
});

// Khi Cloud Broker kết nối
cloudClient.on('connect', () => {
  console.log('✅ [Cloud Broker] Đã kết nối thành công tới broker.emqx.io!');
  // Lắng nghe lệnh điều khiển từ Backend trên Cloud bắn xuống
  const cloudCmdTopic = `${CLOUD_PREFIX}/v1/devices/+/command`;
  cloudClient.subscribe(cloudCmdTopic, { qos: 1 }, (err) => {
    if (!err) {
      console.log(`👂 [Cloud Ingress] Đang lắng nghe lệnh từ xa: ${cloudCmdTopic}`);
    }
  });
});

// ----------------------------------------------------
// CHIỀU 1: LOCAL -> CLOUD (ĐẨY DỮ LIỆU TỪ NHÀ LÊN CLOUD)
// ----------------------------------------------------
localClient.on('message', (topic, payload) => {
  const payloadStr = payload.toString();

  // 1. Chuyển tiếp Telemetry
  const telMatch = topic.match(/^v1\/devices\/([^/]+)\/telemetry$/);
  if (telMatch) {
    const deviceId = telMatch[1];
    const targetTopic = `${CLOUD_PREFIX}/v1/devices/${deviceId}/telemetry`;
    cloudClient.publish(targetTopic, payloadStr, { qos: 0 });
    console.log(`📤 [Local -> Cloud] Telemetry: [${deviceId}] -> ${payloadStr}`);
    return;
  }

  // 2. Chuyển tiếp Phản hồi lệnh (ACK)
  const respMatch = topic.match(/^v1\/devices\/([^/]+)\/(response|ack)$/);
  if (respMatch) {
    const deviceId = respMatch[1];
    const targetTopic = `${CLOUD_PREFIX}/v1/devices/${deviceId}/response`;
    cloudClient.publish(targetTopic, payloadStr, { qos: 1 });
    console.log(`🎯 [Local -> Cloud] Phản hồi ACK: [${deviceId}] -> ${payloadStr}`);
    return;
  }

  // 3. Chuyển tiếp Trạng thái sống còn (Status / LWT)
  const statMatch = topic.match(/^v1\/devices\/([^/]+)\/status$/);
  if (statMatch) {
    const deviceId = statMatch[1];
    const targetTopic = `${CLOUD_PREFIX}/v1/devices/${deviceId}/status`;
    cloudClient.publish(targetTopic, payloadStr, { qos: 1, retain: true });
    console.log(`📶 [Local -> Cloud] Trạng thái thiết bị: [${deviceId}] -> ${payloadStr}`);
    return;
  }
});

// ----------------------------------------------------
// CHIỀU 2: CLOUD -> LOCAL (KÉO LỆNH TỪ CLOUD XUỐNG ESP32)
// ----------------------------------------------------
cloudClient.on('message', (topic, payload) => {
  const payloadStr = payload.toString();
  const regex = new RegExp(`^${CLOUD_PREFIX}\\/v1\\/devices\\/([^/]+)\\/command$`);
  const match = topic.match(regex);

  if (match) {
    const deviceId = match[1];
    const localTargetTopic = `v1/devices/${deviceId}/command`;
    localClient.publish(localTargetTopic, payloadStr, { qos: 1 });
    console.log(`\n📥 [Cloud -> Local] NHẬN LỆNH TỪ XA: [${deviceId}]`);
    console.log(`   👉 Bắn ngay xuống Docker Local topic: ${localTargetTopic}`);
    console.log(`   👉 Dữ liệu lệnh: ${payloadStr}\n`);
  }
});

localClient.on('error', (err) => console.warn(`⚠️ [Local Error] ${err.message}`));
cloudClient.on('error', (err) => console.warn(`⚠️ [Cloud Error] ${err.message}`));
