import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';
import { ThermometerSnowflake, Server, LogOut, ShieldCheck, Activity, Sun, Moon } from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="navbar-container">
      <div className="navbar-content">
        {/* Brand / Logo */}
        <Link to="/devices" className="navbar-brand">
          <div className="brand-icon-wrapper">
            <ThermometerSnowflake className="brand-icon" size={24} />
          </div>
          <div>
            <h1 className="brand-title">COLD-GUARD IoT</h1>
            <span className="brand-subtitle">Hệ thống Giám sát & Điều khiển Kho Lạnh</span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="navbar-links">
          <Link
            to="/devices"
            className={`nav-item ${location.pathname.startsWith('/devices') ? 'active' : ''}`}
          >
            <Server size={18} />
            <span>Danh Sách Thiết Bị</span>
          </Link>
        </nav>

        {/* Realtime Status, Theme Toggle & User Info */}
        <div className="navbar-right">
          <div className={`realtime-badge ${connected ? 'online' : 'offline'}`} title={connected ? 'Đã kết nối Socket.IO realtime' : 'Mất kết nối realtime'}>
            <span className="status-dot"></span>
            <Activity size={14} />
            <span>{connected ? 'Realtime: ONLINE' : 'Realtime: OFFLINE'}</span>
          </div>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="btn-theme-toggle"
            title={theme === 'dark' ? 'Chuyển sang Giao diện Sáng (Light Mode)' : 'Chuyển sang Giao diện Tối (Dark Mode)'}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <>
                <Sun size={17} className="text-amber" />
                <span className="theme-toggle-text">Sáng</span>
              </>
            ) : (
              <>
                <Moon size={17} className="text-purple" />
                <span className="theme-toggle-text">Tối</span>
              </>
            )}
          </button>

          {user && (
            <div className="user-profile">
              <ShieldCheck size={18} className="user-role-icon" />
              <div className="user-details">
                <span className="username">{user.full_name || user.username}</span>
                <span className="user-role">{user.role?.toUpperCase() || 'ADMIN'}</span>
              </div>
            </div>
          )}

          <button onClick={handleLogout} className="btn-logout" title="Đăng xuất khỏi hệ thống">
            <LogOut size={16} />
            <span>Đăng Xuất</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
