import { query } from '../config/db.js';
import { handleTelemetryMessage } from '../mqtt/mqttManager.js';

export const getDeviceTelemetryHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit || '50', 10);

    const result = await query(
      `SELECT 
        id,
        device_id,
        temperature,
        humidity,
        fan_status,
        mode,
        is_alert,
        created_at,
        TO_CHAR(created_at, 'HH24:MI:SS') as time_str
       FROM telemetries
       WHERE device_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [id, Math.min(limit, 200)]
    );

    // Return chronological order (oldest to newest) for chart plotting
    const chronologicalData = result.rows.reverse();

    res.json({ success: true, count: chronologicalData.length, data: chronologicalData });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi truy vấn dữ liệu đo', error: error.message });
  }
};

export const getDeviceTelemetryStats = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT 
        ROUND(MIN(temperature)::numeric, 1) as min_temp,
        ROUND(MAX(temperature)::numeric, 1) as max_temp,
        ROUND(AVG(temperature)::numeric, 1) as avg_temp,
        ROUND(MIN(humidity)::numeric, 1) as min_hum,
        ROUND(MAX(humidity)::numeric, 1) as max_hum,
        ROUND(AVG(humidity)::numeric, 1) as avg_hum,
        COUNT(*) as total_samples
       FROM telemetries
       WHERE device_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
      [id]
    );

    res.json({ success: true, stats: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi tính toán thống kê', error: error.message });
  }
};

export const postHttpTelemetry = async (req, res) => {
  try {
    const { id } = req.params;
    const { temperature, humidity, fan_status, mode } = req.body;

    await handleTelemetryMessage(id, JSON.stringify({ temperature, humidity, fan_status, mode }));

    res.json({ success: true, message: 'Dữ liệu đo đã được ghi nhận qua HTTP' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi ghi dữ liệu đo', error: error.message });
  }
};
