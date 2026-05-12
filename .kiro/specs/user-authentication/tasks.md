# Implementation Plan: User Authentication

## Overview

Add password-based authentication to the NSE Option Chain Viewer. The implementation spans both packages: the Express server gains auth middleware, five new API routes, bcrypt-based credential storage, and an in-memory session token store; the React client gains `AuthContext.jsx` for shared auth state, three page components (`LoginPage`, `ResetPasswordPage`, `HomePage`) wired together with React Router v6, a `LoginForm` component, and a Logout button in `Header.jsx`. All new server code is added to the existing single-file `server/server.js` following project conventions.

## Tasks

- [x] 1. Install dependencies and set up test infrastructure
  - Install `bcrypt`, `cookie-parser`, `express-rate-limit` in `server/` (`npm install bcrypt cookie-parser express-rate-limit`)
  - Install `fast-check`, `jest`, `supertest` in `server/` as dev dependencies
  - Install `fast-check`, `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom` in `client/` as dev dependencies
  - Install `react-router-dom@6` in `client/` as a dependency
  - Create `server/__tests__/` directory and empty `auth.test.js` file
  - Create `client/src/__tests__/` directory and empty `LoginForm.test.jsx` and `App.auth.test.jsx` files
  - Add `"test": "jest --testEnvironment node"` script to `server/package.json`
  - Add `"test": "vitest run"` script to `client/package.json`; configure `vitest` in `client/vite.config.js` with `jsdom` environment
  - _Requirements: 2.9, 6.1_

- [x] 2. Implement server-side credential storage and startup validation
  - [x] 2.1 Implement `loadOrCreateCredentials()` in `server/server.js`
    - At the top of `server.js`, `require` `bcrypt`, `fs`, `path`, and `crypto`
    - Define `AUTH_FILE_PATH = path.join(__dirname, 'auth.json')`
    - Write `loadOrCreateCredentials()`: if `auth.json` absent, hash `"admin"` with bcrypt cost 10, write `{ passwordHash }` to disk, log the warning with the file path, and return the parsed object; if present but unreadable (I/O error), log error + `process.exit(1)`; if present but malformed JSON or missing `passwordHash`, log error + `process.exit(1)`; otherwise return parsed object
    - Call `loadOrCreateCredentials()` synchronously at startup and store result in a module-level `credentials` variable
    - _Requirements: 2.10, 2.11, 6.1, 6.2, 6.5_

  - [x] 2.2 Write property test for credentials file validation (Property 6)
    - In `server/__tests__/auth.test.js`, write a fast-check property test:
      ```js
      // Feature: user-authentication, Property 6: Malformed credentials file always fails startup validation
      ```
    - Generate arbitrary strings and objects missing `passwordHash`; assert `validateCredentialsFile()` throws for each
    - Export a pure `validateCredentialsFile(parsed)` helper from the server module (or test it directly) so it can be unit-tested without side effects
    - _Requirements: 2.11_

  - [x] 2.3 Write property test for bcrypt hash format (Property 13)
    - In `server/__tests__/auth.test.js`, write a fast-check property test:
      ```js
      // Feature: user-authentication, Property 13: Stored password is always a bcrypt hash, never plaintext
      ```
    - For arbitrary non-empty password strings (length 1–128), assert the hash starts with `"$2b$"` and does not equal the input
    - _Requirements: 6.1, 6.2_

- [x] 3. Implement in-memory session token store and `requireAuth` middleware
  - [x] 3.1 Add session token store and `requireAuth` middleware to `server/server.js`
    - Declare `const sessionTokens = new Map()` at module level (after existing module-level vars)
    - Implement `requireAuth(req, res, next)` exactly as specified in the design: check `req.cookies?.session`, look up in `sessionTokens`, check age ≤ 24 h (delete expired token, return 401), call `next()` on success
    - Register `cookie-parser` middleware: `app.use(require('cookie-parser')())`  — add this before route definitions
    - Apply `requireAuth` to the three protected routes: `GET /api/option-chain`, `GET /api/expiry-dates`, `POST /api/refresh-session`
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [x] 3.2 Write property test for `requireAuth` — invalid/absent session (Property 1)
    - In `server/__tests__/auth.test.js`, write a fast-check property test:
      ```js
      // Feature: user-authentication, Property 1: Unauthenticated or invalid session always returns 401
      ```
    - For each protected route, generate arbitrary token strings not present in `sessionTokens`; assert each returns 401 with an `"error"` field and no option chain data
    - _Requirements: 1.1, 1.7_

  - [x] 3.3 Write property test for session age boundary (Property 2)
    - In `server/__tests__/auth.test.js`, write two fast-check property tests:
      ```js
      // Feature: user-authentication, Property 2: Session validity is determined solely by token age
      ```
    - For ages 0–(24 h − 1 ms): assert protected route returns non-401
    - For ages ≥ 24 h: assert protected route returns 401
    - _Requirements: 1.5, 1.6_

