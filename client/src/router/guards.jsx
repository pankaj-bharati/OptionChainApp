import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import FullPageSpinner from '../components/ui/FullPageSpinner';

/**
 * Wraps protected routes.
 *
 * - 'loading'         → show spinner (session check in flight)
 * - 'unauthenticated' → redirect to /login, preserving the intended URL in
 *                       location.state so LoginPage can redirect back after login
 * - 'authenticated'   → render the protected page
 */
export function RequireAuth({ children }) {
  const { authStatus } = useAuth();
  const location = useLocation();

  if (authStatus === 'loading') {
    return <FullPageSpinner label="Checking session…" />;
  }

  if (authStatus === 'unauthenticated') {
    // Pass the current path so we can redirect back after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

/**
 * Wraps public-only routes (/login, /reset-password).
 * Redirects authenticated users back to where they came from, or / by default.
 */
export function RedirectIfAuthenticated({ children }) {
  const { authStatus } = useAuth();
  const location = useLocation();

  if (authStatus === 'loading') {
    return <FullPageSpinner label="Checking session…" />;
  }

  if (authStatus === 'authenticated') {
    const destination = location.state?.from?.pathname || '/';
    return <Navigate to={destination} replace />;
  }

  return children;
}
