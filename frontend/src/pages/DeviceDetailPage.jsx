import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { useSocket } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  Thermometer,
  Droplets,
  Fan,
  Activity,
  Sliders,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Clock,
  Database,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';

// MÀN HÌNH 3: Chi tiết và biểu đồ (Device Details and Charts)
const DeviceDetailPage = () => {
  const { id } = useParams();
  const { socket } = useSocket();
  const { theme } = useTheme();

  const [device, setDevice] = useState(null);
  const [telemetries, setTelemetries] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dataPointsLimit, setDataPointsLimit] = useState(40);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // KỸ THUẬT 1: useEffect gọi API lấy thông tin chi tiết và dữ liệu telemetry
  const loadDeviceData = async () => {
    try {
      setIsRefreshing(true);
      const [devRes, telRes, statsRes] = await Promise.all([
        axiosClient.get(`/devices/${id}`),
        axiosClient.get(`/devices/${id}/telemetry?limit=${dataPointsLimit}`),
        axiosClient.get(`/devices/${id}/telemetry/stats`),
      ]);

      if (devRes.success) setDevice(devRes.data);
      if (telRes.success) setTelemetries(telRes.data);
      if (statsRes.success) setStats(statsRes.stats);
    } catch (err) {
      console.error('[DeviceDetail] Lỗi tải dữ liệu:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadDeviceData();
  }, [id, dataPointsLimit]);

  // Realtime Socket.IO: Nhận telemetry mới và bổ sung ngay vào biểu đồ
  useEffect(() => {
    if (!socket || !id) return;

    socket.emit('join_device', id);

    const handleNewTelemetry = (data) => {
      if (data.deviceId === id || data.device_id === id) {
        const timeStr = new Date(data.created_at || Date.now()).toLocaleTimeString();
        const newPoint = {
          ...data,
          time_str: timeStr,
          temperature: parseFloat(data.temperature),
          humidity: parseFloat(data.humidity),
        };

        setTelemetries((prev) => {
          const updated = [...prev, newPoint];
          if (updated.length > dataPointsLimit) {
            return updated.slice(updated.length - dataPointsLimit);
          }
          return updated;
        });

        // Cập nhật thông tin nhanh trên card
        setDevice((prev) =>
          prev
            ? {
                ...prev,
                latest_temperature: data.temperature,
                latest_humidity: data.humidity,
                fan_status: data.fan_status,
                mode: data.mode,
                realtime_status: 'ONLINE',
              }
            : prev
        );
      }
    };

    socket.on('telemetry_update', handleNewTelemetry);

    return () => {
      socket.emit('leave_device', id);
      socket.off('telemetry_update', handleNewTelemetry);
    };
  }, [socket, id, dataPointsLimit]);

  if (loading) {
    return (
      <div className="page-container loading-state">
        <div className="spinner"></div>
        <p>Đang tải chi tiết thiết bị & vẽ biểu đồ Recharts...</p>
      </div>
    );
  }

  if (!device) {
    return (
      <div className="page-container empty-state">
        <AlertTriangle size={48} color="#EF4444" />
        <h3>Không tìm thấy thiết bị!</h3>
        <p>Thiết bị có mã <strong>{id}</strong> không tồn tại trong hệ thống cơ sở dữ liệu.</p>
        <Link to="/devices" className="btn-primary" style={{ marginTop: '16px' }}>
          Quay lại Danh sách
        </Link>
      </div>
    );
  }

  const latestTemp = device.latest_temperature !== undefined && device.latest_temperature !== null
    ? Number(device.latest_temperature).toFixed(1)
    : '--';
  const latestHum = device.latest_humidity !== undefined && device.latest_humidity !== null
    ? Number(device.latest_humidity).toFixed(1)
    : '--';
  const isOverheat = latestTemp !== '--' && Number(latestTemp) >= (device.temp_threshold_high || 26.0);

  return (
    <div className="page-container">
      {/* Navigation Top Bar */}
      <div className="detail-top-nav">
        <Link to="/devices" className="btn-back">
          <ArrowLeft size={16} />
          <span>Quay lại Danh sách</span>
        </Link>

        <div className="top-nav-right">
          <button onClick={loadDeviceData} className="btn-secondary" title="Làm mới dữ liệu">
            <RefreshCw size={16} className={isRefreshing ? 'spin-anim' : ''} />
            <span>Cập Nhật</span>
          </button>

          <Link to={`/devices/${id}/control`} className="btn-primary">
            <Sliders size={16} />
            <span>Gửi Lệnh Điều Khiển</span>
          </Link>
        </div>
      </div>

      {/* Device Header Info */}
      <div className="device-header-card">
        <div className="header-info-main">
          <div className="badge-row">
            <span className="badge-device-id">{device.id}</span>
            <span className={`status-pill ${device.realtime_status === 'ONLINE' ? 'online' : 'offline'}`}>
              <span className="status-ping"></span>
              {device.realtime_status || 'ONLINE'}
            </span>
            <span className="mode-pill">{device.mode || 'AUTO'}</span>
          </div>
          <h2 className="detail-device-title">{device.name}</h2>
          <p className="detail-device-desc">Vị trí: <strong>{device.location}</strong> | Cảm biến: <strong>DHT11 (GPIO 4)</strong> | Điều khiển: <strong>Relay Quạt (GPIO 5)</strong></p>
        </div>

        <div className="threshold-summary-box">
          <div className="thresh-item">
            <span className="thresh-label">Ngưỡng Kích Quạt (High):</span>
            <span className="thresh-val text-amber">{device.temp_threshold_high}°C</span>
          </div>
          <div className="thresh-item">
            <span className="thresh-label">Ngưỡng Tắt Quạt (Low):</span>
            <span className="thresh-val text-cyan">{device.temp_threshold_low}°C</span>
          </div>
        </div>
      </div>

      {/* 4 Big Live Metric Cards */}
      <div className="metric-cards-row">
        {/* Metric 1: Nhiệt độ */}
        <div className={`detail-metric-card ${isOverheat ? 'card-alert' : ''}`}>
          <div className="card-icon-title">
            <div className="metric-icon-bg temp-bg">
              <Thermometer size={22} color="#F59E0B" />
            </div>
            <div>
              <span className="metric-tag">TELEMETRY 1</span>
              <h4>Nhiệt Độ Tức Thời</h4>
            </div>
          </div>
          <div className="detail-metric-value">
            <span className="val-large">{latestTemp}</span>
            <span className="val-unit">°C</span>
          </div>
          <div className="metric-status-line">
            {isOverheat ? (
              <span className="alert-badge"><AlertTriangle size={14} /> Vượt ngưỡng ({device.temp_threshold_high}°C)</span>
            ) : (
              <span className="safe-badge"><CheckCircle2 size={14} /> Nhiệt độ an toàn</span>
            )}
          </div>
        </div>

        {/* Metric 2: Độ ẩm */}
        <div className="detail-metric-card">
          <div className="card-icon-title">
            <div className="metric-icon-bg hum-bg">
              <Droplets size={22} color="#0EA5E9" />
            </div>
            <div>
              <span className="metric-tag">TELEMETRY 2</span>
              <h4>Độ Ẩm Không Khí</h4>
            </div>
          </div>
          <div className="detail-metric-value">
            <span className="val-large">{latestHum}</span>
            <span className="val-unit">%</span>
          </div>
          <div className="metric-status-line">
            <span className="safe-badge"><CheckCircle2 size={14} /> Mức ẩm tiêu chuẩn</span>
          </div>
        </div>

        {/* Metric 3: Quạt làm mát */}
        <div className="detail-metric-card">
          <div className="card-icon-title">
            <div className="metric-icon-bg fan-bg">
              <Fan size={22} color="#10B981" className={device.fan_status ? 'fan-spinning' : ''} />
            </div>
            <div>
              <span className="metric-tag">RELAY (GPIO 5)</span>
              <h4>Quạt Làm Mát</h4>
            </div>
          </div>
          <div className="detail-metric-value">
            <span className={`val-large ${device.fan_status ? 'text-emerald' : 'text-slate'}`}>
              {device.fan_status ? 'ĐANG BẬT' : 'ĐANG TẮT'}
            </span>
          </div>
          <div className="metric-status-line">
            <span className="info-text">Chế độ: {device.mode}</span>
          </div>
        </div>

        {/* Metric 4: Tình trạng kết nối */}
        <div className="detail-metric-card">
          <div className="card-icon-title">
            <div className="metric-icon-bg iot-bg">
              <Activity size={22} color="#8B5CF6" />
            </div>
            <div>
              <span className="metric-tag">TỔNG MẪU ĐO</span>
              <h4>Dữ Liệu PostgreSQL</h4>
            </div>
          </div>
          <div className="detail-metric-value">
            <span className="val-large">{stats ? stats.total_samples : telemetries.length}</span>
            <span className="val-unit">mẫu</span>
          </div>
          <div className="metric-status-line">
            <span className="info-text"><Database size={12} /> Bảng telemetries</span>
          </div>
        </div>
      </div>

      {/* KỸ THUẬT 4: Recharts vẽ telemetry */}
      <div className="chart-section-card">
        <div className="chart-header">
          <div>
            <div className="chart-badge">KỸ THUẬT 4: RECHARTS VẼ TELEMETRY</div>
            <h3 className="chart-title">Biểu Đồ Xu Hướng Nhiệt Độ & Độ Ẩm Thời Gian Thực</h3>
            <p className="chart-sub">Dữ liệu được cập nhật tự động mỗi 3 giây từ vi điều khiển ESP32-C3 qua MQTT Broker.</p>
          </div>

          <div className="chart-controls">
            <span className="control-label">Số mẫu hiển thị:</span>
            {[20, 40, 80].map((num) => (
              <button
                key={num}
                className={`btn-limit ${dataPointsLimit === num ? 'active' : ''}`}
                onClick={() => setDataPointsLimit(num)}
              >
                {num} điểm
              </button>
            ))}
          </div>
        </div>

        <div className="recharts-wrapper-container" style={{ width: '100%', height: 380 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={telemetries}
              margin={{ top: 15, right: 30, left: 10, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#1E293B' : '#E2E8F0'} />
              <XAxis
                dataKey="time_str"
                stroke={theme === 'dark' ? '#64748B' : '#475569'}
                fontSize={12}
                tickLine={false}
              />
              {/* Trục Y bên trái: Nhiệt độ (°C) */}
              <YAxis
                yAxisId="left"
                stroke="#F59E0B"
                fontSize={12}
                domain={['auto', 'auto']}
                unit="°C"
                tickLine={false}
              />
              {/* Trục Y bên phải: Độ ẩm (%) */}
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#0EA5E9"
                fontSize={12}
                domain={[30, 100]}
                unit="%"
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: theme === 'dark' ? '#0F172A' : '#FFFFFF',
                  borderColor: theme === 'dark' ? '#334155' : '#CBD5E1',
                  borderRadius: '8px',
                  boxShadow: theme === 'dark' ? '0 10px 25px -5px rgba(0, 0, 0, 0.5)' : '0 4px 12px rgba(0, 0, 0, 0.08)',
                  color: theme === 'dark' ? '#F8FAFC' : '#0F172A',
                }}
              />
              <Legend verticalAlign="top" height={36} />

              {/* Đường Ngưỡng Nhiệt Độ Cao (Bật Quạt) */}
              <ReferenceLine
                yAxisId="left"
                y={device.temp_threshold_high || 26.0}
                label={{
                  value: `Ngưỡng quạt (${device.temp_threshold_high}°C)`,
                  fill: '#EF4444',
                  fontSize: 12,
                  position: 'top',
                }}
                stroke="#EF4444"
                strokeDasharray="4 4"
                strokeWidth={2}
              />

              {/* Đường biểu diễn Nhiệt Độ */}
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="temperature"
                name="Nhiệt Độ (°C)"
                stroke="#F59E0B"
                strokeWidth={3}
                dot={{ r: 3, fill: '#F59E0B' }}
                activeDot={{ r: 6 }}
                isAnimationActive={false}
              />

              {/* Đường biểu diễn Độ Ẩm */}
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="humidity"
                name="Độ Ẩm (%)"
                stroke="#0EA5E9"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ r: 2, fill: '#0EA5E9' }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Statistical Summary Row */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-label">Nhiệt độ Thấp nhất (24h)</span>
            <strong className="stat-val text-cyan">{stats.min_temp !== null ? `${stats.min_temp}°C` : '--'}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Nhiệt độ Trung bình (24h)</span>
            <strong className="stat-val text-amber">{stats.avg_temp !== null ? `${stats.avg_temp}°C` : '--'}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Nhiệt độ Cao nhất (24h)</span>
            <strong className="stat-val text-rose">{stats.max_temp !== null ? `${stats.max_temp}°C` : '--'}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Độ ẩm Trung bình (24h)</span>
            <strong className="stat-val text-sky">{stats.avg_hum !== null ? `${stats.avg_hum}%` : '--'}</strong>
          </div>
        </div>
      )}

      {/* Telemetry Recent History Table */}
      <div className="table-card">
        <div className="table-header">
          <div>
            <h3 className="table-title">Lịch Sử Mẫu Đo Gần Nhất</h3>
            <span className="table-sub">Ghi nhận liên tục vào cơ sở dữ liệu PostgreSQL</span>
          </div>
          <span className="pill-badge">{telemetries.length} bản ghi</span>
        </div>

        <div className="table-wrapper">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Thời Gian</th>
                <th>Nhiệt Độ (°C)</th>
                <th>Độ Ẩm (%)</th>
                <th>Trạng Thái Quạt</th>
                <th>Chế Độ</th>
                <th>Cảnh Báo Quá Nhiệt</th>
              </tr>
            </thead>
            <tbody>
              {telemetries.slice(-10).reverse().map((t, idx) => (
                <tr key={t.id || idx}>
                  <td>
                    <div className="cell-time">
                      <Clock size={14} />
                      <span>{t.time_str || new Date(t.created_at).toLocaleTimeString()}</span>
                    </div>
                  </td>
                  <td>
                    <span className="temp-badge">{Number(t.temperature).toFixed(1)} °C</span>
                  </td>
                  <td>
                    <span className="hum-badge">{Number(t.humidity).toFixed(1)} %</span>
                  </td>
                  <td>
                    <span className={`fan-pill ${t.fan_status ? 'active' : 'inactive'}`}>
                      {t.fan_status ? 'Đang Chạy' : 'Tắt'}
                    </span>
                  </td>
                  <td>
                    <span className="mode-pill-small">{t.mode}</span>
                  </td>
                  <td>
                    {t.is_alert || Number(t.temperature) >= (device.temp_threshold_high || 26.0) ? (
                      <span className="alert-flag"><AlertTriangle size={14} /> Quá ngưỡng</span>
                    ) : (
                      <span className="safe-flag"><CheckCircle2 size={14} /> Bình thường</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DeviceDetailPage;
