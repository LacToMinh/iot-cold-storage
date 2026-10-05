import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { useSocket } from '../context/SocketContext';
import { 
  Server, 
  Thermometer, 
  Droplets, 
  Fan, 
  Activity, 
  Sliders, 
  LineChart, 
  MapPin, 
  RefreshCw, 
  Search,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  X,
  Cpu,
  ShieldAlert,
  Radio
} from 'lucide-react';

// MÀN HÌNH 2: Danh sách toàn bộ thiết bị kho lạnh (Device List)
const DeviceListPage = () => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // State Modal Thêm Thiết Bị Mới
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [newDevice, setNewDevice] = useState({
    id: '',
    name: '',
    location: '',
    temp_threshold_high: 26.0,
    temp_threshold_low: 20.0,
    mode: 'AUTO',
  });

  const { socket } = useSocket();

  // KỸ THUẬT 1: useEffect gọi API lấy danh sách toàn bộ thiết bị
  const fetchDevices = async () => {
    try {
      setIsRefreshing(true);
      const res = await axiosClient.get('/devices');
      if (res.success && Array.isArray(res.data)) {
        setDevices(res.data);
      }
    } catch (err) {
      console.error('[DeviceList] Lỗi nạp thiết bị:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  // Lắng nghe cập nhật realtime qua Socket.IO
  useEffect(() => {
    if (!socket) return;

    // Cập nhật khi có telemetry mới
    const handleTelemetry = (data) => {
      setDevices((prevDevices) =>
        prevDevices.map((dev) => {
          if (dev.id === data.deviceId) {
            return {
              ...dev,
              latest_temperature: data.temperature,
              latest_humidity: data.humidity,
              fan_status: data.fan_status,
              mode: data.mode,
              realtime_status: 'ONLINE',
              last_seen: new Date().toISOString(),
            };
          }
          return dev;
        })
      );
    };

    // Cập nhật khi thiết bị đổi trạng thái
    const handleDeviceStatus = (updatedDevice) => {
      setDevices((prevDevices) => {
        const exists = prevDevices.some((d) => d.id === updatedDevice.id);
        if (exists) {
          return prevDevices.map((d) => (d.id === updatedDevice.id ? { ...d, ...updatedDevice } : d));
        }
        return [...prevDevices, updatedDevice];
      });
    };

    socket.on('telemetry_update', handleTelemetry);
    socket.on('device_status_update', handleDeviceStatus);

    return () => {
      socket.off('telemetry_update', handleTelemetry);
      socket.off('device_status_update', handleDeviceStatus);
    };
  }, [socket]);

  // Xử lý tạo mới thiết bị
  const handleCreateDevice = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!newDevice.id.trim() || !newDevice.name.trim()) {
      setFormError('Vui lòng nhập đầy đủ Mã thiết bị và Tên kho lạnh!');
      return;
    }

    try {
      setCreating(true);
      const res = await axiosClient.post('/devices', {
        id: newDevice.id.trim(),
        name: newDevice.name.trim(),
        location: newDevice.location.trim() || 'Khu Vực Bảo Quản',
        temp_threshold_high: parseFloat(newDevice.temp_threshold_high) || 26.0,
        temp_threshold_low: parseFloat(newDevice.temp_threshold_low) || 20.0,
        mode: newDevice.mode || 'AUTO',
      });

      if (res.success) {
        setIsModalOpen(false);
        setNewDevice({
          id: '',
          name: '',
          location: '',
          temp_threshold_high: 26.0,
          temp_threshold_low: 20.0,
          mode: 'AUTO',
        });
        await fetchDevices();
      }
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || 'Lỗi khi thêm thiết bị mới');
    } finally {
      setCreating(false);
    }
  };

  // Xử lý xóa thiết bị
  const handleDeleteDevice = async (deviceId, deviceName) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa trạm giám sát [${deviceName}] (${deviceId}) khỏi hệ thống?`)) {
      try {
        await axiosClient.delete(`/devices/${deviceId}`);
        setDevices((prev) => prev.filter((d) => d.id !== deviceId));
      } catch (err) {
        alert(`Lỗi khi xóa thiết bị: ${err.message}`);
      }
    }
  };

  // Bộ lọc tìm kiếm
  const filteredDevices = devices.filter(
    (dev) =>
      dev.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dev.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (dev.location && dev.location.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Thống kê nhanh
  const onlineCount = devices.filter((d) => d.realtime_status === 'ONLINE' || d.status === 'ONLINE').length;
  const alertCount = devices.filter((d) => {
    const temp = d.latest_temperature;
    return temp !== null && temp !== undefined && Number(temp) >= (d.temp_threshold_high || 26.0);
  }).length;

  return (
    <div className="page-container">
      {/* Header section */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Danh Sách Toàn Bộ Thiết Bị Giám Sát</h2>
          <p className="page-subtitle">
            Hệ thống quản lý vi khí hậu thời gian thực các kho lạnh và tủ thuốc y tế.
          </p>
        </div>

        <div className="header-actions">
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn-primary"
            title="Thêm trạm giám sát kho lạnh mới"
          >
            <Plus size={16} />
            <span>Thêm Thiết Bị</span>
          </button>

          <button
            onClick={fetchDevices}
            className={`btn-secondary ${isRefreshing ? 'loading' : ''}`}
            title="Tải lại danh sách thiết bị"
          >
            <RefreshCw size={16} className={isRefreshing ? 'spin-anim' : ''} />
            <span>Làm Mới</span>
          </button>
        </div>
      </div>

      {/* Stats Overview Chips */}
      <div className="stats-overview-row">
        <div className="stat-chip">
          <div className="stat-chip-icon blue">
            <Server size={22} />
          </div>
          <div className="stat-chip-info">
            <span className="stat-chip-label">Tổng Thiết Bị</span>
            <span className="stat-chip-value">{devices.length} Kho / Tủ</span>
          </div>
        </div>

        <div className="stat-chip">
          <div className="stat-chip-icon emerald">
            <Radio size={22} />
          </div>
          <div className="stat-chip-info">
            <span className="stat-chip-label">Đang Trực Tuyến</span>
            <span className="stat-chip-value" style={{ color: 'var(--accent-emerald)' }}>
              {onlineCount} / {devices.length} ONLINE
            </span>
          </div>
        </div>

        <div className="stat-chip">
          <div className="stat-chip-icon rose">
            <ShieldAlert size={22} />
          </div>
          <div className="stat-chip-info">
            <span className="stat-chip-label">Cảnh Báo Quá Nhiệt</span>
            <span className="stat-chip-value" style={{ color: alertCount > 0 ? 'var(--accent-rose)' : 'var(--text-heading)' }}>
              {alertCount} Cảnh Báo
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="search-filter-bar">
        <div className="search-input-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Tìm theo tên kho, mã thiết bị (ESP32), vị trí phòng..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="device-count-pill">
          <span>Hiển thị: <strong>{filteredDevices.length}</strong> / {devices.length} thiết bị</span>
        </div>
      </div>

      {/* Device Cards Grid */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Đang tải dữ liệu toàn bộ thiết bị từ PostgreSQL...</p>
        </div>
      ) : filteredDevices.length === 0 ? (
        <div className="empty-state">
          <Server size={48} color="#64748B" />
          <h3>Không tìm thấy thiết bị nào</h3>
          <p>Không có trạm giám sát nào khớp với từ khóa tìm kiếm của bạn.</p>
        </div>
      ) : (
        <div className="device-grid">
          {filteredDevices.map((device) => {
            const isOnline = device.realtime_status === 'ONLINE' || device.status === 'ONLINE';
            const temp = device.latest_temperature !== null && device.latest_temperature !== undefined 
              ? Number(device.latest_temperature).toFixed(1) 
              : '--';
            const hum = device.latest_humidity !== null && device.latest_humidity !== undefined 
              ? Number(device.latest_humidity).toFixed(1) 
              : '--';
            const isOverheat = temp !== '--' && Number(temp) >= (device.temp_threshold_high || 26.0);
            const isHardwareNode = device.id === 'esp32_c3_cold_01';

            return (
              <div key={device.id} className={`device-card ${isOverheat ? 'card-alert' : ''}`}>
                {/* Card Top: Status & Mode */}
                <div className="card-top">
                  <div className="device-identity">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span className="device-id-tag">{device.id}</span>
                      {isHardwareNode && (
                        <span className="hardware-badge" title="Thiết bị phần cứng ESP32-C3 thực tế đang chạy">
                          ⚡ Hardware ESP32
                        </span>
                      )}
                    </div>
                    <h3 className="device-name">{device.name}</h3>
                    <div className="device-location">
                      <MapPin size={14} />
                      <span>{device.location || 'Chưa cài đặt'}</span>
                    </div>
                  </div>

                  <div className="card-status-badges">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className={`status-pill ${isOnline ? 'online' : 'offline'}`}>
                        <span className="status-ping"></span>
                        {isOnline ? 'ONLINE' : 'OFFLINE'}
                      </span>
                      {!isHardwareNode && (
                        <button
                          onClick={() => handleDeleteDevice(device.id, device.name)}
                          className="btn-card-delete"
                          title="Xóa trạm giám sát này"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                    <span className="mode-pill">{device.mode || 'AUTO'}</span>
                  </div>
                </div>

                {/* Card Middle: Telemetry Values */}
                <div className="telemetry-readings">
                  {/* Temperature */}
                  <div className={`metric-box ${isOverheat ? 'warning' : 'cool'}`}>
                    <div className="metric-header">
                      <Thermometer size={16} />
                      <span>Nhiệt Độ</span>
                    </div>
                    <div className="metric-value-row">
                      <span className="metric-number">{temp}</span>
                      <span className="metric-unit">°C</span>
                    </div>
                    <div className="metric-footer">
                      {isOverheat ? (
                        <span className="alert-text">
                          <AlertTriangle size={12} /> Quá ngưỡng ({device.temp_threshold_high}°C)
                        </span>
                      ) : (
                        <span className="normal-text">
                          <CheckCircle2 size={12} /> Ngưỡng: &lt;={device.temp_threshold_high}°C
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Humidity */}
                  <div className="metric-box humidity-box">
                    <div className="metric-header">
                      <Droplets size={16} />
                      <span>Độ Ẩm</span>
                    </div>
                    <div className="metric-value-row">
                      <span className="metric-number">{hum}</span>
                      <span className="metric-unit">%</span>
                    </div>
                    <div className="metric-footer">
                      <span className="hum-info">Khoảng tối ưu 40-70%</span>
                    </div>
                  </div>
                </div>

                {/* Card Bottom: Fan State & Action Buttons */}
                <div className="card-bottom">
                  <div className="fan-status-indicator">
                    <Fan
                      size={20}
                      className={`fan-icon ${device.fan_status ? 'fan-spinning active' : 'inactive'}`}
                    />
                    <div className="fan-text">
                      <span className="fan-label">Quạt làm mát:</span>
                      <strong className={device.fan_status ? 'text-emerald' : 'text-slate'}>
                        {device.fan_status ? 'ĐANG CHẠY' : 'ĐANG TẮT'}
                      </strong>
                    </div>
                  </div>

                  <div className="action-buttons-group">
                    <Link
                      to={`/devices/${device.id}`}
                      className="btn-card-action btn-chart"
                      title="Xem chi tiết và biểu đồ Recharts"
                    >
                      <LineChart size={16} />
                      <span>Chi Tiết & Biểu Đồ</span>
                    </Link>

                    <Link
                      to={`/devices/${device.id}/control`}
                      className="btn-card-action btn-control"
                      title="Gửi lệnh điều khiển thiết bị"
                    >
                      <Sliders size={16} />
                      <span>Điều Khiển</span>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL THÊM THIẾT BỊ MỚI */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                <Cpu size={20} color="var(--accent-cyan)" />
                <span>Thêm Trạm Giám Sát Kho Lạnh Mới</span>
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="modal-close-btn">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateDevice}>
              <div className="modal-body">
                {formError && (
                  <div className="control-status-banner error" style={{ padding: '8px 12px' }}>
                    <AlertTriangle size={16} />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Mã Thiết Bị (ID Duy Nhất) *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="VD: esp32_c3_cold_02 hoặc cold_room_storage_05"
                    value={newDevice.id}
                    onChange={(e) => setNewDevice({ ...newDevice, id: e.target.value })}
                    required
                  />
                  <small style={{ color: 'var(--text-dim)', fontSize: '11px' }}>
                    Mã thiết bị dùng để định danh thiết bị trên MQTT Topic.
                  </small>
                </div>

                <div className="form-group">
                  <label className="form-label">Tên Kho Lạnh / Tủ Thuốc *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="VD: Kho Lạnh Vắc-xin Phòng Khám 2"
                    value={newDevice.name}
                    onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Vị Trí Lắp Đặt</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="VD: Tầng 2 - Phòng Xét Nghiệm Hóa Sinh"
                    value={newDevice.location}
                    onChange={(e) => setNewDevice({ ...newDevice, location: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Ngưỡng Bật Quạt (°C)</label>
                    <input
                      type="number"
                      step="0.5"
                      className="form-input"
                      value={newDevice.temp_threshold_high}
                      onChange={(e) => setNewDevice({ ...newDevice, temp_threshold_high: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Ngưỡng Tắt Quạt (°C)</label>
                    <input
                      type="number"
                      step="0.5"
                      className="form-input"
                      value={newDevice.temp_threshold_low}
                      onChange={(e) => setNewDevice({ ...newDevice, temp_threshold_low: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Chế Độ Khởi Tạo</label>
                  <select
                    className="form-input"
                    value={newDevice.mode}
                    onChange={(e) => setNewDevice({ ...newDevice, mode: e.target.value })}
                  >
                    <option value="AUTO">Tự Động (AUTO - Quạt kích theo nhiệt độ)</option>
                    <option value="MANUAL">Thủ Công (MANUAL - Điều khiển bằng tay)</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary"
                  disabled={creating}
                >
                  Hủy Bỏ
                </button>
                <button type="submit" className="btn-primary" disabled={creating}>
                  {creating ? 'Đang Lưu...' : 'Thêm Thiết Bị'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeviceListPage;
