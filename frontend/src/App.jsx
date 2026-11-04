import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import MainLayout from './components/layout/MainLayout';
import Loader from './components/common/Loader';

// Auth Pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import VerifyOtp from './pages/auth/VerifyOtp';

// Driver Pages
import DriverDashboard from './pages/driver/DriverDashboard';
import ParkingAreas from './pages/driver/ParkingAreas';
import SlotAvailability from './pages/driver/SlotAvailability';
import MakeReservation from './pages/driver/MakeReservation';
import MyReservations from './pages/driver/MyReservations';
import ParkingSessions from './pages/driver/ParkingSessions';
import Payments from './pages/driver/Payments';
import Violations from './pages/driver/Violations';
import Notifications from './pages/driver/Notifications';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AreasManagement from './pages/admin/AreasManagement';
import SlotsManagement from './pages/admin/SlotsManagement';
import ReservationsManagement from './pages/admin/ReservationsManagement';
import SessionsManagement from './pages/admin/SessionsManagement';
import PaymentsManagement from './pages/admin/PaymentsManagement';
import ViolationsManagement from './pages/admin/ViolationsManagement';
import ActivityLogs from './pages/admin/ActivityLogs';

import NotFound from './pages/NotFound';

// Protected Route Guard
const ProtectedRoute = ({ children, requiredRole }) => {
  const { user, token, loading } = useAuth();

  if (loading) {
    return <Loader message="Verifying session..." fullHeight />;
  }

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    // Redirect to their respective dashboard
    return <Navigate to={user.role === 'ADMIN' ? '/admin/dashboard' : '/driver/dashboard'} replace />;
  }

  return children;
};

// Root index redirector
const RootRedirect = () => {
  const { user, token, loading } = useAuth();

  if (loading) return <Loader fullHeight />;
  if (!token || !user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'ADMIN' ? '/admin/dashboard' : '/driver/dashboard'} replace />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-otp" element={<VerifyOtp />} />

          {/* Root Redirect */}
          <Route path="/" element={<RootRedirect />} />

          {/* Driver Protected Routes */}
          <Route
            path="/driver"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/driver/dashboard" replace />} />
            <Route path="dashboard" element={<DriverDashboard />} />
            <Route path="areas" element={<ParkingAreas />} />
            <Route path="slots" element={<SlotAvailability />} />
            <Route path="reserve" element={<MakeReservation />} />
            <Route path="my-reservations" element={<MyReservations />} />
            <Route path="sessions" element={<ParkingSessions />} />
            <Route path="payments" element={<Payments />} />
            <Route path="violations" element={<Violations />} />
            <Route path="notifications" element={<Notifications />} />
          </Route>

          {/* Admin Protected Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole="ADMIN">
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="areas" element={<AreasManagement />} />
            <Route path="slots" element={<SlotsManagement />} />
            <Route path="reservations" element={<ReservationsManagement />} />
            <Route path="sessions" element={<SessionsManagement />} />
            <Route path="payments" element={<PaymentsManagement />} />
            <Route path="violations" element={<ViolationsManagement />} />
            <Route path="activity-logs" element={<ActivityLogs />} />
          </Route>

          {/* 404 Catch All */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

