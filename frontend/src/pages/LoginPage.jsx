import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ThermometerSnowflake, Shield, Lock, User, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

// MÀN HÌNH 1: Đăng nhập (Login)
const LoginPage = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('123456');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Nếu đã đăng nhập thì tự động chuyển hướng vào danh sách thiết bị
  if (isAuthenticated) {
    return <Navigate to="/devices" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    const result = await login(username, password);
    setLoading(false);

    if (result.success) {
      navigate('/devices');
    } else {
      setErrorMessage(result.message || 'Sai tên đăng nhập hoặc mật khẩu!');
    }
  };

  const handleQuickFill = (u, p) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div className="login-page-wrapper">
      <div className="login-card-container">
        {/* Header Logo */}
        <div className="login-header">
          <div className="login-logo-glow">
            <ThermometerSnowflake size={36} color="#38BDF8" />
          </div>
          <h2 className="login-title">HỆ THỐNG KHO LẠNH & TỦ THUỐC IoT</h2>
          <p className="login-description">
            Đăng nhập tài khoản Quản trị để theo dõi nhiệt độ, độ ẩm và gửi lệnh điều khiển vi điều khiển ESP32-C3.
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="alert-error">
            <AlertCircle size={18} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="form-label">Tên Đăng Nhập</label>
            <div className="input-group">
              <User className="input-icon" size={18} />
              <input
                type="text"
                className="form-input"
                placeholder="Nhập username (vd: admin)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Mật Khẩu</label>
            <div className="input-group">
              <Lock className="input-icon" size={18} />
              <input
                type="password"
                className="form-input"
                placeholder="Nhập mật khẩu"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn-primary btn-submit" disabled={loading}>
            {loading ? (
              <>
                <div className="btn-spinner"></div>
                <span>Đang xác thực JWT...</span>
              </>
            ) : (
              <>
                <span>Đăng Nhập Hệ Thống</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Quick Test Demo Account box */}
        <div className="quick-demo-box">
          <div className="quick-demo-title">
            <CheckCircle2 size={16} color="#10B981" />
            <span>Tài khoản kiểm thử demo có sẵn:</span>
          </div>
          <div className="quick-demo-buttons">
            <button
              type="button"
              className="btn-demo-badge"
              onClick={() => handleQuickFill('admin', '123456')}
            >
              admin / 123456
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="login-footer">
          <span>ESP32-C3 • PostgreSQL • MQTT Broker • React Dashboard</span>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