- [x] 4. Implement `POST /api/auth/login` route
  - [x] 4.1 Add login route with rate limiting to `server/server.js`
    - `require('express-rate-limit')` and create a limiter: `windowMs: 60_000`, `max: 10`, `standardHeaders: true`, `legacyHeaders: false`, JSON error body `{ error: 'Too many login attempts. Try again in a minute.' }`
    - Add `app.use(express.json())` if not already present
    - Implement `POST /api/auth/login`: validate `password` field present (400 if missing/empty); re-read `auth.json` on each login call (to pick up password changes without restart); compare with `bcrypt.compare`; on failure return 401 `{ error: 'Invalid password.' }`; on success generate a 32-byte `crypto.randomBytes(32).toString('hex')` token, store in `sessionTokens` with `{ createdAt: Date.now() }`, set cookie `session=<token>; HttpOnly; SameSite=Strict; Max-Age=86400; Path=/`, return 200 `{}`
    - Apply the rate limiter only to this route
    - _Requirements: 2.2, 2.3, 2.4, 2.9, 2.12, 6.3_

  - [x] 4.2 Write property test for wrong password never creates a session (Property 3)
    - In `server/__tests__/auth.test.js`, write a fast-check property test:
      ```js
      // Feature: user-authentication, Property 3: Wrong password never creates a session
      ```
    - For arbitrary strings that do not equal the correct password, assert `POST /api/auth/login` returns 401 and `sessionTokens.size` is unchanged
    - _Requirements: 2.4_

  - [x] 4.3 Write property test for token format and uniqueness (Property 9)
    - In `server/__tests__/auth.test.js`, write a fast-check property test:
      ```js
      // Feature: user-authentication, Property 9: Generated tokens are cryptographically formatted and unique
      ```
    - Generate two tokens via the token-generation helper; assert each is a 64-char hex string and the two are not equal
    - _Requirements: 5.3, 6.3_

- [x] 5. Implement `POST /api/auth/logout` and `GET /api/auth/status` routes
  - [x] 5.1 Add logout and status routes to `server/server.js`
    - `POST /api/auth/logout`: read `req.cookies?.session`; if token exists in `sessionTokens`, delete it; clear the cookie by setting `Max-Age=0`; always return 200 `{}`
    - `GET /api/auth/status`: read `req.cookies?.session`; look up in `sessionTokens`; check age ≤ 24 h; return 200 `{ authenticated: true }` if valid, 401 `{ error: 'Not authenticated.' }` otherwise
    - _Requirements: 1.5, 3.3, 3.5, 4.1, 4.2, 4.3, 4.8_

  - [x] 5.2 Write property test for logout removes token (Property 7)
    - In `server/__tests__/auth.test.js`, write a fast-check property test:
      ```js
      // Feature: user-authentication, Property 7: Logout removes the token from the session store
      ```
    - For arbitrary 64-char hex tokens inserted directly into `sessionTokens`, assert `POST /api/auth/logout` with that cookie removes the token and returns 200
    - _Requirements: 3.3_

