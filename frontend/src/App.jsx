import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import AuthCallback from './pages/AuthCallback';
import ConnectPage from './pages/ConnectPage';
import AutomationsPage from './pages/AutomationsPage';
import NewAutomationPage from './pages/NewAutomationPage';
import ActivityPage from './pages/ActivityPage';
import Layout from './components/Layout';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/" replace />;
  return children;
}

function FullScreenLoader() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#000', flexDirection: 'column', gap: '16px'
    }}>
      <div style={{
        width: '36px', height: '36px', borderRadius: '50%',
        border: '2px solid #1a1a1a', borderTop: '2px solid #fff',
        animation: 'spin 0.8s linear infinite'
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: { background: '#0a0a0a', color: '#fff', border: '1px solid #1a1a1a' },
            success: { iconTheme: { primary: '#fff', secondary: '#000' } },
            error: { iconTheme: { primary: '#ff5555', secondary: '#fff' } },
          }}
        />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/connect" element={<ConnectPage />} />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/automations" element={<AutomationsPage />} />
            <Route path="/automations/new" element={<NewAutomationPage />} />
            <Route path="/activity" element={<ActivityPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
