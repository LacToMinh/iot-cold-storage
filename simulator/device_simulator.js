import mqtt from 'mqtt';

const DEVICE_ID = process.env.DEVICE_ID || 'esp32_c3_cold_01';
const BROKER_URL = process.env.BROKER_URL || 'mqtt://localhost:1883';

console.log('====================================================');
console.log(`🤖 Starting ESP32-C3 IoT Device Simulator: [${DEVICE_ID}]`);
console.log(`📡 Connecting to MQTT Broker: ${BROKER_URL}`);
console.log('====================================================');

const client = mqtt.connect(BROKER_URL, {
  clientId: `esp32_c3_sim_${Math.random().toString(16).substring(2, 8)}`,
  clean: true,
});

let currentTemp = 24.5;
let currentHum = 65.0;
let fanStatus = false;
let currentMode = 'AUTO';
let tempThresholdHigh = 26.0;
let tempThresholdLow = 21.0;

client.on('connect', () => {
  console.log(`✅ [MQTT] Connected to broker successfully!`);

  // Subscribe to device command topic
  const commandTopic = `v1/devices/${DEVICE_ID}/command`;
  client.subscribe(commandTopic, (err) => {
    if (err) {
      console.error(`❌ Failed to subscribe to ${commandTopic}:`, err);
    } else {
      console.log(`📥 [MQTT] Subscribed to command topic: ${commandTopic}`);
    }
  });

  // Start sending telemetry periodically (every 3 seconds)
  setInterval(publishTelemetry, 3000);
});

// Publish telemetry
function publishTelemetry() {
  // If fan is ON, temperature drops; if fan is OFF, temperature rises slightly
  if (fanStatus) {
    currentTemp -= (0.2 + Math.random() * 0.3);
    if (currentTemp < 19.5) currentTemp = 19.5;
  } else {
    currentTemp += (0.15 + Math.random() * 0.25);
    if (currentTemp > 31.0) currentTemp = 31.0;
  }

  // Slight humidity variation
  currentHum += (Math.random() - 0.5) * 0.6;
  if (currentHum < 45) currentHum = 45;
  if (currentHum > 85) currentHum = 85;

  // Auto mode hardware reaction simulation
  if (currentMode === 'AUTO') {
    if (currentTemp >= tempThresholdHigh && !fanStatus) {
      fanStatus = true;
      console.log(`🔥 [AUTO LOCAL TRIGGER] Temp ${currentTemp.toFixed(1)}°C >= ${tempThresholdHigh}°C -> Fan turned ON!`);
    } else if (currentTemp <= tempThresholdLow && fanStatus) {
      fanStatus = false;
      console.log(`❄️ [AUTO LOCAL TRIGGER] Temp ${currentTemp.toFixed(1)}°C <= ${tempThresholdLow}°C -> Fan turned OFF!`);
    }
  }

  const payload = {
    temperature: parseFloat(currentTemp.toFixed(1)),
    humidity: parseFloat(currentHum.toFixed(1)),
    fan_status: fanStatus,
    mode: currentMode,
    timestamp: new Date().toISOString(),
  };

  const telemetryTopic = `v1/devices/${DEVICE_ID}/telemetry`;
  client.publish(telemetryTopic, JSON.stringify(payload));
  console.log(
    `📤 [Telemetry] T: ${payload.temperature}°C | H: ${payload.humidity}% | Quạt: ${fanStatus ? '🟢 BẬT' : '⚪ TẮT'} | Mode: ${currentMode}`
  );
}

// Receive and handle commands
client.on('message', (topic, message) => {
  try {
    const data = JSON.parse(message.toString());
    console.log(`\n🔔 [MQTT Command Received]`, data);

    const { command_id, action, payload } = data;
    let ackMessage = 'OK';

    if (action === 'SET_FAN') {
      fanStatus = !!payload.fan;
      ackMessage = `Đã ${fanStatus ? 'BẬT' : 'TẮT'} quạt tản nhiệt thành công.`;
      console.log(`💨 [Relay Action] Relay GPIO 5 set to ${fanStatus ? 'HIGH (ON)' : 'LOW (OFF)'}`);
    } else if (action === 'SET_MODE') {
      currentMode = (payload.mode || 'AUTO').toUpperCase();
      ackMessage = `Đã chuyển sang chế độ ${currentMode}.`;
      console.log(`⚙️ [Mode Change] Operating mode updated to: ${currentMode}`);
    } else if (action === 'SET_THRESHOLD') {
      if (payload.high !== undefined) tempThresholdHigh = payload.high;
      if (payload.low !== undefined) tempThresholdLow = payload.low;
      ackMessage = `Cập nhật ngưỡng nhiệt độ: High=${tempThresholdHigh}°C, Low=${tempThresholdLow}°C`;
      console.log(`🎯 [Threshold] High: ${tempThresholdHigh}°C, Low: ${tempThresholdLow}°C`);
    }

    // Send ACK back to server
    const responseTopic = `v1/devices/${DEVICE_ID}/response`;
    const responsePayload = {
      command_id,
      action,
      status: 'ACK',
      message: ackMessage,
      fan_status: fanStatus,
      mode: currentMode,
      timestamp: new Date().toISOString(),
    };

    client.publish(responseTopic, JSON.stringify(responsePayload));
    console.log(`📤 [ACK Sent] Response to command #${command_id} published.\n`);
  } catch (err) {
    console.error(`❌ Error parsing command payload:`, err.message);
  }
});

client.on('error', (err) => {
  console.error('❌ MQTT Client error:', err.message);
});