- [x] 6. Implement password reset routes (`request-reset` and `reset-password`)
  - [x] 6.1 Add `POST /api/auth/request-reset` to `server/server.js`
    - Generate a 32-byte hex reset token; read current `auth.json`; write back with `resetToken` and `resetTokenTimestamp: Date.now()` fields added (overwriting any previous reset token); respond 200 with `{ message: '...', credentialsFilePath: AUTH_FILE_PATH }`
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 6.2 Add `POST /api/auth/reset-password` to `server/server.js`
    - Validate `newPassword` length (8–128); return 400 with length error if invalid
    - Read `auth.json`; validate `token` matches `resetToken` and `resetTokenTimestamp` is within 15 minutes; return 400 with expiry error if invalid
    - Hash `newPassword` with bcrypt cost 10; write updated `auth.json` atomically (write to a temp file then rename) with new `passwordHash` and no `resetToken`/`resetTokenTimestamp` fields; clear all entries from `sessionTokens`; return 200
    - On any failure during hash/write/session-clear, return 500 identifying the failed operation; do not partially commit
    - _Requirements: 5.4, 5.5, 5.6, 5.7, 5.8, 5.9_

  - [x] 6.3 Write property test for invalid reset tokens always rejected (Property 11)
    - In `server/__tests__/auth.test.js`, write a fast-check property test:
      ```js
      // Feature: user-authentication, Property 11: Invalid reset tokens are always rejected
      ```
    - For arbitrary token strings that do not match the stored reset token, assert `POST /api/auth/reset-password` returns 400 and `auth.json` is unchanged
    - _Requirements: 5.7, 5.8_

  - [x] 6.4 Write property test for out-of-range passwords rejected at reset (Property 12)
    - In `server/__tests__/auth.test.js`, write a fast-check property test:
      ```js
      // Feature: user-authentication, Property 12: Out-of-range passwords are rejected at reset time
      ```
    - For passwords shorter than 8 or longer than 128 characters, assert `POST /api/auth/reset-password` returns 400 and `auth.json` is unchanged
    - _Requirements: 5.9_

  - [x] 6.5 Write property test for successful reset postconditions (Property 10)
    - In `server/__tests__/auth.test.js`, write a fast-check property test:
      ```js
      // Feature: user-authentication, Property 10: Successful password reset satisfies all postconditions
      ```
    - For arbitrary valid new passwords (8–128 chars), run the full reset flow; assert new password authenticates, old session tokens return 401, and `auth.json` has no `resetToken` field
    - _Requirements: 5.5_

- [x] 7. Restrict CORS to localhost origins
  - [x] 7.1 Update CORS configuration in `server/server.js`
    - Replace `app.use(cors())` with a configured `cors({ origin: /^http:\/\/localhost(:\d+)?$/ })` call so only `http://localhost` origins (with any port) are accepted; all other origins receive a CORS rejection
    - _Requirements: 1.8_

- [x] 8. Checkpoint — server implementation complete
  - Run `npm test` in `server/` and ensure all server tests pass
  - Verify `GET /health` still returns 200 without a session cookie

- [x] 9. Implement `LoginForm.jsx` component
  - [x] 9.1 Create `client/src/components/LoginForm.jsx`
    - Functional component accepting props: `onLoginSuccess`, `sessionExpired`, `credentialsFilePath`, `onCredentialsPathReceived`, `resetPasswordLink` (optional ReactNode — when provided, replaces the inline "Forgot password?" toggle)
    - Internal state: `password` (string), `error` (string), `loading` (boolean), `showResetPanel` (boolean, only used when `resetPasswordLink` is absent)
    - Render a `<form>` with a password `<input>` (`type="password"`, `maxLength={128}`, controlled by `password` state) and a `<button type="submit">Login</button>`
    - On submit: if `password` is empty, set `error` to an inline validation message and return without making a network request (Requirement 2.7)
    - On submit with non-empty password: set `loading = true`; call `POST /api/auth/login` with `{ password }` and a 10-second `AbortController` timeout; on 200 call `onLoginSuccess()`; on 401 set `error` to the server's `error` field; on network error or timeout set `error` to an inline message without clearing `password`; always set `loading = false`
    - Render `error` as a `<p>` element below the password input when non-empty
    - When `sessionExpired` prop is true, render a "Session expired. Please log in again." message above the form
    - When `resetPasswordLink` is provided, render it in place of the "Forgot password?" button; when absent, render the inline toggle button and reset panel
    - Disable the submit button while `loading` is true
    - _Requirements: 2.1, 2.2, 2.5, 2.6, 2.7, 2.8, 5.10_

  - [x] 9.2 Write property test for login form transmits exact password (Property 4)
    - In `client/src/__tests__/LoginForm.test.jsx`, write a fast-check + React Testing Library property test:
      ```js
      // Feature: user-authentication, Property 4: Login form transmits the exact entered password
      ```
    - For arbitrary non-empty strings (length 1–128), type into the password input, submit, assert exactly one `POST /api/auth/login` request was made with `{ password: <that string> }` in the body
    - _Requirements: 2.2_

  - [x] 9.3 Write property test for server error messages surfaced verbatim (Property 5)
    - In `client/src/__tests__/LoginForm.test.jsx`, write a fast-check + React Testing Library property test:
      ```js
      // Feature: user-authentication, Property 5: Server error messages are surfaced verbatim in the login form
      ```
    - For arbitrary non-empty error message strings, mock `POST /api/auth/login` to return 401 with `{ error: <message> }`; assert the exact string appears below the password input
    - _Requirements: 2.5_

