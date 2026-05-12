import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Loader } from 'semantic-ui-react';
import './App.css';

import { useAuth } from './AuthContext';
import LoginPage         from './pages/LoginPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import HomePage          from './pages/HomePage';

/**
 * Auth-aware redirect wrapper.
 *
 * - 'loading'         → show a loading indicator (no redirect yet)
 * - 'unauthenticated' → redirect to /login
 * - 'authenticated'   → render the protected page
 */
function RequireAuth({ children }) {
  const { authStatus } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      navigate('/login', { replace: true });
    }
  }, [authStatus, navigate]);

  if (authStatus === 'loading') {
    return <Loader active size="large">Checking session…</Loader>;
  }

  if (authStatus === 'unauthenticated') {
    return null;
  }

  return children;
}

/**
 * Redirect authenticated users away from /login and /reset-password.
 */
function RedirectIfAuthenticated({ children }) {
  const { authStatus } = useAuth();

  if (authStatus === 'loading') {
    return <Loader active size="large">Checking session…</Loader>;
  }

  if (authStatus === 'authenticated') {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/login"
        element={
          <RedirectIfAuthenticated>
            <LoginPage />
          </RedirectIfAuthenticated>
        }
      />
      <Route
        path="/reset-password"
        element={
          <RedirectIfAuthenticated>
            <ResetPasswordPage />
          </RedirectIfAuthenticated>
        }
      />

      {/* Protected route */}
      <Route
        path="/"
        element={
          <RequireAuth>
            <HomePage />
          </RequireAuth>
        }
      />

      {/* Catch-all → home (RequireAuth will redirect to /login if needed) */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
