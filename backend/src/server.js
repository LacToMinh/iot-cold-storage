import http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRoutes from './routes/api.js';
import { checkDatabaseConnection } from './config/db.js';
import { autoInitDatabase } from './config/initDb.js';
import { initSocket } from './socket/socket.js';
import { initMqttClient } from './mqtt/mqttManager.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Middlewares
app.use(cors({ origin: '*' }));
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[HTTP] ${req.method} ${req.path}`);
  }
  next();
});

// API Routes
app.use('/api', apiRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'IoT Cold Storage Monitoring & Control Backend',
    timestamp: new Date().toISOString(),
  });
});

// Port settings
const PORT = process.env.PORT || 5000;
const DOCKER_MQTT_BROKER = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';

// Bootstrap Server
const startServer = async () => {
  console.log('----------------------------------------------------');
  console.log('🚀 Starting IoT Cold Storage System Backend...');
  console.log('----------------------------------------------------');

  // 1. Verify PostgreSQL Database & Auto-init schema if empty
  await checkDatabaseConnection();
  await autoInitDatabase();

  // 2. Initialize Realtime Socket.IO
  initSocket(server);
  console.log('[Socket.IO] Realtime WebSocket initialized');

  // 3. Connect to Docker MQTT Broker (Mosquitto / EMQX running in Docker)
  // Lưu ý: Backend KHÔNG chiếm port 1883, nhường trọn vẹn port 1883 cho Docker container!
  initMqttClient(DOCKER_MQTT_BROKER);

  // 4. Start HTTP API Server (Port 5000)
  server.listen(PORT, () => {
    console.log(`[HTTP Server] REST API is listening on http://localhost:${PORT}`);
    console.log(`[HTTP Server] Health check: http://localhost:${PORT}/health`);
    console.log('----------------------------------------------------');
  });
};

startServer().catch((err) => {
  console.error('[Fatal Error] Server could not start:', err);
});
