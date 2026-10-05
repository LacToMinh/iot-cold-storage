import mqtt from 'mqtt';
import dotenv from 'dotenv';
import { query } from '../config/db.js';
import { broadcastTelemetry, broadcastDeviceStatus, broadcastCommandStatus } from '../socket/socket.js';

dotenv.config();

// ----------------------------------------------------
// CẤU HÌNH 2 BROKER (HYBRID EDGE - CLOUD BRIDGE)
// ----------------------------------------------------
let localMqttClient = null;
let cloudMqttClient = null;

// Broker 1: Local Docker EMQX (Giao tiếp với ESP32 tại chỗ)
const LOCAL_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';

// Broker 2: Public Cloud EMQX (Giao tiếp với Internet / 4G từ xa)
const CLOUD_BROKER_HOST = process.env.EXTERNAL_MQTT_BROKER || 'broker.emqx.io';
const CLOUD_BROKER_PORT = process.env.EXTERNAL_MQTT_PORT || 1883;
const CLOUD_BROKER_URL = process.env.CLOUD_MQTT_BROKER_URL || `mqtt://${CLOUD_BROKER_HOST}:${CLOUD_BROKER_PORT}`;

// Tiền tố độc nhất vô nhị để không bao giờ bị trùng lặp trên public broker
export const CLOUD_TOPIC_PREFIX = process.env.CLOUD_MQTT_PREFIX || 'kholanh_tominh_2026';

/**
 * Khởi tạo đồng thời 2 Broker MQTT:
 * 1. Local MQTT Client (EMQX Docker trên máy tính)
 * 2. Cloud MQTT Client (broker.emqx.io ngoài Internet)
 */
