import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';

// 4 MÀN HÌNH THEO ĐÚNG YÊU CẦU ĐỀ TÀI:
import LoginPage from './pages/LoginPage';               // Màn hình 1: Đăng nhập
import DeviceListPage from './pages/DeviceListPage';       // Màn hình 2: Danh sách thiết bị
import DeviceDetailPage from './pages/DeviceDetailPage';   // Màn hình 3: Chi tiết và biểu đồ
import ControlPage from './pages/ControlPage';             // Màn hình 4: Gửi lệnh điều khiển

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <SocketProvider>
            <Routes>
              {/* Màn hình 1: Đăng nhập (Công khai) */}
              <Route path="/login" element={<LoginPage />} />

              {/* KỸ THUẬT 3: React Router bảo vệ route (Protected Routes) */}
              <Route element={<ProtectedRoute />}>
                <Route
                  path="/*"
                  element={
                    <>
                      <Navbar />
                      <main>
                        <Routes>
                          <Route path="/" element={<Navigate to="/devices" replace />} />
                          {/* Màn hình 2: Danh sách thiết bị */}
                          <Route path="/devices" element={<DeviceListPage />} />
                          {/* Màn hình 3: Chi tiết và biểu đồ */}
                          <Route path="/devices/:id" element={<DeviceDetailPage />} />
                          {/* Màn hình 4: Gửi lệnh điều khiển */}
                          <Route path="/devices/:id/control" element={<ControlPage />} />
                          {/* Fallback */}
                          <Route path="*" element={<Navigate to="/devices" replace />} />
                        </Routes>
                      </main>
                    </>
                  }
                />
              </Route>
            </Routes>
          </SocketProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
