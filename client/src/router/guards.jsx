import { useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import FullPageSpinner from '../components/ui/FullPageSpinner';

/**
 * Wraps protected routes.
 * Redirects to /login when unauthenticated.
 */
export function RequireAuth({ children }) {
  const { authStatus } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (authStatus === 'unauthenticated') navigate('/login', { replace: true });
  }, [authStatus, navigate]);

  if (authStatus === 'loading')         return <FullPageSpinner label="Checking session…" />;
  if (authStatus === 'unauthenticated') return null;
  return children;
}

/**
 * Wraps public-only routes (/login, /reset-password).
 * Redirects to / when already authenticated.
 */
export function RedirectIfAuthenticated({ children }) {
  const { authStatus } = useAuth();
  if (authStatus === 'loading')       return <FullPageSpinner label="Checking session…" />;
  if (authStatus === 'authenticated') return <Navigate to="/" replace />;
  return children;
}