export const initMqttClient = (localUrl = LOCAL_BROKER_URL) => {
  console.log('----------------------------------------------------');
  console.log('🌐 [MQTT Dual Bridge] Khởi tạo hệ thống Cầu Nối 2 Broker...');
  console.log(`📌 [Broker 1 - Local Edge] : ${localUrl}`);
  console.log(`☁️ [Broker 2 - Public Cloud]: ${CLOUD_BROKER_URL}`);
  console.log(`🔑 [Cloud Topic Prefix]   : ${CLOUD_TOPIC_PREFIX}`);
  console.log('----------------------------------------------------');

  // ====================================================
  // 1. KẾT NỐI BROKER 1: LOCAL EMQX (DOCKER)
  // ====================================================
  const localOptions = {
    clientId: `backend_local_node_${Math.random().toString(16).substring(2, 8)}`,
    clean: true,
    reconnectPeriod: 3000,
    connectTimeout: 5000,
  };
  if (process.env.MQTT_USERNAME) {
    localOptions.username = process.env.MQTT_USERNAME;
    localOptions.password = process.env.MQTT_PASSWORD;
  }

  localMqttClient = mqtt.connect(localUrl, localOptions);

  localMqttClient.on('connect', () => {
    console.log(`✅ [Broker 1 - Local] Đã kết nối thành công tới Docker EMQX (${localUrl})!`);

    // Lắng nghe dữ liệu và phản hồi từ ESP32 tại chỗ
    localMqttClient.subscribe('v1/devices/+/telemetry', (err) => {
      if (!err) console.log('📥 [Broker 1 - Local] Subscribed: v1/devices/+/telemetry');
    });
    localMqttClient.subscribe('v1/devices/+/response', (err) => {
      if (!err) console.log('📥 [Broker 1 - Local] Subscribed: v1/devices/+/response');
    });
    localMqttClient.subscribe('v1/devices/+/ack', (err) => {
      if (!err) console.log('📥 [Broker 1 - Local] Subscribed: v1/devices/+/ack');
    });
    localMqttClient.subscribe('v1/devices/+/status', (err) => {
      if (!err) console.log('📥 [Broker 1 - Local] Subscribed: v1/devices/+/status');
    });
  });

  localMqttClient.on('message', async (topic, packet) => {
    try {
      const payloadStr = packet.toString();

      // 1. Telemetry từ ESP32
      const telMatch = topic.match(/^v1\/devices\/([^/]+)\/telemetry$/);
      if (telMatch) {
        await handleTelemetryMessage(telMatch[1], payloadStr);
        return;
      }

      // 2. Response / ACK từ ESP32
      const respMatch = topic.match(/^v1\/devices\/([^/]+)\/(response|ack)$/);
      if (respMatch) {
        await handleResponseMessage(respMatch[1], payloadStr);
        return;
      }

      // 3. Trạng thái sống còn (Status / LWT)
      const statMatch = topic.match(/^v1\/devices\/([^/]+)\/status$/);
      if (statMatch) {
        await handleStatusMessage(statMatch[1], payloadStr);
        return;
      }
    } catch (err) {
      console.error(`[Broker 1 - Local] Lỗi xử lý tin nhắn từ ${topic}:`, err.message);
    }
  });

  localMqttClient.on('error', (err) => {
    console.warn(`⚠️ [Broker 1 - Local] Chưa kết nối được Docker EMQX: ${err.message}. Đang đợi bạn bật container Docker...`);
  });

  // ====================================================
  // 2. KẾT NỐI BROKER 2: CLOUD EMQX (broker.emqx.io)
  // ====================================================
  const cloudOptions = {
    clientId: `kholanh_cloud_bridge_${Math.random().toString(16).substring(2, 8)}`,
    clean: true,
    reconnectPeriod: 5000,
    connectTimeout: 8000,
  };

  cloudMqttClient = mqtt.connect(CLOUD_BROKER_URL, cloudOptions);

  cloudMqttClient.on('connect', () => {
    console.log(`☁️ [Broker 2 - Cloud] Đã kết nối thành công tới Cloud Broker (${CLOUD_BROKER_URL})!`);

    // 1. Đăng ký nhận lệnh điều khiển từ xa
    const cloudCommandTopic = `${CLOUD_TOPIC_PREFIX}/v1/devices/+/command`;
    cloudMqttClient.subscribe(cloudCommandTopic, (err) => {
      if (!err) {
        console.log(`🌐 [Cloud Bridge Ingress] Đã sẵn sàng nhận lệnh từ xa tại topic:`);
        console.log(`   👉 ${cloudCommandTopic}`);
      }
    });

    // 2. Đăng ký nhận Telemetry và Response từ Cầu Nối Edge Bridge (khi Backend chạy trên Cloud)
    cloudMqttClient.subscribe(`${CLOUD_TOPIC_PREFIX}/v1/devices/+/telemetry`);
    cloudMqttClient.subscribe(`${CLOUD_TOPIC_PREFIX}/v1/devices/+/response`);
    cloudMqttClient.subscribe(`${CLOUD_TOPIC_PREFIX}/v1/devices/+/ack`);
    cloudMqttClient.subscribe(`${CLOUD_TOPIC_PREFIX}/v1/devices/+/status`);
  });

  // Xử lý gói tin từ Cloud Broker (khi có lệnh từ xa hoặc khi Backend chạy trên Cloud)
  cloudMqttClient.on('message', async (topic, packet) => {
    try {
      const payloadStr = packet.toString();

      // A. Nhận lệnh từ xa (chuyển tiếp xuống Local nếu đang chạy local)
      const cmdRegex = new RegExp(`^${CLOUD_TOPIC_PREFIX}\\/v1\\/devices\\/([^/]+)\\/command$`);
      const cmdMatch = topic.match(cmdRegex);
      if (cmdMatch) {
        const deviceId = cmdMatch[1];
        const cmdData = JSON.parse(payloadStr);
        const action = cmdData.action;
        const payload = cmdData.payload || {};
        const sentBy = cmdData.sent_by || 'remote_4g_user';

        if (action && localMqttClient && localMqttClient.connected) {
          console.log(`📱 [4G Remote Inbound] Nhận lệnh từ Cloud -> Chuyển tiếp xuống Local: ${deviceId} [${action}]`);
          const localTopic = `v1/devices/${deviceId}/command`;
          localMqttClient.publish(localTopic, payloadStr, { qos: 1 });
        }
        return;
      }

      // B. Nhận Telemetry từ Cầu Nối Edge Bridge gửi lên (khi Backend chạy trên Cloud không có Local Docker)
      if (!localMqttClient || !localMqttClient.connected) {
        const telRegex = new RegExp(`^${CLOUD_TOPIC_PREFIX}\\/v1\\/devices\\/([^/]+)\\/telemetry$`);
        const telMatch = topic.match(telRegex);
        if (telMatch) {
          await handleTelemetryMessage(telMatch[1], payloadStr, false);
          return;
        }

        const respRegex = new RegExp(`^${CLOUD_TOPIC_PREFIX}\\/v1\\/devices\\/([^/]+)\\/(response|ack)$`);
        const respMatch = topic.match(respRegex);
        if (respMatch) {
          await handleResponseMessage(respMatch[1], payloadStr, false);
          return;
        }

        const statRegex = new RegExp(`^${CLOUD_TOPIC_PREFIX}\\/v1\\/devices\\/([^/]+)\\/status$`);
        const statMatch = topic.match(statRegex);
        if (statMatch) {
          await handleStatusMessage(statMatch[1], payloadStr, false);
          return;
        }
      }
    } catch (err) {
      console.error(`[Broker 2 - Cloud] Lỗi xử lý tin nhắn từ Cloud:`, err.message);
    }
  });

  cloudMqttClient.on('error', (err) => {
    console.warn(`⚠️ [Broker 2 - Cloud] Kết nối Cloud tạm thời gián đoạn: ${err.message}`);
  });

  return { localClient: localMqttClient, cloudClient: cloudMqttClient };
};