- [x] 10. Refactor client to React Router v6 with page-based architecture
  - [x] 10.1 Create `client/src/AuthContext.jsx`
    - Extract all auth state and logic from `App.jsx` into a React Context provider
    - State: `authStatus` (`'loading' | 'authenticated' | 'unauthenticated'`), `sessionExpired` (boolean), `credentialsFilePath` (string | null)
    - On mount: fire `GET /api/auth/status` with 10-second `AbortController` timeout; set `authStatus` based on response
    - Register axios response interceptor: on 401 while `authStatus === 'authenticated'`, set `sessionExpired = true` and `authStatus = 'unauthenticated'`
    - Export `handleLoginSuccess()`, `handleLogout()`, `setCredentialsFilePath`, and `useAuth()` hook
    - `handleLogout()`: call `POST /api/auth/logout`, then regardless of response set `authStatus = 'unauthenticated'`, clear `sessionExpired`, remove `oiHistory` from localStorage
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 3.2, 3.4, 3.6_

  - [x] 10.2 Create `client/src/pages/LoginPage.jsx`
    - Route: `/login`
    - Reads `handleLoginSuccess`, `sessionExpired`, `credentialsFilePath`, `setCredentialsFilePath` from `useAuth()`
    - On login success: calls `handleLoginSuccess()` then `navigate('/', { replace: true })`
    - Passes `<Link to="/reset-password" className="login-forgot-btn">Forgot password?</Link>` as the `resetPasswordLink` prop to `LoginForm`
    - _Requirements: 2.1, 2.6, 4.3, 5.10_

  - [x] 10.3 Create `client/src/pages/ResetPasswordPage.jsx`
    - Route: `/reset-password`
    - Step 1: "Generate Reset Token" button calls `POST /api/auth/request-reset`; displays `credentialsFilePath` and curl command
    - Step 2: form with reset token input, new password, confirm password; submits to `POST /api/auth/reset-password`; validates password length (8–128) and match client-side before sending
    - On success: shows confirmation screen with `<Link to="/login">Back to Login</Link>`
    - _Requirements: 5.1, 5.4, 5.9, 5.10_

  - [x] 10.4 Create `client/src/pages/HomePage.jsx`
    - Route: `/` (protected)
    - Move all option chain data state and fetching logic from `App.jsx` into this page: `optionChainData`, `underlyingValue`, `history`, `itemChainData`, `expiryDates`, `selectedExpiry`, `lastFetch`, countdown
    - Read `handleLogout` from `useAuth()` and pass to `<Header>`
    - _Requirements: 1.2, 3.1, 3.4_

  - [x] 10.5 Rewrite `client/src/App.jsx` as router shell
    - Define `RequireAuth` guard: if `authStatus === 'unauthenticated'` navigate to `/login`; if `'loading'` show loading indicator
    - Define `RedirectIfAuthenticated` guard: if `authStatus === 'authenticated'` navigate to `/`; if `'loading'` show loading indicator
    - Register three routes: `/login` → `LoginPage`, `/reset-password` → `ResetPasswordPage`, `/` → `HomePage` (wrapped in `RequireAuth`)
    - Catch-all `*` redirects to `/`
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 10.6 Update `client/src/main.jsx`
    - Wrap `<App>` in `<BrowserRouter>` and `<AuthProvider>` so all pages have access to the router and auth context
    - _Requirements: 4.1_

