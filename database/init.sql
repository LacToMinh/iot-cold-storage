-- Schema for IoT Cold Storage & Medicine Cabinet Monitoring System
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    role VARCHAR(20) DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

-- Indexing for fast telemetry queries
CREATE INDEX IF NOT EXISTS idx_telemetries_device_time ON telemetries(device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_commands_device_time ON commands(device_id, created_at DESC);

-- Seed Initial Data
-- Default user: admin / 123456 (bcrypt hashed: $2a$10$wEkgzW4q6yvS4nZ5h6H/NuAknq4cKzF9Z1h.v1jZ6s1w7j2h9F/8S or will be salted in backend)
INSERT INTO users (username, password_hash, full_name, role)
VALUES ('admin', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Quản Trị Viên Hệ Thống', 'admin')
ON CONFLICT (username) DO NOTHING;
-- Note: bcrypt of 'password' or '123456' will be guaranteed in the auth controller!

-- Seed Devices
INSERT INTO devices (id, name, location, status, mode, fan_status, temp_threshold_high, temp_threshold_low)
VALUES 
    ('esp32_c3_cold_01', 'Tủ Thuốc & Vắc-xin ESP32-C3 Node', 'Phòng Lưu Trữ Y Tế 101', 'ONLINE', 'AUTO', FALSE, 26.0, 20.0),
    ('cold_room_storage_02', 'Kho Lạnh Dược Phẩm Trung Tâm B', 'Tầng 1 - Khu Bảo Quản Lạnh', 'ONLINE', 'AUTO', TRUE, 8.0, 2.0)
ON CONFLICT (id) DO NOTHING;

-- Seed Sample Telemetries for demo charts
INSERT INTO telemetries (device_id, temperature, humidity, fan_status, mode, is_alert, created_at)
SELECT 
    'esp32_c3_cold_01',
    23.5 + (random() * 4.0),
    60.0 + (random() * 10.0),
    (random() > 0.6),
    'AUTO',
    FALSE,
    NOW() - (i || ' minutes')::INTERVAL
FROM generate_series(60, 1, -2) AS i;
