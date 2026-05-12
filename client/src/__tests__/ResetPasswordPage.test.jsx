// ResetPasswordPage component tests
// Feature: user-authentication — password reset UI

import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import ResetPasswordPage from '../pages/ResetPasswordPage';

// Helper: render ResetPasswordPage inside a MemoryRouter (required for <Link>)
function renderPage() {
  return render(
    <MemoryRouter>
      <ResetPasswordPage />
    </MemoryRouter>
  );
}

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

describe('ResetPasswordPage', () => {
  // ── Step 1: Generate Reset Token ─────────────────────────────────────────

  it('renders Step 1 with a "Generate Reset Token" button on initial load', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /generate reset token/i })).toBeInTheDocument();
    expect(screen.getByText(/step 1/i)).toBeInTheDocument();
  });

  it('calls POST /api/auth/request-reset when "Generate Reset Token" is clicked', async () => {
    const mockFetch = makeMockFetch(200, {
      credentialsFilePath: '/home/user/server/auth.json',
      message: 'Reset token written.',
    });
    vi.stubGlobal('fetch', mockFetch);

    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /generate reset token/i }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/auth/request-reset');
    expect(options.method).toBe('POST');
  });

  it('shows credentials file path after successful token generation', async () => {
    vi.stubGlobal(
      'fetch',
      makeMockFetch(200, { credentialsFilePath: '/home/user/server/auth.json' })
    );

    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /generate reset token/i }));

    await waitFor(() =>
      expect(screen.getByText('/home/user/server/auth.json')).toBeInTheDocument()
    );
  });

  it('shows Step 2 form after successful token generation', async () => {
    vi.stubGlobal(
      'fetch',
      makeMockFetch(200, { credentialsFilePath: '/home/user/server/auth.json' })
    );

    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /generate reset token/i }));

    await waitFor(() => expect(screen.getByText(/step 2/i)).toBeInTheDocument());
    expect(screen.getByLabelText(/reset token/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
  });

  it('shows inline error when request-reset fails', async () => {
    vi.stubGlobal('fetch', makeMockFetch(500, { error: 'Server error.' }));

    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /generate reset token/i }));

    await waitFor(() => expect(screen.getByText('Server error.')).toBeInTheDocument());
  });

  it('shows inline error on network error during token generation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network error')));

    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /generate reset token/i }));

    await waitFor(() => expect(screen.getByText(/network error/i)).toBeInTheDocument());
  });

  // ── Step 2: Client-side validation ───────────────────────────────────────

  it('shows inline error and makes no network request when passwords do not match', async () => {
    // First get to Step 2
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ credentialsFilePath: '/server/auth.json' }),
      });
    vi.stubGlobal('fetch', mockFetch);

    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /generate reset token/i }));
    await waitFor(() => expect(screen.getByLabelText(/reset token/i)).toBeInTheDocument());

    // Fill in mismatched passwords
    fireEvent.change(screen.getByLabelText(/reset token/i), { target: { value: 'abc123' } });
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'different456' } });

    await user.click(screen.getByRole('button', { name: /reset password/i }));

    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    // Only the request-reset call should have been made (not reset-password)
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('shows inline error and makes no network request when new password is shorter than 8 chars', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ credentialsFilePath: '/server/auth.json' }),
      });
    vi.stubGlobal('fetch', mockFetch);

    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /generate reset token/i }));
    await waitFor(() => expect(screen.getByLabelText(/reset token/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/reset token/i), { target: { value: 'abc123' } });
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'short' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'short' } });

    await user.click(screen.getByRole('button', { name: /reset password/i }));

    expect(screen.getByText(/password must be between 8 and 128 characters/i)).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('shows inline error and makes no network request when token field is empty', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ credentialsFilePath: '/server/auth.json' }),
      });
    vi.stubGlobal('fetch', mockFetch);

    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /generate reset token/i }));
    await waitFor(() => expect(screen.getByLabelText(/reset token/i)).toBeInTheDocument());

    // Leave token empty, fill valid passwords
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'validpass123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'validpass123' } });

    await user.click(screen.getByRole('button', { name: /reset password/i }));

    expect(screen.getByText(/please enter the reset token/i)).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  // ── Step 2: Successful reset ──────────────────────────────────────────────

  it('shows confirmation screen with "Back to Login" link after successful reset', async () => {
    const mockFetch = vi.fn()
      // First call: request-reset
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ credentialsFilePath: '/server/auth.json' }),
      })
      // Second call: reset-password
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'Password updated.' }),
      });
    vi.stubGlobal('fetch', mockFetch);

    renderPage();
    const user = userEvent.setup();

    // Step 1
    await user.click(screen.getByRole('button', { name: /generate reset token/i }));
    await waitFor(() => expect(screen.getByLabelText(/reset token/i)).toBeInTheDocument());

    // Step 2
    fireEvent.change(screen.getByLabelText(/reset token/i), { target: { value: 'a'.repeat(64) } });
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'newpassword123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'newpassword123' } });

    await user.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() =>
      expect(screen.getByText(/password updated/i)).toBeInTheDocument()
    );
    expect(screen.getByRole('link', { name: /back to login/i })).toBeInTheDocument();
  });

  // ── Step 2: Server error on reset-password ────────────────────────────────

  it('shows server error message inline when reset-password returns 400', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ credentialsFilePath: '/server/auth.json' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Reset token is invalid or has expired.' }),
      });
    vi.stubGlobal('fetch', mockFetch);

    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /generate reset token/i }));
    await waitFor(() => expect(screen.getByLabelText(/reset token/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/reset token/i), { target: { value: 'badtoken' } });
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'newpassword123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'newpassword123' } });

    await user.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() =>
      expect(
        screen.getByText('Reset token is invalid or has expired.')
      ).toBeInTheDocument()
    );
  });

  // ── Navigation ────────────────────────────────────────────────────────────

  it('renders a "← Back to Login" link that points to /login', () => {
    renderPage();
    const backLink = screen.getByRole('link', { name: /back to login/i });
    expect(backLink).toBeInTheDocument();
    expect(backLink).toHaveAttribute('href', '/login');
  });
});
