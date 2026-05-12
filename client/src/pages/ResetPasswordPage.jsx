import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Button,
  Container,
  Divider,
  Form,
  Header,
  Icon,
  Message,
  Segment,
  Step,
} from 'semantic-ui-react';

const API = 'http://localhost:3000';

/**
 * /reset-password — two-step password reset page.
 *
 * Step 1: Generate a reset token via POST /api/auth/request-reset.
 * Step 2: Submit the token + new password via POST /api/auth/reset-password.
 */
export default function ResetPasswordPage() {
  // Step 1 state
  const [credentialsFilePath, setCredentialsFilePath] = useState(null);
  const [requestLoading, setRequestLoading]           = useState(false);
  const [requestError, setRequestError]               = useState('');
  const [tokenGenerated, setTokenGenerated]           = useState(false);

  // Step 2 state
  const [token, setToken]                 = useState('');
  const [newPassword, setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetLoading, setResetLoading]   = useState(false);
  const [resetError, setResetError]       = useState('');
  const [resetSuccess, setResetSuccess]   = useState(false);

  // ── Step 1 ────────────────────────────────────────────────────────────────
  async function handleRequestReset() {
    setRequestLoading(true);
    setRequestError('');
    try {
      const res  = await fetch(`${API}/api/auth/request-reset`, { method: 'POST', credentials: 'include' });
      const body = await res.json();
      if (res.ok) {
        setCredentialsFilePath(body.credentialsFilePath ?? 'server/auth.json');
        setTokenGenerated(true);
      } else {
        setRequestError(body.error || 'Failed to generate reset token.');
      }
    } catch {
      setRequestError('Network error. Please check your connection.');
    } finally {
      setRequestLoading(false);
    }
  }

  // ── Step 2 ────────────────────────────────────────────────────────────────
  async function handleResetSubmit(e) {
    e.preventDefault();

    if (!token.trim()) {
      setResetError('Please enter the reset token from auth.json.');
      return;
    }
    if (newPassword.length < 8 || newPassword.length > 128) {
      setResetError('Password must be between 8 and 128 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match.');
      return;
    }

    setResetLoading(true);
    setResetError('');

    try {
      const res  = await fetch(`${API}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim(), newPassword }),
        credentials: 'include',
      });
      const body = await res.json();
      if (res.ok) {
        setResetSuccess(true);
      } else {
        setResetError(body.error || 'Password reset failed.');
      }
    } catch {
      setResetError('Network error. Please check your connection.');
    } finally {
      setResetLoading(false);
    }
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (resetSuccess) {
    return (
      <div className="login-page-wrapper">
        <Segment raised style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
          <Icon name="check circle" color="green" size="huge" />
          <Header as="h2" color="green" style={{ marginTop: '0.5rem' }}>
            Password Updated
          </Header>
          <p style={{ color: '#555', marginBottom: '1.5rem' }}>
            Your password has been changed and all active sessions have been invalidated.
          </p>
          <Button as={Link} to="/login" primary>
            Back to Login
          </Button>
        </Segment>
      </div>
    );
  }

  return (
    <div className="login-page-wrapper">
      <Segment raised style={{ maxWidth: 520, width: '100%' }}>
        <Header as="h2" textAlign="center" color="blue" style={{ marginBottom: '1.5rem' }}>
          Reset Password
        </Header>

        {/* Progress steps */}
        <Step.Group fluid size="mini" style={{ marginBottom: '1.5rem' }}>
          <Step completed={tokenGenerated} active={!tokenGenerated}>
            <Icon name="key" />
            <Step.Content>
              <Step.Title>Generate Token</Step.Title>
            </Step.Content>
          </Step>
          <Step active={tokenGenerated} disabled={!tokenGenerated}>
            <Icon name="lock" />
            <Step.Content>
              <Step.Title>Set Password</Step.Title>
            </Step.Content>
          </Step>
        </Step.Group>

        {/* ── Step 1 ── */}
        {!tokenGenerated ? (
          <div>
            <p style={{ color: '#555', marginBottom: '1rem' }}>
              Click the button below to write a one-time reset token to{' '}
              <code>auth.json</code> on the server. The token expires in 15 minutes.
            </p>
            <Button
              primary
              fluid
              loading={requestLoading}
              disabled={requestLoading}
              onClick={handleRequestReset}
            >
              <Icon name="key" />
              Generate Reset Token
            </Button>
            {requestError && (
              <Message error style={{ marginTop: '1rem' }}>
                <p>{requestError}</p>
              </Message>
            )}
          </div>
        ) : (
          <Message info>
            <Message.Header>Token Generated</Message.Header>
            <p>Token written to:</p>
            <code className="login-reset-path">{credentialsFilePath}</code>
            <p style={{ marginTop: 8 }}>Or generate via terminal:</p>
            <pre className="login-reset-curl">
              curl -X POST http://localhost:3000/api/auth/request-reset
            </pre>
            <p style={{ marginTop: 8, fontSize: '0.9em', color: '#555' }}>
              Open <code>auth.json</code>, copy the <code>resetToken</code> value, and paste it below.
            </p>
          </Message>
        )}

        {/* ── Step 2 ── */}
        {tokenGenerated && (
          <>
            <Divider />
            <Form onSubmit={handleResetSubmit} error={!!resetError} noValidate>
              <Form.Field>
                <label htmlFor="reset-token">Reset Token</label>
                <input
                  id="reset-token"
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste token from auth.json"
                  autoComplete="off"
                  disabled={resetLoading}
                />
              </Form.Field>

              <Form.Field>
                <label htmlFor="new-password">New Password</label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  maxLength={128}
                  autoComplete="new-password"
                  disabled={resetLoading}
                />
              </Form.Field>

              <Form.Field>
                <label htmlFor="confirm-password">Confirm Password</label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  maxLength={128}
                  autoComplete="new-password"
                  disabled={resetLoading}
                />
              </Form.Field>

              {resetError && (
                <Message error>
                  <p>{resetError}</p>
                </Message>
              )}

              <Button
                type="submit"
                primary
                fluid
                loading={resetLoading}
                disabled={resetLoading}
                style={{ marginTop: '0.5rem' }}
              >
                <Icon name="lock" />
                Reset Password
              </Button>
            </Form>
          </>
        )}

        <Divider />
        <div style={{ textAlign: 'center' }}>
          <Link to="/login" style={{ color: '#4183c4', fontSize: '0.9em' }}>
            ← Back to Login
          </Link>
        </div>
      </Segment>
    </div>
  );
}