export const getMqttClient = () => localMqttClient;
export const getCloudMqttClient = () => cloudMqttClient;

/**
 * Xử lý dữ liệu Telemetry nhận từ ESP32 tại chỗ
 * Đồng thời bắn bản sao (Bridge) lên Cloud Broker
 */
export const handleTelemetryMessage = async (deviceId, payloadStr) => {
  try {
    const data = JSON.parse(payloadStr);
    const temperature = parseFloat(data.temperature);
    const humidity = parseFloat(data.humidity);
    const fanStatus = !!data.fan_status;
    const mode = (data.mode || 'AUTO').toUpperCase();

    if (isNaN(temperature) || isNaN(humidity)) {
      return;
    }

    // 1. Kiểm tra hoặc thêm thiết bị vào PostgreSQL
    const devRes = await query('SELECT * FROM devices WHERE id = $1', [deviceId]);
    let device = devRes.rows[0];

    if (!device) {
      const insertDev = await query(
        `INSERT INTO devices (id, name, location, status, mode, fan_status) 
         VALUES ($1, $2, $3, 'ONLINE', $4, $5) RETURNING *`,
        [deviceId, `Kho Lạnh ${deviceId}`, 'Phòng Bảo Quản', mode, fanStatus]
      );
      device = insertDev.rows[0];
    }

    const isAlert = temperature >= (device.temp_threshold_high || 26.0);

    // 2. Lưu bản ghi đo đạc vào PostgreSQL
    const telRes = await query(
      `INSERT INTO telemetries (device_id, temperature, humidity, fan_status, mode, is_alert)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [deviceId, temperature, humidity, fanStatus, mode, isAlert]
    );
    const savedTelemetry = telRes.rows[0];

    // 3. Cập nhật trạng thái mới nhất của thiết bị
    const updRes = await query(
      `UPDATE devices 
       SET status = 'ONLINE', last_seen = NOW(), fan_status = $2, mode = $3
       WHERE id = $1 RETURNING *`,
      [deviceId, fanStatus, mode]
    );
    const updatedDevice = updRes.rows[0];

    // 4. Phát sự kiện WebSocket tức thì tới giao diện Web React
    broadcastTelemetry(deviceId, savedTelemetry);
    broadcastDeviceStatus(updatedDevice);

    // ====================================================
    // 5. CẦU NỐI DATA BRIDGE: ĐẨY DỮ LIỆU LÊN CLOUD BROKER
    // ====================================================
    if (cloudMqttClient && cloudMqttClient.connected) {
      const cloudTopic = `${CLOUD_TOPIC_PREFIX}/v1/devices/${deviceId}/telemetry`;
      cloudMqttClient.publish(cloudTopic, payloadStr, { qos: 0 });
      // Ghi log nhẹ nhàng
      // console.log(`☁️ [Cloud Sync] Đã đồng bộ Telemetry [${deviceId}] lên broker.emqx.io`);
    }

    // 6. Logic bảo vệ tự động tại biên (Edge Computing) nếu đang ở chế độ AUTO
    if (updatedDevice.mode === 'AUTO') {
      const highThresh = updatedDevice.temp_threshold_high ?? 26.0;
      const lowThresh = updatedDevice.temp_threshold_low ?? 20.0;

      if (temperature >= highThresh && !fanStatus) {
        console.log(`🔥 [Auto Cool-down] Nhiệt độ cao ${temperature}°C >= ${highThresh}°C. Kích BẬT QUẠT cho ${deviceId}`);
        await sendMqttCommand(deviceId, 'SET_FAN', { fan: true }, 'SYSTEM_AUTO');
      } else if (temperature <= lowThresh && fanStatus) {
        console.log(`❄️ [Auto Cool-down] Đã hạ nhiệt ${temperature}°C <= ${lowThresh}°C. Kích TẮT QUẠT cho ${deviceId}`);
        await sendMqttCommand(deviceId, 'SET_FAN', { fan: false }, 'SYSTEM_AUTO');
      }
    }
  } catch (err) {
    console.error(`[MQTT Telemetry] Lỗi xử lý cho ${deviceId}:`, err.message);
  }
};

/**
 * Xử lý bản tin xác nhận ACK từ ESP32 gửi về
 * Đồng thời đồng bộ trạng thái ACK lên Cloud Broker
 */
export const handleResponseMessage = async (deviceId, payloadStr) => {
  try {
    console.log(`📥 [MQTT Response / ACK] Nhận từ ${deviceId}: ${payloadStr}`);
    const data = JSON.parse(payloadStr);
    let commandId = data.command_id || data.id;
    const status = data.status || 'ACK';
    const message = data.message || 'OK';

    let updatedCommand = null;
    if (commandId && parseInt(commandId, 10) > 0) {
      const res = await query(
        `UPDATE commands 
         SET status = $1, response_message = $2, ack_at = NOW()
         WHERE id = $3 AND device_id = $4 RETURNING *`,
        [status, message, parseInt(commandId, 10), deviceId]
      );
      updatedCommand = res.rows[0];
    }

    if (!updatedCommand) {
      // Fallback: Nếu commandId là 0 hoặc thiếu, cập nhật cho lệnh SENT gần nhất
      const res = await query(
        `UPDATE commands 
         SET status = $1, response_message = $2, ack_at = NOW()
         WHERE id = (
           SELECT id FROM commands 
           WHERE device_id = $3 AND status = 'SENT' 
           ORDER BY id DESC LIMIT 1
         ) RETURNING *`,
        [status, message, deviceId]
      );
      updatedCommand = res.rows[0];
    }

    if (updatedCommand) {
      console.log(`✅ [ACK Updated] Lệnh #${updatedCommand.id} cập nhật trạng thái: ${status}`);
      broadcastCommandStatus(updatedCommand);

      // Cầu nối: Đồng bộ phản hồi ACK lên Cloud để người dùng ngoài 4G nhận biết
      if (cloudMqttClient && cloudMqttClient.connected) {
        const cloudTopic = `${CLOUD_TOPIC_PREFIX}/v1/devices/${deviceId}/response`;
        cloudMqttClient.publish(cloudTopic, JSON.stringify(updatedCommand), { qos: 1 });
      }
    }
  } catch (err) {
    console.error(`[MQTT Response] Lỗi xử lý cho ${deviceId}:`, err.message);
  }
};

