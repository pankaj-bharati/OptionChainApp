import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Box, Button, TextField, Typography, Paper, Alert,
  CircularProgress, Stepper, Step, StepLabel, Divider,
} from '@mui/material';
import KeyIcon         from '@mui/icons-material/Key';
import LockResetIcon   from '@mui/icons-material/LockReset';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowBackIcon   from '@mui/icons-material/ArrowBack';

const API = 'http://localhost:3000';

export default function ResetPasswordPage() {
  const [credentialsFilePath, setCredentialsFilePath] = useState(null);
  const [requestLoading, setRequestLoading]           = useState(false);
  const [requestError, setRequestError]               = useState('');
  const [tokenGenerated, setTokenGenerated]           = useState(false);

  const [token, setToken]                     = useState('');
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetLoading, setResetLoading]       = useState(false);
  const [resetError, setResetError]           = useState('');
  const [resetSuccess, setResetSuccess]       = useState(false);

  async function handleRequestReset() {
    setRequestLoading(true); setRequestError('');
    try {
      const res  = await fetch(`${API}/api/auth/request-reset`, { method: 'POST', credentials: 'include' });
      const body = await res.json();
      if (res.ok) { setCredentialsFilePath(body.credentialsFilePath ?? 'server/auth.json'); setTokenGenerated(true); }
      else setRequestError(body.error || 'Failed to generate reset token.');
    } catch { setRequestError('Network error. Please check your connection.'); }
    finally { setRequestLoading(false); }
  }

  async function handleResetSubmit(e) {
    e.preventDefault();
    if (!token.trim())                                       { setResetError('Please enter the reset token.'); return; }
    if (newPassword.length < 8 || newPassword.length > 128) { setResetError('Password must be 8–128 characters.'); return; }
    if (newPassword !== confirmPassword)                     { setResetError('Passwords do not match.'); return; }
    setResetLoading(true); setResetError('');
    try {
      const res  = await fetch(`${API}/api/auth/reset-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim(), newPassword }), credentials: 'include',
      });
      const body = await res.json();
      if (res.ok) setResetSuccess(true);
      else setResetError(body.error || 'Password reset failed.');
    } catch { setResetError('Network error. Please check your connection.'); }
    finally { setResetLoading(false); }
  }

  if (resetSuccess) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', bgcolor: '#f1f5f9', p: 2 }}>
        <Paper elevation={4} sx={{ maxWidth: 420, width: '100%', borderRadius: 3, p: 4, textAlign: 'center' }}>
          <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 1 }} />
          <Typography variant="h5" sx={{ fontWeight: 800, color: 'success.main', mb: 1 }}>Password Updated</Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Your password has been changed and all active sessions have been invalidated.
          </Typography>
          <Button component={Link} to="/login" variant="contained" size="large" sx={{ borderRadius: 2, fontWeight: 700 }}>
            Back to Login
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', bgcolor: '#f1f5f9', p: 2 }}>
      <Paper elevation={4} sx={{ width: '100%', maxWidth: 500, borderRadius: 3, overflow: 'hidden' }}>
        <Box sx={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)', px: 3, py: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <LockResetIcon sx={{ color: '#38bdf8', fontSize: 30 }} />
          <Typography variant="h6" sx={{ color: '#fff', fontWeight: 800 }}>Reset Password</Typography>
        </Box>

        <Box sx={{ p: 3 }}>
          <Stepper activeStep={tokenGenerated ? 1 : 0} sx={{ mb: 3 }}>
            <Step completed={tokenGenerated}>
              <StepLabel icon={<KeyIcon fontSize="small" />}>Generate Token</StepLabel>
            </Step>
            <Step>
              <StepLabel icon={<LockResetIcon fontSize="small" />}>Set Password</StepLabel>
            </Step>
          </Stepper>

          {!tokenGenerated ? (
            <Box>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                Click below to write a one-time reset token to <code>auth.json</code>. The token expires in 15 minutes.
              </Typography>
              <Button variant="contained" fullWidth size="large" onClick={handleRequestReset}
                disabled={requestLoading}
                startIcon={requestLoading ? <CircularProgress size={18} color="inherit" /> : <KeyIcon />}
                sx={{ borderRadius: 2, fontWeight: 700 }}>
                Generate Reset Token
              </Button>
              {requestError && <Alert severity="error" sx={{ mt: 1.5 }}>{requestError}</Alert>}
            </Box>
          ) : (
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Token Generated</Typography>
              <Typography variant="body2">Token written to:</Typography>
              <Box component="code" sx={{ display: 'block', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 1, p: 0.75, fontSize: '0.78rem', color: '#15803d', wordBreak: 'break-all', my: 0.5 }}>
                {credentialsFilePath}
              </Box>
              <Typography variant="body2" sx={{ mt: 0.5 }}>Or generate via terminal:</Typography>
              <Box component="pre" sx={{ background: '#1e293b', color: '#e2e8f0', borderRadius: 1, p: 1, fontSize: '0.78rem', overflowX: 'auto', my: 0.5 }}>
                curl -X POST http://localhost:3000/api/auth/request-reset
              </Box>
            </Alert>
          )}

          {tokenGenerated && (
            <>
              <Divider sx={{ my: 2 }} />
              <Box component="form" onSubmit={handleResetSubmit} noValidate sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField fullWidth label="Reset Token" value={token} onChange={e => setToken(e.target.value)}
                  placeholder="Paste token from auth.json" autoComplete="off" disabled={resetLoading} />
                <TextField fullWidth label="New Password" type="password" value={newPassword}
                  onChange={e => setNewPassword(e.target.value)} inputProps={{ maxLength: 128, autoComplete: 'new-password' }} disabled={resetLoading} />
                <TextField fullWidth label="Confirm Password" type="password" value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)} inputProps={{ maxLength: 128, autoComplete: 'new-password' }} disabled={resetLoading} />
                {resetError && <Alert severity="error">{resetError}</Alert>}
                <Button type="submit" variant="contained" fullWidth size="large" disabled={resetLoading}
                  startIcon={resetLoading ? <CircularProgress size={18} color="inherit" /> : <LockResetIcon />}
                  sx={{ borderRadius: 2, fontWeight: 700 }}>
                  Reset Password
                </Button>
              </Box>
            </>
          )}

          <Divider sx={{ my: 2 }} />
          <Box sx={{ textAlign: 'center' }}>
            <Button component={Link} to="/login" startIcon={<ArrowBackIcon />} size="small" color="inherit">
              Back to Login
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
