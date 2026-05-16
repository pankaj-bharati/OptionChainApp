import { useState } from 'react';
import {
  Box, Button, TextField, Typography, Paper, Alert,
  CircularProgress, Collapse,
} from '@mui/material';
import ShowChartIcon    from '@mui/icons-material/ShowChart';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';

/**
 * Login form card.
 *
 * Props:
 *   onLoginSuccess            () => void
 *   sessionExpired            boolean
 *   credentialsFilePath       string | null
 *   onCredentialsPathReceived (path: string) => void
 *   resetPasswordLink         ReactNode — router <Link> passed from LoginPage
 */
export default function LoginForm({
  onLoginSuccess,
  sessionExpired,
  credentialsFilePath,
  onCredentialsPathReceived,
  resetPasswordLink,
}) {
  const [password, setPassword]             = useState('');
  const [error, setError]                   = useState('');
  const [loading, setLoading]               = useState(false);
  const [showResetPanel, setShowResetPanel] = useState(false);
  const [resetLoading, setResetLoading]     = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!password) { setError('Please enter your password.'); return; }
    setLoading(true); setError('');
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        signal: controller.signal,
        credentials: 'include',
      });
      if (res.ok) {
        onLoginSuccess();
      } else {
        let body = {};
        try { body = await res.json(); } catch (_) {}
        setError(body.error || 'Login failed. Please try again.');
      }
    } catch (err) {
      setError(err.name === 'AbortError'
        ? 'Request timed out. Please try again.'
        : 'Network error. Please check your connection.');
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }

  async function handleToggleResetPanel() {
    const opening = !showResetPanel;
    setShowResetPanel(opening);
    if (opening && onCredentialsPathReceived) {
      setResetLoading(true);
      try {
        const res = await fetch('http://localhost:3000/api/auth/request-reset', { method: 'POST', credentials: 'include' });
        if (res.ok) {
          const body = await res.json();
          if (body.credentialsFilePath) onCredentialsPathReceived(body.credentialsFilePath);
        }
      } catch (_) {}
      finally { setResetLoading(false); }
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', bgcolor: '#f1f5f9', p: 2 }}>
      {sessionExpired && (
        <Alert severity="warning" sx={{ mb: 2, maxWidth: 420, width: '100%' }}>
          Session expired. Please log in again.
        </Alert>
      )}

      <Paper elevation={4} sx={{ width: '100%', maxWidth: 420, borderRadius: 3, overflow: 'hidden' }}>
        {/* Header band */}
        <Box sx={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)', px: 3, py: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ShowChartIcon sx={{ color: '#38bdf8', fontSize: 32 }} />
          <Box>
            <Typography variant="h6" sx={{ color: '#fff', fontWeight: 800, lineHeight: 1.1 }}>NSE Option Chain</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>Sign in to continue</Typography>
          </Box>
        </Box>

        <Box sx={{ p: 3 }}>
          <Box component="form" onSubmit={handleSubmit} noValidate>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2.5 }}>
              <Box sx={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(21,101,192,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LockOutlinedIcon sx={{ color: 'primary.main', fontSize: 26 }} />
              </Box>
            </Box>

            <TextField
              fullWidth label="Password" type="password" variant="outlined" size="medium"
              value={password} onChange={e => setPassword(e.target.value)}
              inputProps={{ maxLength: 128, autoComplete: 'current-password', id: 'login-password' }}
              disabled={loading} sx={{ mb: 1.5 }}
            />

            {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}

            <Button
              type="submit" variant="contained" fullWidth size="large" disabled={loading}
              sx={{ py: 1.3, fontWeight: 700, fontSize: '1rem', borderRadius: 2 }}
            >
              {loading ? <CircularProgress size={22} color="inherit" /> : 'Sign In'}
            </Button>
          </Box>

          <Box sx={{ textAlign: 'center', mt: 2 }}>
            {resetPasswordLink ?? (
              <Button variant="text" size="small" onClick={handleToggleResetPanel} disabled={resetLoading}>
                {resetLoading ? <CircularProgress size={14} /> : 'Forgot password?'}
              </Button>
            )}
          </Box>

          {!resetPasswordLink && showResetPanel && (
            <Collapse in={showResetPanel}>
              <Alert severity="info" sx={{ mt: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>Password Reset</Typography>
                <Typography variant="body2" sx={{ mb: 0.5 }}>Run in terminal to generate a reset token:</Typography>
                <Box component="pre" sx={{ background: '#1e293b', color: '#e2e8f0', borderRadius: 1, p: 1, fontSize: '0.78rem', overflowX: 'auto', my: 0.5 }}>
                  curl -X POST http://localhost:3000/api/auth/request-reset
                </Box>
                <Typography variant="body2" sx={{ mb: 0.5 }}>Token written to:</Typography>
                <Box component="code" sx={{ display: 'block', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 1, p: 0.75, fontSize: '0.78rem', color: '#15803d', wordBreak: 'break-all' }}>
                  {resetLoading ? 'Loading path…' : (credentialsFilePath ?? 'server/auth.json')}
                </Box>
              </Alert>
            </Collapse>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
