import { query } from '../config/db.js';
import { sendMqttCommand } from '../mqtt/mqttManager.js';

export const sendDeviceCommand = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, payload } = req.body;

    if (!action || !payload) {
      return res.status(400).json({ success: false, message: 'Yêu cầu cung cấp action và payload!' });
    }

    const validActions = ['SET_FAN', 'SET_MODE', 'SET_THRESHOLD', 'REBOOT'];
    if (!validActions.includes(action)) {
      return res.status(400).json({ success: false, message: `Lệnh không hợp lệ. Các lệnh hỗ trợ: ${validActions.join(', ')}` });
    }

    const sentBy = req.user ? req.user.username : 'admin';
    const command = await sendMqttCommand(id, action, payload, sentBy);

    res.json({
      success: true,
      message: `Đã phát lệnh [${action}] qua MQTT tới thiết bị ${id}`,
      data: command,
    });
  } catch (error) {
    console.error('[Command Error]', error);
    res.status(500).json({ success: false, message: 'Lỗi gửi lệnh điều khiển', error: error.message });
  }
};

export const getDeviceCommands = async (req, res) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit || '20', 10);

    const result = await query(
      `SELECT * FROM commands 
       WHERE device_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [id, limit]
    );

    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi truy vấn lịch sử lệnh', error: error.message });
  }
};