/**
 * Xử lý bản tin trạng thái sống còn (LWT / Online / Offline)
 */
export const handleStatusMessage = async (deviceId, payloadStr) => {
  try {
    const status = payloadStr.trim().toUpperCase();
    const res = await query(
      `UPDATE devices SET status = $1, last_seen = NOW() WHERE id = $2 RETURNING *`,
      [status, deviceId]
    );
    if (res.rows[0]) {
      broadcastDeviceStatus(res.rows[0]);

      // Đồng bộ trạng thái thiết bị lên Cloud Broker
      if (cloudMqttClient && cloudMqttClient.connected) {
        const cloudTopic = `${CLOUD_TOPIC_PREFIX}/v1/devices/${deviceId}/status`;
        cloudMqttClient.publish(cloudTopic, status, { qos: 1, retain: true });
      }
    }
  } catch (err) {
    console.error(`[MQTT Status] Lỗi cho ${deviceId}:`, err.message);
  }
};

/**
 * Gửi lệnh điều khiển tới thiết bị qua Docker MQTT Broker và lưu PostgreSQL
 */
export const sendMqttCommand = async (deviceId, action, payload, sentBy = 'admin') => {
  // 1. Lưu lệnh vào PostgreSQL
  const dbRes = await query(
    `INSERT INTO commands (device_id, action, payload, status, sent_by)
     VALUES ($1, $2, $3, 'SENT', $4) RETURNING *`,
    [deviceId, action, JSON.stringify(payload), sentBy]
  );
  const command = dbRes.rows[0];

  // 2. Gói tin lệnh JSON
  const topic = `v1/devices/${deviceId}/command`;
  const messageObj = {
    command_id: parseInt(command.id, 10),
    action,
    payload,
    timestamp: new Date().toISOString(),
  };
  const jsonStr = JSON.stringify(messageObj);

  // 1. Phát lệnh xuống Docker MQTT Broker cho ESP32 tại nhà (nếu có kết nối local)
  if (localMqttClient && localMqttClient.connected) {
    localMqttClient.publish(topic, jsonStr, { qos: 1 }, (err) => {
      if (err) {
        console.error(`[MQTT Publish Error] Không thể gửi tới ${topic}:`, err.message);
      } else {
        console.log(`[MQTT Published Local] Lệnh #${command.id} [${action}] gửi tới ${topic} (Người gửi: ${sentBy})`);
      }
    });
  }

  // 2. Đồng thời phát lệnh lên Cloud Broker (để Edge Bridge kéo về nếu Backend đang chạy trên Cloud)
  if (cloudMqttClient && cloudMqttClient.connected) {
    const cloudTopic = `${CLOUD_TOPIC_PREFIX}/v1/devices/${deviceId}/command`;
    cloudMqttClient.publish(cloudTopic, jsonStr, { qos: 1 }, (err) => {
      if (err) {
        console.error(`[Cloud MQTT Publish Error] Không thể gửi tới ${cloudTopic}:`, err.message);
      } else {
        console.log(`☁️ [Cloud MQTT Published] Lệnh #${command.id} [${action}] gửi tới ${cloudTopic}`);
      }
    });
  }

  // 3. Cập nhật bảng devices trong PostgreSQL
  if (action === 'SET_MODE' && payload.mode) {
    await query('UPDATE devices SET mode = $1 WHERE id = $2', [payload.mode.toUpperCase(), deviceId]);
  } else if (action === 'SET_FAN' && typeof payload.fan === 'boolean') {
    await query('UPDATE devices SET fan_status = $1 WHERE id = $2', [payload.fan, deviceId]);
  } else if (action === 'SET_THRESHOLD') {
    if (payload.high !== undefined) {
      await query('UPDATE devices SET temp_threshold_high = $1 WHERE id = $2', [payload.high, deviceId]);
    }
    if (payload.low !== undefined) {
      await query('UPDATE devices SET temp_threshold_low = $1 WHERE id = $2', [payload.low, deviceId]);
    }
  }

  // Broadcast sự kiện lệnh mới tới giao diện Web React
  broadcastCommandStatus(command);

  return command;
};
