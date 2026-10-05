import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  database: process.env.DB_NAME || 'iot_cold_storage',
});

async function main() {
  try {
    // 1. Delete redundant device
    await pool.query("DELETE FROM devices WHERE id != 'esp32_c3_cold_01'");

    // 2. Update clean Vietnamese UTF-8 name and location for single cold storage
    await pool.query(
      "UPDATE devices SET name = $1, location = $2 WHERE id = 'esp32_c3_cold_01'",
      ['Kho Lạnh Thông Minh ESP32-C3', 'Phòng Lưu Trữ Bảo Quản']
    );

    // 3. Update admin user display name
    await pool.query(
      "UPDATE users SET full_name = $1 WHERE username = 'admin'",
      ['Quản Trị Viên']
    );

    console.log('✅ Đã cập nhật thành công: Chỉ giữ lại đúng 1 Kho Lạnh ESP32-C3!');
  } catch (err) {
    console.error('Lỗi cập nhật:', err);
  } finally {
    await pool.end();
  }
}

main();
