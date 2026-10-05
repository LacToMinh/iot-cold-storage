import mqtt from 'mqtt';
import { handleTelemetryMessage } from './mqttManager.js';

let client = null;

export const initExternalMqttBridge = () => {
  const host = process.env.EXTERNAL_MQTT_BROKER || 'broker.emqx.io';
  const port = process.env.EXTERNAL_MQTT_PORT || 1883;
  const username = process.env.EXTERNAL_MQTT_USERNAME;
  const password = process.env.EXTERNAL_MQTT_PASSWORD;

  const url = `mqtt://${host}:${port}`;
  const options = {
    clientId: `iot_backend_bridge_${Math.random().toString(16).substring(2, 8)}`,
    clean: true,
    connectTimeout: 4000,
    reconnectPeriod: 10000,
  };

  if (username) {
    options.username = username;
    options.password = password;
  }

  try {
    client = mqtt.connect(url, options);

    client.on('connect', () => {
      console.log(`[External MQTT Bridge] Connected to Cloud MQTT Broker: ${url}`);
      // Subscribe to telemetry from external devices
      client.subscribe('v1/devices/+/telemetry', (err) => {
        if (!err) {
          console.log('[External MQTT Bridge] Subscribed to v1/devices/+/telemetry on cloud broker');
        }
      });
    });

    client.on('message', async (topic, message) => {
      const match = topic.match(/^v1\/devices\/([^/]+)\/telemetry$/);
      if (match) {
        const deviceId = match[1];
        await handleTelemetryMessage(deviceId, message.toString());
      }
    });

    client.on('error', (err) => {
      console.warn(`[External MQTT Bridge] Cloud broker warning: ${err.message}`);
    });
  } catch (err) {
    console.warn(`[External MQTT Bridge] Could not start external bridge:`, err.message);
  }

  return client;
};

export const publishToExternalBroker = (topic, payload) => {
  if (client && client.connected) {
    client.publish(topic, JSON.stringify(payload));
  }
};
