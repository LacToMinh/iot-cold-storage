import express from 'express';
import { login, register, getMe } from '../controllers/authController.js';
import { getDevices, getDeviceById, createDevice, updateThresholds, deleteDevice } from '../controllers/deviceController.js';
import { getDeviceTelemetryHistory, getDeviceTelemetryStats, postHttpTelemetry } from '../controllers/telemetryController.js';
import { sendDeviceCommand, getDeviceCommands } from '../controllers/commandController.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = express.Router();

// 1. Auth Routes
router.post('/auth/login', login);
router.post('/auth/register', register);
router.get('/auth/me', authenticateJWT, getMe);

// 2. Device Routes (Protected by JWT)
router.get('/devices', authenticateJWT, getDevices);
router.get('/devices/:id', authenticateJWT, getDeviceById);
router.post('/devices', authenticateJWT, createDevice);
router.put('/devices/:id/thresholds', authenticateJWT, updateThresholds);
router.delete('/devices/:id', authenticateJWT, deleteDevice);

// 3. Telemetry Routes
router.get('/devices/:id/telemetry', authenticateJWT, getDeviceTelemetryHistory);
router.get('/devices/:id/telemetry/stats', authenticateJWT, getDeviceTelemetryStats);
router.post('/devices/:id/telemetry', postHttpTelemetry); // Hardware fallback ingestion

// 4. Command Routes (Protected by JWT)
router.post('/devices/:id/commands', authenticateJWT, sendDeviceCommand);
router.get('/devices/:id/commands', authenticateJWT, getDeviceCommands);

export default router;
