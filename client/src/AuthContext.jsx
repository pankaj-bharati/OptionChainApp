import { createContext, useContext, useEffect, useRef, useState } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

/**
 * Provides auth state and handlers to the entire app.
 * authStatus: 'loading' | 'authenticated' | 'unauthenticated'
 */
export function AuthProvider({ children }) {
  const [authStatus, setAuthStatus]             = useState('loading');
  const [sessionExpired, setSessionExpired]     = useState(false);
  const [credentialsFilePath, setCredentialsFilePath] = useState(null);

  // Keep a ref so the axios interceptor never captures a stale closure.
  const authStatusRef = useRef(authStatus);
  useEffect(() => { authStatusRef.current = authStatus; }, [authStatus]);

  // ── Session check on mount ────────────────────────────────────────────────
  useEffect(() => {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 10_000);

    axios
      .get('http://localhost:3000/api/auth/status', {
        signal: controller.signal,
        withCredentials: true,
      })
      .then(() => setAuthStatus('authenticated'))
      .catch(() => setAuthStatus('unauthenticated'))
      .finally(() => clearTimeout(timeoutId));

    return () => { controller.abort(); clearTimeout(timeoutId); };
  }, []);

  // ── Axios interceptor: mid-session 401 ───────────────────────────────────
  useEffect(() => {
    const id = axios.interceptors.response.use(
      res => res,
      err => {
        if (err?.response?.status === 401 && authStatusRef.current === 'authenticated') {
          setSessionExpired(true);
          setAuthStatus('unauthenticated');
        }
        return Promise.reject(err);
      }
    );
    return () => axios.interceptors.response.eject(id);
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handleLoginSuccess() {
    setSessionExpired(false);
    setAuthStatus('authenticated');
  }

  function handleLogout() {
    axios
      .post('http://localhost:3000/api/auth/logout', {}, { withCredentials: true })
      .catch(() => {})
      .finally(() => {
        setAuthStatus('unauthenticated');
        setSessionExpired(false);
        localStorage.removeItem('oiHistory');
      });
  }

  return (
    <AuthContext.Provider value={{
      authStatus,
      sessionExpired,
      credentialsFilePath,
      setCredentialsFilePath,
      handleLoginSuccess,
      handleLogout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
