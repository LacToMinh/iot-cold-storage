import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { useSocket } from '../context/SocketContext';
import {
  Sliders,
  Fan,
  Power,
  Cpu,
  ArrowLeft,
  Send,
  Clock,
  CheckCircle,
  AlertCircle,
  Settings,
  RefreshCw,
  Terminal,
  Zap,
} from 'lucide-react';

// MÀN HÌNH 4: Gửi lệnh điều khiển (Send Control Command)
const ControlPage = () => {
  const { id } = useParams();
  const { socket } = useSocket();

  const [device, setDevice] = useState(null);
  const [commands, setCommands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [bannerMessage, setBannerMessage] = useState(null);

  // Form states for threshold configuration
  const [highThreshold, setHighThreshold] = useState(26.0);
  const [lowThreshold, setLowThreshold] = useState(21.0);

  // KỸ THUẬT 1: useEffect gọi API lấy trạng thái thiết bị và danh sách lệnh đã gửi
  const loadDeviceAndCommands = async () => {
    try {
      const [devRes, cmdRes] = await Promise.all([
        axiosClient.get(`/devices/${id}`),
        axiosClient.get(`/devices/${id}/commands?limit=25`),
      ]);

      if (devRes.success) {
        setDevice(devRes.data);
        setHighThreshold(devRes.data.temp_threshold_high || 26.0);
        setLowThreshold(devRes.data.temp_threshold_low || 21.0);
      }

      if (cmdRes.success) {
        setCommands(cmdRes.data);
      }
    } catch (err) {
      console.error('[ControlPage] Lỗi tải thông tin:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeviceAndCommands();
  }, [id]);

  // Lắng nghe phản hồi lệnh (ACK) realtime qua Socket.IO
  useEffect(() => {
    if (!socket || !id) return;

    const handleCommandUpdate = (updatedCmd) => {
      if (updatedCmd.device_id === id) {
        setCommands((prev) => {
          const exists = prev.some((c) => c.id === updatedCmd.id);
          if (exists) {
            return prev.map((c) => (c.id === updatedCmd.id ? { ...c, ...updatedCmd } : c));
          }
          return [updatedCmd, ...prev];
        });

        // Cập nhật banner thông báo
        if (updatedCmd.status === 'ACK') {
          setBannerMessage({
            type: 'success',
            text: `Thiết bị đã phản hồi ACK cho lệnh #${updatedCmd.id} [${updatedCmd.action}]: "${updatedCmd.response_message || 'Thành công'}"`,
          });
        }
      }
    };

    const handleDeviceUpdate = (updatedDev) => {
      if (updatedDev.id === id) {
        setDevice((prev) => ({ ...prev, ...updatedDev }));
      }
    };

    socket.on('command_status_update', handleCommandUpdate);
    socket.on('device_status_update', handleDeviceUpdate);

    return () => {
      socket.off('command_status_update', handleCommandUpdate);
      socket.off('device_status_update', handleDeviceUpdate);
    };
  }, [socket, id]);

  // Hàm phát lệnh điều khiển qua Backend & MQTT
  const handleSendCommand = async (action, payload) => {
    try {
      setSending(true);
      setBannerMessage(null);

      // KỸ THUẬT 2: axiosClient gắn JWT tự động trong request
      const res = await axiosClient.post(`/devices/${id}/commands`, {
        action,
        payload,
      });

      if (res.success) {
        setBannerMessage({
          type: 'info',
          text: `Đã gửi lệnh [${action}] qua MQTT Broker. Đang chờ thiết bị phản hồi ACK...`,
        });
        // Tải lại danh sách lệnh để hiển thị ngay
        const cmdRes = await axiosClient.get(`/devices/${id}/commands?limit=25`);
        if (cmdRes.success) setCommands(cmdRes.data);
      }
    } catch (err) {
      setBannerMessage({
        type: 'error',
        text: `Lỗi gửi lệnh: ${err.message || 'Không thể kết nối đến máy chủ'}`,
      });
    } finally {
      setSending(false);
    }
  };

  // 1. Chuyển đổi chế độ Auto / Manual
  const handleToggleMode = (newMode) => {
    handleSendCommand('SET_MODE', { mode: newMode });
  };

  // 2. Bật / Tắt Quạt tản nhiệt
  const handleToggleFan = (targetState) => {
    handleSendCommand('SET_FAN', { fan: targetState });
  };

  // 3. Cập nhật Ngưỡng nhiệt độ
  const handleSaveThresholds = (e) => {
    e.preventDefault();
    handleSendCommand('SET_THRESHOLD', {
      high: parseFloat(highThreshold),
      low: parseFloat(lowThreshold),
    });
  };

  if (loading) {
    return (
      <div className="page-container loading-state">
        <div className="spinner"></div>
        <p>Đang tải trung tâm điều khiển thiết bị...</p>
      </div>
    );
  }

  if (!device) {
    return (
      <div className="page-container empty-state">
        <h3>Không tìm thấy thiết bị!</h3>
        <Link to="/devices" className="btn-primary">Quay lại</Link>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Top Nav */}
      <div className="detail-top-nav">
        <Link to={`/devices/${id}`} className="btn-back">
          <ArrowLeft size={16} />
          <span>Xem Chi Tiết & Biểu Đồ</span>
        </Link>

        <div className="top-nav-right">
          <button onClick={loadDeviceAndCommands} className="btn-secondary" title="Làm mới lịch sử lệnh">
            <RefreshCw size={16} />
            <span>Làm Mới</span>
          </button>
        </div>
      </div>

      {/* Header Info */}
      <div className="control-header-box">
        <div className="header-info-main">
          <span className="badge-device-id">{device.id}</span>
          <h2 className="detail-device-title">Trung Tâm Gửi Lệnh Điều Khiển</h2>
          <p className="detail-device-desc">
            Phát lệnh điều khiển trực tiếp tới vi điều khiển ESP32-C3 qua giao thức MQTT QoS 1.
          </p>
        </div>

        <div className="current-state-pill-group">
          <div className="current-state-item">
            <span>Chế Độ Hiện Tại:</span>
            <strong className="text-emerald">{device.mode || 'AUTO'}</strong>
          </div>
          <div className="current-state-item">
            <span>Trạng Thái Quạt:</span>
            <strong className={device.fan_status ? 'text-cyan' : 'text-slate'}>
              {device.fan_status ? 'BẬT (ON)' : 'TẮT (OFF)'}
            </strong>
          </div>
        </div>
      </div>

      {/* Banner thông báo trạng thái lệnh */}
      {bannerMessage && (
        <div className={`control-status-banner ${bannerMessage.type}`}>
          {bannerMessage.type === 'success' && <CheckCircle size={20} />}
          {bannerMessage.type === 'info' && <Zap size={20} />}
          {bannerMessage.type === 'error' && <AlertCircle size={20} />}
          <span>{bannerMessage.text}</span>
        </div>
      )}

      {/* Grid các khối điều khiển thiết bị */}
      <div className="control-cards-grid">
        {/* Khối 1: Chọn Chế Độ AUTO / MANUAL */}
        <div className="control-card">
          <div className="control-card-header">
            <Cpu size={20} color="#38BDF8" />
            <div>
              <h3>1. Chế Độ Vận Hành (Mode)</h3>
              <p>AUTO: Tự động kích quạt theo nhiệt độ. MANUAL: Điều khiển thủ công.</p>
            </div>
          </div>

          <div className="mode-toggle-group">
            <button
              className={`btn-mode-toggle ${device.mode === 'AUTO' ? 'active auto' : ''}`}
              onClick={() => handleToggleMode('AUTO')}
              disabled={sending}
            >
              <Zap size={18} />
              <div>
                <strong>Chế Độ TỰ ĐỘNG (AUTO)</strong>
                <span>Kích quạt khi &gt;= {device.temp_threshold_high}°C</span>
              </div>
            </button>

            <button
              className={`btn-mode-toggle ${device.mode === 'MANUAL' ? 'active manual' : ''}`}
              onClick={() => handleToggleMode('MANUAL')}
              disabled={sending}
            >
              <Sliders size={18} />
              <div>
                <strong>Chế Độ THỦ CÔNG (MANUAL)</strong>
                <span>Cho phép người quản trị bật/tắt quạt theo ý muốn</span>
              </div>
            </button>
          </div>
        </div>

        {/* Khối 2: Điều khiển Quạt Làm Mát (Relay GPIO 5) */}
        <div className="control-card">
          <div className="control-card-header">
            <Fan size={20} color="#10B981" />
            <div>
              <h3>2. Điều Khiển Quạt Làm Mát (Relay GPIO 5)</h3>
              <p>Đóng ngắt tiếp điểm Relay cấp điện cho quạt tản nhiệt 12V/5V.</p>
            </div>
          </div>

          <div className="fan-buttons-row">
            <button
              className={`btn-fan-action btn-fan-on ${device.fan_status ? 'running' : ''}`}
              onClick={() => handleToggleFan(true)}
              disabled={sending}
            >
              <Power size={20} />
              <span>BẬT QUẠT (ON)</span>
            </button>

            <button
              className={`btn-fan-action btn-fan-off ${!device.fan_status ? 'stopped' : ''}`}
              onClick={() => handleToggleFan(false)}
              disabled={sending}
            >
              <Power size={20} />
              <span>TẮT QUẠT (OFF)</span>
            </button>
          </div>

          {device.mode === 'AUTO' && (
            <div className="auto-warning-note">
              <AlertCircle size={14} />
              <span>Lưu ý: Thiết bị đang ở chế độ AUTO. Nếu muốn giữ quạt luôn chạy hoặc tắt hẳn, vui lòng chuyển sang MANUAL.</span>
            </div>
          )}
        </div>

        {/* Khối 3: Cài Đặt Ngưỡng Nhiệt Độ */}
        <div className="control-card full-width">
          <div className="control-card-header">
            <Settings size={20} color="#F59E0B" />
            <div>
              <h3>3. Cài Đặt Ngưỡng Nhiệt Độ Làm Mát (Threshold Settings)</h3>
              <p>Thiết lập ngưỡng nhiệt độ để hệ thống tự động kích hoạt quạt khi quá nhiệt và tự ngắt khi làm mát xong.</p>
            </div>
          </div>

          <form onSubmit={handleSaveThresholds} className="threshold-form">
            <div className="threshold-inputs-row">
              <div className="thresh-field">
                <label>Ngưỡng Bật Quạt (High Threshold):</label>
                <div className="input-with-unit">
                  <input
                    type="number"
                    step="0.5"
                    value={highThreshold}
                    onChange={(e) => setHighThreshold(e.target.value)}
                    required
                  />
                  <span>°C</span>
                </div>
                <small className="field-hint">Khi nhiệt độ &gt;= mức này, quạt sẽ tự động bật và LED 2 báo quá nhiệt sáng.</small>
              </div>

              <div className="thresh-field">
                <label>Ngưỡng Tắt Quạt (Low Threshold):</label>
                <div className="input-with-unit">
                  <input
                    type="number"
                    step="0.5"
                    value={lowThreshold}
                    onChange={(e) => setLowThreshold(e.target.value)}
                    required
                  />
                  <span>°C</span>
                </div>
                <small className="field-hint">Khi làm mát đạt &lt;= mức này, quạt sẽ tự ngắt tiết kiệm năng lượng.</small>
              </div>
            </div>

            <button type="submit" className="btn-primary btn-save-thresh" disabled={sending}>
              <Send size={16} />
              <span>Phát Lệnh Cập Nhật Ngưỡng (SET_THRESHOLD)</span>
            </button>
          </form>
        </div>
      </div>

      {/* Lịch Sử Lệnh Đã Gửi (Command History Table) */}
      <div className="table-card" style={{ marginTop: '24px' }}>
        <div className="table-header">
          <div>
            <div className="table-badge"><Terminal size={14} /> LOG MQTT COMMANDS</div>
            <h3 className="table-title">Lịch Sử Các Lệnh Điều Khiển Đã Phát</h3>
            <span className="table-sub">Theo dõi trạng thái gửi lệnh (SENT) và phản hồi xác nhận từ thiết bị (ACK)</span>
          </div>
          <span className="pill-badge">{commands.length} lệnh</span>
        </div>

        <div className="table-wrapper">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Mã Lệnh</th>
                <th>Hành Động (Action)</th>
                <th>Dữ Liệu Lệnh (Payload)</th>
                <th>Người Phát Lệnh</th>
                <th>Thời Gian Gửi</th>
                <th>Trạng Thái</th>
                <th>Phản Hồi Từ Thiết Bị (ACK)</th>
              </tr>
            </thead>
            <tbody>
              {commands.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: '#64748B' }}>
                    Chưa có lệnh nào được phát tới thiết bị này.
                  </td>
                </tr>
              ) : (
                commands.map((cmd) => (
                  <tr key={cmd.id}>
                    <td>
                      <span className="cmd-id-badge">#{cmd.id}</span>
                    </td>
                    <td>
                      <span className="action-tag">{cmd.action}</span>
                    </td>
                    <td>
                      <code className="payload-code">{JSON.stringify(cmd.payload)}</code>
                    </td>
                    <td>
                      <span className="user-tag">{cmd.sent_by || 'admin'}</span>
                    </td>
                    <td>
                      <div className="cell-time">
                        <Clock size={14} />
                        <span>{new Date(cmd.created_at).toLocaleTimeString()}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`status-cmd-pill ${cmd.status.toLowerCase()}`}>
                        {cmd.status === 'ACK' ? 'ĐÃ NHẬN (ACK)' : 'ĐÃ GỬI (SENT)'}
                      </span>
                    </td>
                    <td>
                      <span className="response-text">{cmd.response_message || 'Đang chờ phản hồi...'}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ControlPage;
