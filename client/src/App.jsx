import { Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

import { RequireAuth, RedirectIfAuthenticated } from './router/guards';
import LoginPage         from './pages/LoginPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import HomePage          from './pages/HomePage';

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={<RedirectIfAuthenticated><LoginPage /></RedirectIfAuthenticated>}
      />
      <Route
        path="/reset-password"
        element={<RedirectIfAuthenticated><ResetPasswordPage /></RedirectIfAuthenticated>}
      />
      <Route
        path="/"
        element={<RequireAuth><HomePage /></RequireAuth>}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
