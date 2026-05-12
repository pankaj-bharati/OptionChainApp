import React, { useState } from 'react';
import {
  Button,
  Form,
  Header,
  Message,
  Segment,
} from 'semantic-ui-react';

/**
 * LoginForm component
 *
 * Props:
 *   onLoginSuccess            () => void
 *   sessionExpired            boolean
 *   credentialsFilePath       string | null
 *   onCredentialsPathReceived (path: string) => void
 *   resetPasswordLink         ReactNode — when provided, replaces the inline
 *                             "Forgot password?" toggle (used by LoginPage to
 *                             pass a <Link to="/reset-password">).
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

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    setError('');

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
      if (err.name === 'AbortError') {
        setError('Request timed out. Please try again.');
      } else {
        setError('Network error. Please check your connection and try again.');
      }
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
        const res = await fetch('http://localhost:3000/api/auth/request-reset', {
          method: 'POST',
          credentials: 'include',
        });
        if (res.ok) {
          const body = await res.json();
          if (body.credentialsFilePath) onCredentialsPathReceived(body.credentialsFilePath);
        }
      } catch (_) {
        // Silently ignore — panel falls back to placeholder
      } finally {
        setResetLoading(false);
      }
    }
  }

  return (
    <div className="login-page-wrapper">
      {/* Session-expired banner */}
      {sessionExpired && (
        <Message warning style={{ maxWidth: 400, width: '100%', marginBottom: '1rem' }}>
          <Message.Header>Session Expired</Message.Header>
          <p>Session expired. Please log in again.</p>
        </Message>
      )}

      <Segment raised style={{ width: '100%', maxWidth: 400 }}>
        <Header as="h2" textAlign="center" color="blue" style={{ marginBottom: '1.5rem' }}>
          NSE Option Chain
        </Header>

        <Form onSubmit={handleSubmit} error={!!error} noValidate>
          <Form.Field>
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              maxLength={128}
              autoComplete="current-password"
              disabled={loading}
            />
          </Form.Field>

          {error && (
            <Message error>
              <p>{error}</p>
            </Message>
          )}

          <Button
            type="submit"
            primary
            fluid
            loading={loading}
            disabled={loading}
            style={{ marginTop: '0.5rem' }}
          >
            Login
          </Button>
        </Form>

        {/* "Forgot password?" — router Link from LoginPage, or inline toggle */}
        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          {resetPasswordLink ?? (
            <Button
              type="button"
              basic
              size="small"
              onClick={handleToggleResetPanel}
            >
              Forgot password?
            </Button>
          )}
        </div>

        {/* Inline reset panel — only when no resetPasswordLink prop */}
        {!resetPasswordLink && showResetPanel && (
          <Message info style={{ marginTop: '1rem' }}>
            <Message.Header>Password Reset</Message.Header>
            <p>Run the following command in a terminal to generate a reset token:</p>
            <pre className="login-reset-curl">
              curl -X POST http://localhost:3000/api/auth/request-reset
            </pre>
            <p>The reset token will be written to:</p>
            <code className="login-reset-path">
              {resetLoading ? 'Loading path…' : (credentialsFilePath ?? 'server/auth.json')}
            </code>
          </Message>
        )}
      </Segment>
    </div>
  );
}