- [x] 11. Update `Header.jsx` to render the Logout button
  - [x] 11.1 Add `onLogout` prop and Logout button to `Header.jsx`
    - Add `onLogout` to the destructured props of `Header`
    - Inside the `<div className="controls">`, render `{onLogout && <button className="logout-btn" onClick={onLogout}>Logout</button>}` so the button only appears when the prop is provided (i.e., when authenticated)
    - Add minimal CSS for `.logout-btn` in `App.css` (consistent with existing control styles)
    - _Requirements: 3.1, 3.2_

- [x] 12. Update client tests for router-based architecture
  - [x] 12.1 Update `client/src/__tests__/App.auth.test.jsx` for router context
    - Wrap all renders with `<MemoryRouter>` + `<AuthProvider>` instead of rendering `<App>` directly (which now requires a router context for `useNavigate`)
    - Add example-based tests for: loading indicator while status is pending; redirect to `/login` on 401; redirect to `/` when already authenticated and visiting `/login`; `ResetPasswordPage` renders at `/reset-password`
    - Keep Property 8 test (mid-session 401 triggers session-expired login form) — update to use the new render helper
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.7_

  - [x] 12.2 Add example-based tests for `ResetPasswordPage`
    - In a new `client/src/__tests__/ResetPasswordPage.test.jsx` file
    - Test: "Generate Reset Token" button calls `POST /api/auth/request-reset` and shows credentials file path
    - Test: submitting with mismatched passwords shows inline error without making a network request
    - Test: submitting with password shorter than 8 chars shows inline error without making a network request
    - Test: successful reset shows confirmation screen with "Back to Login" link
    - Test: server error on reset-password is displayed inline
    - _Requirements: 5.1, 5.4, 5.9, 5.10_

- [x] 13. Checkpoint — full feature wired together
  - Run `npm test` in both `server/` and `client/` and ensure all tests pass
  - Verify the full session lifecycle manually: start server → navigate to `/` → redirected to `/login` → login → redirected to `/` → option chain visible → logout → redirected to `/login`
  - Verify password reset flow: click "Forgot password?" → navigate to `/reset-password` → generate token → reset password → redirected to `/login`

