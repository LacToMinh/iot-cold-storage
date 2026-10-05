import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// KỸ THUẬT 3: React Router bảo vệ route (Protected Route)
const ProtectedRoute = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex-center" style={{ minHeight: '100vh', background: '#0B0F19', color: '#38BDF8' }}>
        <div className="spinner"></div>
        <p style={{ marginLeft: '12px', fontSize: '15px' }}>Đang xác thực phiên làm việc...</p>
      </div>
    );
  }

  // Nếu chưa đăng nhập -> Chuyển hướng ngay về màn hình /login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Đã xác thực -> Hiển thị các trang con bên trong
  return <Outlet />;
};

export default ProtectedRoute;
