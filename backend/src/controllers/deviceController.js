import { query } from '../config/db.js';
import { broadcastDeviceStatus } from '../socket/socket.js';

export const getDevices = async (req, res) => {
  try {
    // Query devices and join with their latest telemetry
    const sql = `
      SELECT 
        d.*,
        t.temperature AS latest_temperature,
        t.humidity AS latest_humidity,
        t.created_at AS latest_telemetry_time,
        CASE 
          WHEN d.last_seen > NOW() - INTERVAL '15 seconds' THEN 'ONLINE'
          ELSE 'OFFLINE'
        END AS realtime_status
      FROM devices d
      LEFT JOIN LATERAL (
        SELECT temperature, humidity, created_at 
        FROM telemetries 
        WHERE device_id = d.id 
        ORDER BY created_at DESC 
        LIMIT 1
      ) t ON true
      ORDER BY d.created_at ASC;
    `;
    const result = await query(sql);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Device Controller] getDevices error:', error);
    res.status(500).json({ success: false, message: 'Lỗi truy vấn danh sách thiết bị', error: error.message });
  }
};

export const getDeviceById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT 
        d.*,
        t.temperature AS latest_temperature,
        t.humidity AS latest_humidity,
        t.created_at AS latest_telemetry_time,
        CASE 
          WHEN d.last_seen > NOW() - INTERVAL '15 seconds' THEN 'ONLINE'
          ELSE 'OFFLINE'
        END AS realtime_status
       FROM devices d
       LEFT JOIN LATERAL (
         SELECT temperature, humidity, created_at 
         FROM telemetries 
         WHERE device_id = d.id 
         ORDER BY created_at DESC 
         LIMIT 1
       ) t ON true
       WHERE d.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thiết bị!' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi truy vấn thiết bị', error: error.message });
  }
};

export const createDevice = async (req, res) => {
  try {
    const { id, name, location, temp_threshold_high = 26.0, temp_threshold_low = 20.0, mode = 'AUTO' } = req.body;

    if (!id || !name) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp mã ID và tên thiết bị!' });
    }

    const check = await query('SELECT id FROM devices WHERE id = $1', [id]);
    if (check.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'Mã thiết bị đã tồn tại!' });
    }

    const insert = await query(
      `INSERT INTO devices (id, name, location, temp_threshold_high, temp_threshold_low, mode, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'ONLINE') RETURNING *`,
      [id, name, location || 'Chưa xác định', temp_threshold_high, temp_threshold_low, mode]
    );

    broadcastDeviceStatus(insert.rows[0]);
    res.status(201).json({ success: true, data: insert.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi thêm thiết bị', error: error.message });
  }
};

export const updateDevice = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, location, temp_threshold_high, temp_threshold_low, mode } = req.body;

    const result = await query(
      `UPDATE devices 
       SET name = COALESCE($1, name),
           location = COALESCE($2, location),
           temp_threshold_high = COALESCE($3, temp_threshold_high),
           temp_threshold_low = COALESCE($4, temp_threshold_low),
           mode = COALESCE($5, mode)
       WHERE id = $6 RETURNING *`,
      [name, location, temp_threshold_high, temp_threshold_low, mode, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thiết bị!' });
    }

    broadcastDeviceStatus(result.rows[0]);
    res.json({ success: true, message: 'Cập nhật thiết bị thành công!', data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi cập nhật thiết bị', error: error.message });
  }
};

export const updateThresholds = async (req, res) => {
  try {
    const { id } = req.params;
    const { temp_threshold_high, temp_threshold_low } = req.body;

    const result = await query(
      `UPDATE devices 
       SET temp_threshold_high = COALESCE($1, temp_threshold_high),
           temp_threshold_low = COALESCE($2, temp_threshold_low)
       WHERE id = $3 RETURNING *`,
      [temp_threshold_high, temp_threshold_low, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thiết bị!' });
    }

    broadcastDeviceStatus(result.rows[0]);
    res.json({ success: true, message: 'Cập nhật ngưỡng nhiệt độ thành công!', data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi cập nhật ngưỡng', error: error.message });
  }
};

export const deleteDevice = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM devices WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thiết bị để xóa!' });
    }
    res.json({ success: true, message: 'Đã xóa thiết bị thành công!', data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi xóa thiết bị', error: error.message });
  }
};

