// App-level auth state tests
// Feature: user-authentication, Property 8: Mid-session 401 triggers the session-expired login form

import { render, screen, cleanup, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import * as fc from 'fast-check';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import App from '../App';
import { AuthProvider } from '../AuthContext';

// Protected routes that the axios interceptor watches
const PROTECTED_ROUTES = [
  'http://localhost:3000/api/option-chain',
  'http://localhost:3000/api/expiry-dates',
  'http://localhost:3000/api/refresh-session',
];

// Minimal expiry-dates response so the option chain UI can render
const EXPIRY_DATES_DATA = { expiryDates: ['27-Jun-2024', '04-Jul-2024'] };

// Minimal option-chain response so the authenticated UI renders past the "Loading…" state
const OPTION_CHAIN_DATA = {
  filtered: {
    data: [
      {
        strikePrice: 23000,
        CE: { changeinOpenInterest: 100, openInterest: 5000, lastPrice: 200 },
        PE: { changeinOpenInterest: -50, openInterest: 3000, lastPrice: 150 },
      },
    ],
    underlyingValue: 23000,
  },
};

/**
 * Render the full app tree with MemoryRouter (so useNavigate works in tests)
 * and AuthProvider (so useAuth() works in all pages).
 *
 * initialEntries defaults to ['/'] so the app starts at the home route.
 */
function renderApp(initialEntries = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// Feature: user-authentication, Property 8: Mid-session 401 triggers the session-expired login form
// Validates: Requirements 4.7
describe('App auth — Property 8', () => {
  it(
    'mid-session 401 on any protected route triggers session-expired login form (Property 8)',
    { timeout: 120000 },
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...PROTECTED_ROUTES),
          async (protectedRoute) => {
            // ----------------------------------------------------------------
            // Step 1: Create a MockAdapter that intercepts axios requests while
            //         preserving the interceptor chain (unlike vi.spyOn which
            //         bypasses interceptors entirely).
            // ----------------------------------------------------------------
            const mock = new MockAdapter(axios);

            // Auth status → 200 (App mounts in authenticated state)
            mock.onGet('http://localhost:3000/api/auth/status').reply(200, { authenticated: true });

            // Expiry dates → 200 (unconditional useEffect on mount in HomePage)
            mock.onGet('http://localhost:3000/api/expiry-dates').reply(200, EXPIRY_DATES_DATA);

            // Option chain → 200 (triggered once selectedExpiry is set)
            mock.onGet(/\/api\/option-chain/).reply(200, OPTION_CHAIN_DATA);

            // Logout → 200 (in case it's called)
            mock.onPost('http://localhost:3000/api/auth/logout').reply(200, {});

            // Refresh-session → 200 initially
            mock.onPost('http://localhost:3000/api/refresh-session').reply(200, {});

            // ----------------------------------------------------------------
            // Step 2: Render App and wait for the authenticated UI to appear.
            //         The Header's Logout button is only rendered when authenticated.
            // ----------------------------------------------------------------
            const container = document.createElement('div');
            document.body.appendChild(container);

            const { unmount } = renderApp(['/']);

            // Wait until the authenticated UI is visible (Logout button in Header)
            await waitFor(
              () => expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument(),
              { timeout: 5000 }
            );

            // ----------------------------------------------------------------
            // Step 3: Reconfigure the mock so the protected route now returns 401.
            // ----------------------------------------------------------------
            mock.reset();

            mock.onGet('http://localhost:3000/api/auth/status').reply(200, { authenticated: true });
            mock.onPost('http://localhost:3000/api/auth/logout').reply(200, {});

            if (protectedRoute.includes('/api/expiry-dates')) {
              mock.onGet('http://localhost:3000/api/expiry-dates').reply(401, { error: 'Session expired.' });
              mock.onGet(/\/api\/option-chain/).reply(200, OPTION_CHAIN_DATA);
              mock.onPost('http://localhost:3000/api/refresh-session').reply(200, {});
            } else if (protectedRoute.includes('/api/option-chain')) {
              mock.onGet(/\/api\/option-chain/).reply(401, { error: 'Session expired.' });
              mock.onGet('http://localhost:3000/api/expiry-dates').reply(200, EXPIRY_DATES_DATA);
              mock.onPost('http://localhost:3000/api/refresh-session').reply(200, {});
            } else if (protectedRoute.includes('/api/refresh-session')) {
              mock.onPost('http://localhost:3000/api/refresh-session').reply(401, { error: 'Session expired.' });
              mock.onGet('http://localhost:3000/api/expiry-dates').reply(200, EXPIRY_DATES_DATA);
              mock.onGet(/\/api\/option-chain/).reply(200, OPTION_CHAIN_DATA);
            }

            // ----------------------------------------------------------------
            // Step 4: Trigger a request to the protected route so the axios
            //         interceptor in AuthContext fires on the 401 error.
            // ----------------------------------------------------------------
            await act(async () => {
              try {
                if (protectedRoute.includes('/api/refresh-session')) {
                  await axios.post(protectedRoute, {}, { withCredentials: true });
                } else {
                  await axios.get(protectedRoute, { withCredentials: true });
                }
              } catch (_) {
                // Expected — the 401 rejection is intentional
              }
            });

            // ----------------------------------------------------------------
            // Step 5: Assert that the LoginForm is shown with sessionExpired=true.
            //         The session-expired message is rendered by LoginForm when
            //         the sessionExpired prop is true (passed from AuthContext via
            //         LoginPage).
            // ----------------------------------------------------------------
            await waitFor(
              () =>
                expect(
                  screen.getByText('Session expired. Please log in again.')
                ).toBeInTheDocument(),
              { timeout: 5000 }
            );

            // Also assert the LoginForm itself is present (password input)
            expect(screen.getByLabelText(/password/i)).toBeInTheDocument();

            // ----------------------------------------------------------------
            // Cleanup before the next fast-check run
            // ----------------------------------------------------------------
            mock.restore();
            unmount();
            document.body.removeChild(container);
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});

// ── Additional example-based tests for the router-based auth flow ────────────

describe('App auth — session check on mount', () => {
  it('shows loading indicator while GET /api/auth/status is pending', async () => {
    const mock = new MockAdapter(axios);
    // Never resolves — keeps the app in loading state
    mock.onGet('http://localhost:3000/api/auth/status').reply(() => new Promise(() => {}));

    renderApp(['/']);

    expect(screen.getByText(/checking session/i)).toBeInTheDocument();
    mock.restore();
  });

  it('navigates to / and shows option chain UI after status returns 200', async () => {
    const mock = new MockAdapter(axios);
    mock.onGet('http://localhost:3000/api/auth/status').reply(200, { authenticated: true });
    mock.onGet('http://localhost:3000/api/expiry-dates').reply(200, EXPIRY_DATES_DATA);
    mock.onGet(/\/api\/option-chain/).reply(200, OPTION_CHAIN_DATA);

    renderApp(['/']);

    await waitFor(
      () => expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument(),
      { timeout: 5000 }
    );
    mock.restore();
  });

  it('shows LoginForm after status returns 401', async () => {
    const mock = new MockAdapter(axios);
    mock.onGet('http://localhost:3000/api/auth/status').reply(401, { error: 'Not authenticated.' });

    renderApp(['/']);

    await waitFor(
      () => expect(screen.getByLabelText(/password/i)).toBeInTheDocument(),
      { timeout: 5000 }
    );
    mock.restore();
  });

  it('shows LoginForm after status request fails with network error', async () => {
    const mock = new MockAdapter(axios);
    mock.onGet('http://localhost:3000/api/auth/status').networkError();

    renderApp(['/']);

    await waitFor(
      () => expect(screen.getByLabelText(/password/i)).toBeInTheDocument(),
      { timeout: 5000 }
    );
    mock.restore();
  });
});

describe('App auth — /login and /reset-password routes', () => {
  it('renders LoginForm at /login', async () => {
    const mock = new MockAdapter(axios);
    mock.onGet('http://localhost:3000/api/auth/status').reply(401, { error: 'Not authenticated.' });

    renderApp(['/login']);

    await waitFor(
      () => expect(screen.getByLabelText(/password/i)).toBeInTheDocument(),
      { timeout: 3000 }
    );
    mock.restore();
  });

  it('renders Reset Password page at /reset-password', async () => {
    const mock = new MockAdapter(axios);
    mock.onGet('http://localhost:3000/api/auth/status').reply(401, { error: 'Not authenticated.' });

    renderApp(['/reset-password']);

    await waitFor(
      () => expect(screen.getByText(/reset password/i)).toBeInTheDocument(),
      { timeout: 3000 }
    );
    mock.restore();
  });

  it('redirects /login to / when already authenticated', async () => {
    const mock = new MockAdapter(axios);
    mock.onGet('http://localhost:3000/api/auth/status').reply(200, { authenticated: true });
    mock.onGet('http://localhost:3000/api/expiry-dates').reply(200, EXPIRY_DATES_DATA);
    mock.onGet(/\/api\/option-chain/).reply(200, OPTION_CHAIN_DATA);

    renderApp(['/login']);

    // Should redirect to / and show the authenticated UI
    await waitFor(
      () => expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument(),
      { timeout: 5000 }
    );
    mock.restore();
  });
});
