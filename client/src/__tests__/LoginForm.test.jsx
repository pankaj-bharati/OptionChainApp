// LoginForm component tests
import { render, screen, cleanup, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import * as fc from 'fast-check';
import LoginForm from '../components/LoginForm';

// Helper: build a mock fetch that resolves with a given status and JSON body
function makeMockFetch(status, body) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('LoginForm', () => {
  // --- Example-based tests ---

  it('renders password input with maxLength=128 and Login button', () => {
    render(
      <LoginForm onLoginSuccess={vi.fn()} sessionExpired={false} credentialsFilePath={null} />
    );
    const input = screen.getByLabelText(/password/i);
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'password');
    expect(input).toHaveAttribute('maxLength', '128');
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  it('shows session-expired message when sessionExpired prop is true', () => {
    render(
      <LoginForm onLoginSuccess={vi.fn()} sessionExpired={true} credentialsFilePath={null} />
    );
    expect(screen.getByText(/session expired/i)).toBeInTheDocument();
  });

  it('does not show session-expired message when sessionExpired is false', () => {
    render(
      <LoginForm onLoginSuccess={vi.fn()} sessionExpired={false} credentialsFilePath={null} />
    );
    expect(screen.queryByText(/session expired/i)).not.toBeInTheDocument();
  });

  it('shows inline error and makes no network request when submitted with empty password', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    render(
      <LoginForm onLoginSuccess={vi.fn()} sessionExpired={false} credentialsFilePath={null} />
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /login/i }));

    expect(mockFetch).not.toHaveBeenCalled();
    expect(screen.getByText(/please enter your password/i)).toBeInTheDocument();
  });

  it('shows server error message below input on 401 response', async () => {
    vi.stubGlobal('fetch', makeMockFetch(401, { error: 'Invalid password.' }));

    render(
      <LoginForm onLoginSuccess={vi.fn()} sessionExpired={false} credentialsFilePath={null} />
    );

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/password/i), 'wrongpass');
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => expect(screen.getByText('Invalid password.')).toBeInTheDocument());
  });

  it('retains password field value on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network error')));

    render(
      <LoginForm onLoginSuccess={vi.fn()} sessionExpired={false} credentialsFilePath={null} />
    );

    const user = userEvent.setup();
    const input = screen.getByLabelText(/password/i);
    await user.type(input, 'mypassword');
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => expect(screen.getByText(/network error/i)).toBeInTheDocument());
    expect(input).toHaveValue('mypassword');
  });

  it('calls onLoginSuccess when login returns 200', async () => {
    vi.stubGlobal('fetch', makeMockFetch(200, {}));
    const onLoginSuccess = vi.fn();

    render(
      <LoginForm onLoginSuccess={onLoginSuccess} sessionExpired={false} credentialsFilePath={null} />
    );

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/password/i), 'correctpass');
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => expect(onLoginSuccess).toHaveBeenCalledTimes(1));
  });

  it('disables submit button while loading', async () => {
    // fetch that never resolves so we can inspect the loading state
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));

    render(
      <LoginForm onLoginSuccess={vi.fn()} sessionExpired={false} credentialsFilePath={null} />
    );

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/password/i), 'somepass');
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /logging in/i })).toBeDisabled()
    );
  });

  it('shows "Forgot password?" panel with curl command when link is clicked', async () => {
    render(
      <LoginForm onLoginSuccess={vi.fn()} sessionExpired={false} credentialsFilePath={null} />
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /forgot password/i }));

    expect(
      screen.getByText(/curl -X POST http:\/\/localhost:3000\/api\/auth\/request-reset/i)
    ).toBeInTheDocument();
  });

  it('shows credentialsFilePath in reset panel when provided', async () => {
    render(
      <LoginForm
        onLoginSuccess={vi.fn()}
        sessionExpired={false}
        credentialsFilePath="/home/user/server/auth.json"
      />
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /forgot password/i }));

    expect(screen.getByText('/home/user/server/auth.json')).toBeInTheDocument();
  });

  it('shows fallback path in reset panel when credentialsFilePath is null', async () => {
    render(
      <LoginForm onLoginSuccess={vi.fn()} sessionExpired={false} credentialsFilePath={null} />
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /forgot password/i }));

    expect(screen.getByText('server/auth.json')).toBeInTheDocument();
  });

  // --- Property-based tests ---

  // Feature: user-authentication, Property 4: Login form transmits the exact entered password
  // Validates: Requirements 2.2
  it('transmits the exact entered password on submit (Property 4)', { timeout: 60000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        // Filter out whitespace-only strings: the LoginForm treats them as empty
        // (the empty-password guard fires) so no fetch would be made.
        // Also filter strings that start/end with whitespace to keep the test
        // focused on the password-transmission property rather than trim behaviour.
        fc.string({ minLength: 1, maxLength: 128 }).filter((s) => s.trim().length > 0),
        async (password) => {
          // Arrange: stub global fetch to capture the request
          const mockFetch = makeMockFetch(200, {});
          vi.stubGlobal('fetch', mockFetch);

          // Use a dedicated container per run to avoid cross-run DOM interference
          const container = document.createElement('div');
          document.body.appendChild(container);
          const { unmount } = render(
            <LoginForm
              onLoginSuccess={vi.fn()}
              sessionExpired={false}
              credentialsFilePath={null}
            />,
            { container }
          );

          // Act: set the password value directly via fireEvent.change to avoid
          // userEvent.type's special-character parsing (e.g. '{' → key descriptor)
          const input = container.querySelector('#login-password');
          fireEvent.change(input, { target: { value: password } });

          // Submit the form
          const submitBtn = container.querySelector('button[type="submit"]');
          fireEvent.click(submitBtn);

          // Wait for the async fetch to be called
          await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

          // Assert: it was a POST to the login endpoint
          const [url, options] = mockFetch.mock.calls[0];
          expect(url).toBe('http://localhost:3000/api/auth/login');
          expect(options.method).toBe('POST');

          // Assert: the body contains exactly the entered password
          const sentBody = JSON.parse(options.body);
          expect(sentBody).toEqual({ password });

          // Cleanup before the next run
          unmount();
          document.body.removeChild(container);
          vi.restoreAllMocks();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: user-authentication, Property 5: Server error messages are surfaced verbatim in the login form
  // Validates: Requirements 2.5
  it('surfaces server error messages verbatim below the password input (Property 5)', { timeout: 60000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        // Filter out whitespace-only strings: getByText normalises whitespace and
        // cannot locate elements whose visible text is purely whitespace characters.
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        async (errorMessage) => {
          // Arrange: stub global fetch to return 401 with the arbitrary error message
          const mockFetch = makeMockFetch(401, { error: errorMessage });
          vi.stubGlobal('fetch', mockFetch);

          // Use a dedicated container per run to avoid cross-run DOM interference
          const container = document.createElement('div');
          document.body.appendChild(container);
          const { unmount } = render(
            <LoginForm
              onLoginSuccess={vi.fn()}
              sessionExpired={false}
              credentialsFilePath={null}
            />,
            { container }
          );

          // Act: set a non-empty password and submit to trigger the 401 response
          const input = container.querySelector('#login-password');
          fireEvent.change(input, { target: { value: 'somepassword' } });
          const submitBtn = container.querySelector('button[type="submit"]');
          fireEvent.click(submitBtn);

          // Assert: the exact error message string appears in the .login-error element
          await waitFor(() => {
            const errorEl = container.querySelector('.login-error');
            expect(errorEl).not.toBeNull();
            expect(errorEl.textContent).toBe(errorMessage);
          });

          // Cleanup before the next run
          unmount();
          document.body.removeChild(container);
          vi.restoreAllMocks();
        }
      ),
      { numRuns: 100 }
    );
  });
});
