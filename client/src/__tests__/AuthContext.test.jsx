// AuthContext tests
import { render, screen, cleanup, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { AuthProvider, useAuth } from '../AuthContext';

// ---------------------------------------------------------------------------
// Helper: a minimal consumer component that exposes auth state via the DOM
// ---------------------------------------------------------------------------
function AuthConsumer() {
  const {
    authStatus,
    sessionExpired,
    credentialsFilePath,
    handleLoginSuccess,
    handleLogout,
  } = useAuth();

  return (
    <div>
      <span data-testid="auth-status">{authStatus}</span>
      <span data-testid="session-expired">{String(sessionExpired)}</span>
      <span data-testid="credentials-path">{credentialsFilePath ?? 'null'}</span>
      <button onClick={handleLoginSuccess}>Login Success</button>
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <AuthProvider>
      <AuthConsumer />
    </AuthProvider>
  );
}

// ---------------------------------------------------------------------------
// Each test gets a fresh MockAdapter so interceptors from other test files
// (e.g. App.auth.test.jsx) don't interfere.
// ---------------------------------------------------------------------------
let mock;

beforeEach(() => {
  // Create a new adapter before each test; this also clears any handlers left
  // by previous tests in this file.
  mock = new MockAdapter(axios, { onNoMatch: 'throwException' });
});

afterEach(() => {
  mock.restore(); // remove the adapter and restore axios to its original state
  cleanup();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// useAuth — guard
// ---------------------------------------------------------------------------
describe('useAuth', () => {
  it('throws when used outside <AuthProvider>', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<AuthConsumer />)).toThrow(
      'useAuth must be used inside <AuthProvider>'
    );
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Initial loading state
// ---------------------------------------------------------------------------
describe('AuthProvider — initial state', () => {
  it('starts with authStatus="loading"', () => {
    // Request hangs — state stays at 'loading' during this synchronous assertion
    mock.onGet('http://localhost:3000/api/auth/status').reply(() => new Promise(() => {}));

    renderWithProvider();

    expect(screen.getByTestId('auth-status')).toHaveTextContent('loading');
    expect(screen.getByTestId('session-expired')).toHaveTextContent('false');
    expect(screen.getByTestId('credentials-path')).toHaveTextContent('null');
  });
});

// ---------------------------------------------------------------------------
// Session check on mount
// ---------------------------------------------------------------------------
describe('AuthProvider — session check on mount', () => {
  it('sets authStatus="authenticated" when GET /api/auth/status returns 200', async () => {
    mock.onGet('http://localhost:3000/api/auth/status').reply(200, { authenticated: true });

    renderWithProvider();

    await waitFor(() =>
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated')
    );
  });

  it('sets authStatus="unauthenticated" when GET /api/auth/status returns 401', async () => {
    mock.onGet('http://localhost:3000/api/auth/status').reply(401, { error: 'Not authenticated.' });

    renderWithProvider();

    await waitFor(() =>
      expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated')
    );
  });

  it('sets authStatus="unauthenticated" on network error', async () => {
    mock.onGet('http://localhost:3000/api/auth/status').networkError();

    renderWithProvider();

    await waitFor(() =>
      expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated')
    );
  });

  it('sets authStatus="unauthenticated" when the request is aborted (simulates timeout)', async () => {
    // Simulate the AbortController firing by making axios reject with a
    // CanceledError (the error axios throws when a signal is aborted).
    // This exercises the same catch path as the real 10-second timeout.
    const abortError = new axios.CanceledError('canceled');
    mock.onGet('http://localhost:3000/api/auth/status').reply(() =>
      Promise.reject(abortError)
    );

    renderWithProvider();

    await waitFor(() =>
      expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated')
    );
  });
});

// ---------------------------------------------------------------------------
// handleLoginSuccess
// ---------------------------------------------------------------------------
describe('AuthProvider — handleLoginSuccess', () => {
  it('sets authStatus="authenticated" and clears sessionExpired', async () => {
    mock.onGet('http://localhost:3000/api/auth/status').reply(401, { error: 'Not authenticated.' });

    renderWithProvider();

    await waitFor(() =>
      expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated')
    );

    // Click the Login Success button (calls handleLoginSuccess synchronously)
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /login success/i }));

    expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    expect(screen.getByTestId('session-expired')).toHaveTextContent('false');
  });
});

// ---------------------------------------------------------------------------
// handleLogout
// ---------------------------------------------------------------------------
describe('AuthProvider — handleLogout', () => {
  it('sets authStatus="unauthenticated" and clears sessionExpired after successful logout', async () => {
    mock.onGet('http://localhost:3000/api/auth/status').reply(200, { authenticated: true });
    mock.onPost('http://localhost:3000/api/auth/logout').reply(200, {});

    renderWithProvider();

    await waitFor(() =>
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated')
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /logout/i }));

    await waitFor(() =>
      expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated')
    );
    expect(screen.getByTestId('session-expired')).toHaveTextContent('false');
  });

  it('still sets authStatus="unauthenticated" even when logout request fails', async () => {
    mock.onGet('http://localhost:3000/api/auth/status').reply(200, { authenticated: true });
    mock.onPost('http://localhost:3000/api/auth/logout').networkError();

    renderWithProvider();

    await waitFor(() =>
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated')
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /logout/i }));

    await waitFor(() =>
      expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated')
    );
  });
});

// ---------------------------------------------------------------------------
// Axios interceptor — mid-session 401
// ---------------------------------------------------------------------------
describe('AuthProvider — mid-session 401 interceptor', () => {
  it('sets sessionExpired=true and authStatus="unauthenticated" when a 401 arrives while authenticated', async () => {
    mock.onGet('http://localhost:3000/api/auth/status').reply(200, { authenticated: true });
    mock.onGet('http://localhost:3000/api/option-chain').reply(401, { error: 'Session expired.' });

    renderWithProvider();

    await waitFor(() =>
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated')
    );

    // Trigger a 401 on a protected route — goes through the real axios pipeline
    // so the AuthProvider's response interceptor fires.
    await act(async () => {
      try {
        await axios.get('http://localhost:3000/api/option-chain', { withCredentials: true });
      } catch (_) {
        // Expected rejection
      }
    });

    expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
    expect(screen.getByTestId('session-expired')).toHaveTextContent('true');
  });

  it('does NOT set sessionExpired when a 401 arrives while already unauthenticated', async () => {
    mock.onGet('http://localhost:3000/api/auth/status').reply(401, { error: 'Not authenticated.' });
    mock.onGet('http://localhost:3000/api/option-chain').reply(401, { error: 'Not authenticated.' });

    renderWithProvider();

    await waitFor(() =>
      expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated')
    );

    // Dispatch a 401 through the real axios pipeline while already unauthenticated
    await act(async () => {
      try {
        await axios.get('http://localhost:3000/api/option-chain', { withCredentials: true });
      } catch (_) {
        // Expected rejection
      }
    });

    // sessionExpired should remain false — interceptor only fires when authenticated
    expect(screen.getByTestId('session-expired')).toHaveTextContent('false');
  });
});
