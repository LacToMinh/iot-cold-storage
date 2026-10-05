import { query } from './db.js';
import bcrypt from 'bcryptjs';

/**
 * Tự động khởi tạo cấu trúc bảng (Schema) và dữ liệu mẫu (Seed Data)
 * Hữu ích khi deploy lên Cloud (Render / Supabase) lần đầu tiên mà không cần chạy SQL thủ công.
 */
export const autoInitDatabase = async () => {
  try {
    // 1. Kiểm tra xem bảng devices đã tồn tại chưa
    const checkTable = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'devices'
      );
    `);

    const tableExists = checkTable.rows[0].exists;
    if (tableExists) {
      console.log('📦 [Database Schema] Các bảng cơ sở dữ liệu đã sẵn sàng trên Supabase.');
      await query(`UPDATE devices SET name = 'Kho Lạnh Thông Minh ESP32' WHERE id = 'esp32_c3_cold_01'`);
      return;
    }

    console.log('🚀 [Database Init] Đang tự động tạo bảng cơ sở dữ liệu PostgreSQL cho Supabase...');

    // 2. Tạo bảng Users
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(100),
        role VARCHAR(20) DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Tạo bảng Devices
    await query(`
      CREATE TABLE IF NOT EXISTS devices (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        location VARCHAR(100),
        status VARCHAR(20) DEFAULT 'ONLINE',
        mode VARCHAR(10) DEFAULT 'AUTO',
        fan_status BOOLEAN DEFAULT FALSE,
        temp_threshold_high REAL DEFAULT 26.0,
        temp_threshold_low REAL DEFAULT 20.0,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Tạo bảng Telemetries
    await query(`
      CREATE TABLE IF NOT EXISTS telemetries (
        id BIGSERIAL PRIMARY KEY,
        device_id VARCHAR(50) REFERENCES devices(id) ON DELETE CASCADE,
        temperature REAL NOT NULL,
        humidity REAL NOT NULL,
        fan_status BOOLEAN NOT NULL,
        mode VARCHAR(10) NOT NULL,
        is_alert BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 5. Tạo bảng Commands
    await query(`
      CREATE TABLE IF NOT EXISTS commands (
        id BIGSERIAL PRIMARY KEY,
        device_id VARCHAR(50) REFERENCES devices(id) ON DELETE CASCADE,
        action VARCHAR(50) NOT NULL,
        payload JSONB NOT NULL,
        status VARCHAR(20) DEFAULT 'SENT',
        sent_by VARCHAR(50) DEFAULT 'admin',
        response_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ack_at TIMESTAMP
      );
    `);

    // 6. Tạo Indexes
    await query(`
      CREATE INDEX IF NOT EXISTS idx_telemetries_device_time ON telemetries(device_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_commands_device_time ON commands(device_id, created_at DESC);
    `);

    // 7. Seed tài khoản Admin mặc định: admin / 123456
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('123456', salt);
    await query(`
      INSERT INTO users (username, password_hash, full_name, role)
      VALUES ('admin', $1, 'Quản Trị Viên Hệ Thống', 'admin')
      ON CONFLICT (username) DO NOTHING;
    `, [hash]);

    // 8. Seed thiết bị ESP32 duy nhất
    await query(`
      INSERT INTO devices (id, name, location, status, mode, fan_status, temp_threshold_high, temp_threshold_low)
      VALUES 
        ('esp32_c3_cold_01', 'Kho Lạnh Thông Minh ESP32', 'Phòng Lưu Trữ Y Tế 101', 'ONLINE', 'AUTO', FALSE, 26.0, 20.0)
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
    `);

    console.log('✅ [Database Init] Đã khởi tạo hoàn tất toàn bộ Bảng và Dữ liệu mẫu ban đầu trên Supabase!');
  } catch (err) {
    console.error('❌ [Database Init Error]:', err.message);
  }
};