- [x] 14. Migrate client UI to Semantic UI React
  - [x] 14.1 Install `semantic-ui-react` and `semantic-ui-css` in `client/`
    - `npm install semantic-ui-react semantic-ui-css`
    - Import `semantic-ui-css/semantic.min.css` in `main.jsx` (before `style.css`)
    - _No requirements — UI library upgrade_

  - [x] 14.2 Migrate `Header.jsx` to Semantic UI React
    - Replace plain HTML header with `Menu` (inverted, stackable)
    - Brand item: `Menu.Item header` with logo image
    - Window selector: `Dropdown` (compact, selection) inside `Menu.Item`
    - Expiry selector: `Dropdown` (compact, selection) inside `Menu.Item`
    - Underlying value: `Label` (large, blue) inside `Menu.Item`
    - Countdown ring: keep custom SVG (no SUI equivalent)
    - Logout: `Button` (inverted, small) inside `Menu.Menu position="right"`

  - [x] 14.3 Migrate `LoginForm.jsx` to Semantic UI React
    - Outer wrapper: `.login-page-wrapper` div (full-viewport centred, defined in `App.css`)
    - Session-expired banner: `Message warning`
    - Card: `Segment raised`
    - Title: `Header as="h2"` (color="blue", textAlign="center")
    - Form: `Form` with `Form.Field` for the password input
    - Error display: `Message error`
    - Submit: `Button` (primary, fluid, loading prop)
    - "Forgot password?" toggle / link: `Button basic small` or router `<Link>` via `resetPasswordLink` prop
    - Inline reset panel: `Message info` with `<pre className="login-reset-curl">` and `<code className="login-reset-path">`

  - [x] 14.4 Migrate `ResetPasswordPage.jsx` to Semantic UI React
    - Outer wrapper: `.login-page-wrapper` div
    - Card: `Segment raised`
    - Title: `Header as="h2"` (color="blue")
    - Progress: `Step.Group` with two steps (Generate Token / Set Password)
    - Step 1 button: `Button primary fluid` with `Icon name="key"`
    - Step 1 result: `Message info` showing file path and curl command
    - Step 2 form: `Form` with `Form.Field` for token, new password, confirm password
    - Error: `Message error`
    - Submit: `Button primary fluid` with `Icon name="lock"`
    - Success screen: `Icon check circle`, `Header`, `Button as={Link}`
    - Back to Login: plain `<Link>` styled with SUI link colour

  - [x] 14.5 Migrate `Summary.jsx` to Semantic UI React
    - Replace custom div boxes with `Statistic.Group` (widths="two", size="small") inside a `Segment`
    - Use `Statistic color` prop ("green"/"red") for positive/negative values

  - [x] 14.6 Migrate `OptionTable.jsx` to Semantic UI React
    - Replace plain `<table>` with `Table` (celled, structured, compact, textAlign="center")
    - Use `Table.Header`, `Table.Row`, `Table.HeaderCell`, `Table.Body`, `Table.Cell`
    - Keep custom CSS classes for cell-level colours: `.oi-positive`, `.oi-negative`, `.strike-cell`, `.iv-cell`, `.vol-highlight`, `.vol-cell`, `.atm-row`, `.calls-header`, `.puts-header`

  - [x] 14.7 Migrate `OIHistory.jsx` to Semantic UI React
    - Replace custom divs with `Grid columns={2}` + `Grid.Column`
    - Each column: `Segment` with `Header as="h4"` (dividing) and `List` (divided, relaxed)
    - Each history item: `List.Item` with `List.Content floated="right"` for the value

  - [x] 14.8 Update `HomePage.jsx` and `App.jsx` loading indicators
    - Replace `<div className="loading">` with `<Loader active size="large">` from SUI
    - Wrap option chain content in `Container fluid`

  - [x] 14.9 Slim down `App.css` and `style.css`
    - `App.css`: keep only styles SUI cannot express (ATM row tint, OI change colours, strike/IV/volume cell styles, countdown SVG, `.login-page-wrapper`, `.login-reset-curl`, `.login-reset-path`)
    - `style.css`: remove normalize.css CDN import (SUI provides its own reset); keep only CSS variables and body defaults

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- All server code is added to the existing `server/server.js` single-file convention
- `cookie-parser` must be registered before any route that reads `req.cookies`
- The axios interceptor in `AuthContext.jsx` must be set up before the first data fetch to catch mid-session 401s
- Property tests use a minimum of 100 runs each and are tagged with the property number from the design document
- Tests that render `<App>` must wrap it in `<MemoryRouter initialEntries={['/']}>` + `<AuthProvider>` because `App.jsx` is now a pure router shell that uses `useNavigate`
- `LoginForm.jsx` is backward-compatible: when `resetPasswordLink` is not provided, the original inline reset panel toggle is used

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1"] },
    { "id": 1, "tasks": ["2.2", "2.3", "3.1"] },
    { "id": 2, "tasks": ["3.2", "3.3", "4.1"] },
    { "id": 3, "tasks": ["4.2", "4.3", "5.1"] },
    { "id": 4, "tasks": ["5.2", "6.1"] },
    { "id": 5, "tasks": ["6.2", "7.1"] },
    { "id": 6, "tasks": ["6.3", "6.4", "6.5", "9.1"] },
    { "id": 7, "tasks": ["9.2", "9.3", "10.1"] },
    { "id": 8, "tasks": ["10.2", "10.3", "10.4", "11.1"] },
    { "id": 9, "tasks": ["10.5", "10.6"] },
    { "id": 10, "tasks": ["12.1"] },
    { "id": 11, "tasks": ["12.2"] },
    { "id": 12, "tasks": ["13"] },
    { "id": 13, "tasks": ["14.1", "14.2", "14.3", "14.4", "14.5", "14.6", "14.7", "14.8", "14.9"] }
  ]
}
```
