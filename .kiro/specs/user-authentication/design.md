# Design Document: User Authentication

## Overview

This document describes the technical design for adding password-based authentication to the NSE Option Chain Viewer. The app is a single-user, localhost-only tool, so the authentication model is intentionally simple: one password, one active session at a time, no user accounts, no email service.

The goals are:

- Block unauthenticated access to all data API routes (option chain, expiry dates, session refresh)
- Provide a login form that gates the entire UI
- Persist the session across page reloads via an HTTP-only cookie
- Allow password reset by reading a token written to a local file on disk
- Store the password as a bcrypt hash; never store plaintext

### Scope boundaries

| In scope | Out of scope |
|---|---|
| Single-password protection of localhost server | Multi-user accounts |
| HTTP-only session cookie (24 h TTL) | OAuth / SSO |
| bcrypt password hashing | Email-based reset |
| Local file–based password reset | Cloud deployment |
| Rate limiting on login endpoint | Audit logging |

---

## Architecture

The feature spans both packages in the monorepo. `react-router-dom` v6 is added to the client; new auth npm dependencies are added to the server.

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (localhost)                                        │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  React App (client/src)                              │  │
│  │                                                      │  │
│  │  main.jsx                                            │  │
│  │    └─ <BrowserRouter>                                │  │
│  │         └─ <AuthProvider>   (AuthContext.jsx)        │  │
│  │              └─ <App>       (router shell)           │  │
│  │                                                      │  │
│  │  Routes (App.jsx):                                   │  │
│  │    /login          → LoginPage.jsx                   │  │
│  │    /reset-password → ResetPasswordPage.jsx           │  │
│  │    /               → HomePage.jsx  [RequireAuth]     │  │
│  │                                                      │  │
│  │  AuthContext.jsx owns:                               │  │
│  │    authStatus ('loading'|'authenticated'|            │  │
│  │                'unauthenticated')                    │  │
│  │    sessionExpired (boolean)                          │  │
│  │    axios 401 interceptor                             │  │
│  │    handleLogout()                                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                        │ axios (HTTP-only cookie auto-sent) │
└────────────────────────┼────────────────────────────────────┘
                         │ HTTP / localhost:3000
┌────────────────────────┼────────────────────────────────────┐
│  Express Server (server/server.js)                          │
│                                                             │
│  ┌─────────────────┐  ┌──────────────────────────────────┐ │
│  │  Auth Middleware │  │  Auth Routes                     │ │
│  │  requireAuth()  │  │  POST /api/auth/login             │ │
│  │                 │  │  POST /api/auth/logout            │ │
│  └────────┬────────┘  │  GET  /api/auth/status           │ │
│           │           │  POST /api/auth/request-reset    │ │
│           │           │  POST /api/auth/reset-password   │ │
│           ▼           └──────────────────────────────────┘ │
│  Protected Routes                                           │
│  GET  /api/option-chain                                     │
│  GET  /api/expiry-dates                                     │
│  POST /api/refresh-session                                  │
│                                                             │
│  ┌──────────────────┐  ┌──────────────────────────────┐    │
│  │  In-memory       │  │  Credentials File            │    │
│  │  Token Store     │  │  server/auth.json            │    │
│  │  (Map)           │  │  { passwordHash, resetToken, │    │
│  └──────────────────┘  │    resetTokenTimestamp }     │    │
│                        └──────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Data flow — login

1. Browser navigates to `/login` → `LoginPage` renders `LoginForm`
2. User submits password; `LoginForm` calls `POST /api/auth/login` with `{ password }`
3. Server compares against bcrypt hash in `auth.json`
4. On success: server sets an HTTP-only `SameSite=Strict` cookie named `session`, responds 200
5. `LoginPage` calls `handleLoginSuccess()` from `AuthContext`, which sets `authStatus = 'authenticated'` and navigates to `/`
6. `RequireAuth` guard allows `HomePage` to render

### Data flow — session check on mount

1. `AuthContext` mounts → sends `GET /api/auth/status` with a 10-second timeout
2. Server reads the `session` cookie, looks it up in the token Map, checks age ≤ 24 h
3. Returns 200 (valid) or 401 (missing/expired/invalid)
4. `authStatus` is set to `'authenticated'` or `'unauthenticated'`
5. `RequireAuth` / `RedirectIfAuthenticated` guards route the user to the correct page

### Data flow — password reset

1. User clicks "Forgot password?" on `LoginPage` → React Router navigates to `/reset-password`
2. `ResetPasswordPage` Step 1: user clicks "Generate Reset Token" → calls `POST /api/auth/request-reset`
3. Server generates a 32-byte hex reset token, writes it + timestamp to `auth.json`, responds with the file path
4. Page displays the credentials file path and instructions to copy the token
5. `ResetPasswordPage` Step 2: user pastes the token and enters a new password → calls `POST /api/auth/reset-password` with `{ token, newPassword }`
6. Server validates token (match + age ≤ 15 min), hashes new password, atomically rewrites `auth.json`, invalidates all sessions
7. On success, page shows a confirmation with a "Back to Login" link → navigates to `/login`

---

## Components and Interfaces

### Server-side additions (`server/server.js`)

All new server code is added to the existing single-file server following the project convention.

#### New npm dependencies (server)

| Package | Purpose |
|---|---|
| `bcrypt` | Password hashing (cost factor ≥ 10) |
| `cookie-parser` | Parse the `session` cookie from incoming requests |
| `express-rate-limit` | Rate-limit `POST /api/auth/login` to 10 req/min/IP |

#### In-memory token store

```js
// Map<token: string, { createdAt: number }>
const sessionTokens = new Map();
```

Tokens are never written to disk. On server restart the Map is empty, so all previously issued cookies become invalid (→ 401).

#### `requireAuth` middleware

```js
function requireAuth(req, res, next) {
  const token = req.cookies?.session;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  const entry = sessionTokens.get(token);
  if (!entry) return res.status(401).json({ error: 'Invalid session' });

  const age = Date.now() - entry.createdAt;
  if (age > 24 * 60 * 60 * 1000) {
    sessionTokens.delete(token);
    return res.status(401).json({ error: 'Session expired' });
  }

  next();
}
```

Applied to: `GET /api/option-chain`, `GET /api/expiry-dates`, `POST /api/refresh-session`.

#### Auth routes

| Method | Path | Auth required | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | No | Validate password, issue session cookie |
| `POST` | `/api/auth/logout` | No (graceful) | Invalidate token, clear cookie |
| `GET` | `/api/auth/status` | No (reads cookie) | Return 200/401 based on session validity |
| `POST` | `/api/auth/request-reset` | No | Generate reset token, write to auth.json |
| `POST` | `/api/auth/reset-password` | No | Validate reset token, update password hash |

#### Credentials file (`server/auth.json`)

```json
{
  "passwordHash": "$2b$10$...",
  "resetToken": "a3f9...",
  "resetTokenTimestamp": 1700000000000
}
```

`resetToken` and `resetTokenTimestamp` are absent when no reset is pending. The file is read on startup and on every login attempt (to pick up password changes without restart).

#### Startup behaviour

```
server starts
  └─ auth.json exists?
       ├─ yes → parse JSON
       │         ├─ valid → proceed
       │         └─ malformed / missing fields → log error + process.exit(1)
       └─ no  → create with default hash for "admin"
                 log WARNING: "auth.json created at <path>. Change the default password."
```

### Client-side additions

#### New npm dependencies (client)

| Package | Purpose |
|---|---|
| `react-router-dom` v6 | Page-based routing with `BrowserRouter`, `Routes`, `Route`, `Navigate`, `Link`, `useNavigate` |

#### New file: `AuthContext.jsx`

Location: `client/src/AuthContext.jsx`

Provides auth state and handlers to the entire app via React Context. Consumed with the `useAuth()` hook.

Exported state and handlers:

| Name | Type | Description |
|---|---|---|
| `authStatus` | `'loading' \| 'authenticated' \| 'unauthenticated'` | Drives route guards |
| `sessionExpired` | `boolean` | Set to true when a mid-session 401 is detected |
| `credentialsFilePath` | `string \| null` | Populated from `POST /api/auth/request-reset` response |
| `setCredentialsFilePath` | `(path: string) => void` | Setter passed to pages that call request-reset |
| `handleLoginSuccess()` | `() => void` | Sets `authStatus = 'authenticated'`, clears `sessionExpired` |
| `handleLogout()` | `() => void` | Calls `POST /api/auth/logout`, sets `authStatus = 'unauthenticated'`, clears localStorage |

Behaviour on mount: fires `GET /api/auth/status` with a 10-second `AbortController` timeout. Sets `authStatus` based on response.

Axios interceptor: registered once; when a 401 arrives while `authStatus === 'authenticated'`, sets `sessionExpired = true` and `authStatus = 'unauthenticated'`.

#### Updated file: `App.jsx` (router shell)

`App.jsx` is now a pure router shell. It defines three routes and two auth guard wrappers:

- `RequireAuth` — if `authStatus === 'unauthenticated'`, navigates to `/login`; if `'loading'`, shows a loading indicator
- `RedirectIfAuthenticated` — if `authStatus === 'authenticated'`, navigates to `/`; if `'loading'`, shows a loading indicator

#### New page: `LoginPage.jsx`

Location: `client/src/pages/LoginPage.jsx`

Route: `/login`

Renders `LoginForm`. On login success, calls `handleLoginSuccess()` from `AuthContext` then navigates to `/` via `useNavigate`. Passes a `<Link to="/reset-password">` as the `resetPasswordLink` prop so the "Forgot password?" button navigates to the reset page.

#### New page: `ResetPasswordPage.jsx`

Location: `client/src/pages/ResetPasswordPage.jsx`

Route: `/reset-password`

Two-step password reset UI:

- **Step 1** — "Generate Reset Token" button calls `POST /api/auth/request-reset`. Displays the credentials file path and instructions to copy the `resetToken` value from `auth.json`.
- **Step 2** — Form with token input, new password, and confirm password fields. Submits to `POST /api/auth/reset-password`. On success, shows a confirmation screen with a "Back to Login" `<Link>`.

Internal state: `credentialsFilePath`, `tokenGenerated`, `token`, `newPassword`, `confirmPassword`, `resetSuccess`, loading/error states for each step.

#### New page: `HomePage.jsx`

Location: `client/src/pages/HomePage.jsx`

Route: `/` (protected via `RequireAuth`)

Contains all option chain data state and fetching logic previously in `App.jsx`: `optionChainData`, `underlyingValue`, `history`, `itemChainData`, `expiryDates`, `selectedExpiry`, `lastFetch`, countdown. Reads `handleLogout` from `AuthContext` and passes it to `Header`.

#### Updated component: `LoginForm.jsx`

New optional prop:

| Prop | Type | Description |
|---|---|---|
| `resetPasswordLink` | `ReactNode` | When provided, replaces the inline "Forgot password?" toggle button. `LoginPage` passes `<Link to="/reset-password">` here so navigation uses the router. When absent, the original inline reset panel toggle is used (backward-compatible). |

#### `Header.jsx` changes

Unchanged from the auth spec — receives `onLogout` prop and renders a "Logout" button when it is provided.

---

## Data Models

### Session token entry (in-memory only)

```js
{
  createdAt: number  // Date.now() at token creation
}
```

Stored in `sessionTokens` Map keyed by the token string (64-char hex).

### Credentials file schema

```ts
interface CredentialsFile {
  passwordHash: string;          // bcrypt hash, $2b$10$...
  resetToken?: string;           // 64-char hex, absent when no reset pending
  resetTokenTimestamp?: number;  // Unix ms timestamp of token generation
}
```

### Login request body

```json
{ "password": "string (1–128 chars)" }
```

### Login response (200)

```json
{}
```

Cookie set: `session=<token>; HttpOnly; SameSite=Strict; Max-Age=86400; Path=/`

### Login response (401)

```json
{ "error": "Invalid password" }
```

### Auth status response (200)

```json
{ "authenticated": true }
```

### Reset request response (200)

```json
{
  "message": "Reset token written to auth.json. Use it with POST /api/auth/reset-password within 15 minutes.",
  "credentialsFilePath": "/absolute/path/to/server/auth.json"
}
```

### Reset password request body

```json
{
  "token": "string (64-char hex)",
  "newPassword": "string (8–128 chars)"
}
```

### Reset password response (200)

```json
{ "message": "Password updated. All sessions have been invalidated." }
```

### Reset password response (400 — bad token)

```json
{ "error": "Reset token is invalid or has expired." }
```

### Reset password response (400 — bad password length)

```json
{ "error": "Password must be between 8 and 128 characters." }
```

### Reset password response (500 — partial failure)

```json
{ "error": "Password reset failed during <operation>. No changes were committed." }
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Unauthenticated or invalid session always returns 401

*For any* HTTP request to a protected route (`GET /api/option-chain`, `GET /api/expiry-dates`, `POST /api/refresh-session`) made with an absent, malformed, or unrecognized session cookie, the server SHALL return HTTP 401 with a JSON body containing an `"error"` field, and SHALL NOT return any option chain data.

**Validates: Requirements 1.1, 1.7**

---

### Property 2: Session validity is determined solely by token age

*For any* session token present in the in-memory store, the server SHALL allow the request to proceed if and only if the token's age is strictly less than 24 hours. A token with age ≥ 24 hours SHALL be treated as unauthenticated and return HTTP 401 on any protected route.

**Validates: Requirements 1.5, 1.6**

---

### Property 3: Wrong password never creates a session

*For any* password string that does not match the stored bcrypt hash, a `POST /api/auth/login` request SHALL return HTTP 401 with a JSON body containing an `"error"` field, and the in-memory session token store SHALL remain unchanged (no new token added).

**Validates: Requirements 2.4**

---

### Property 4: Login form transmits the exact entered password

*For any* non-empty password string entered into the `LoginForm`, submitting the form SHALL produce exactly one `POST /api/auth/login` request whose JSON body contains a `"password"` key with that exact string as its value.

**Validates: Requirements 2.2**

---

### Property 5: Server error messages are surfaced verbatim in the login form

*For any* error message string returned in a `401` response body from `POST /api/auth/login`, the `LoginForm` SHALL render that exact string as an inline message positioned below the password input field.

**Validates: Requirements 2.5**

---

### Property 6: Malformed credentials file always fails startup validation

*For any* string that is either not valid JSON or is valid JSON missing the `"passwordHash"` field, the server's credentials-file validation function SHALL throw an error (or return a failure result), preventing the server from starting normally.

**Validates: Requirements 2.11**

---

### Property 7: Logout removes the token from the session store

*For any* session token that exists in the in-memory token store, calling `POST /api/auth/logout` with that token's cookie SHALL remove the token from the store and return HTTP 200, regardless of whether any other sessions exist.

**Validates: Requirements 3.3**

---

### Property 8: Mid-session 401 triggers the session-expired login form

*For any* protected route that returns HTTP 401 while the client's `authStatus` is `"authenticated"`, the `Auth_Client` SHALL transition to `authStatus = "unauthenticated"` and render `LoginForm` with `sessionExpired = true`, displaying the session-expired message.

**Validates: Requirements 4.7**

---

### Property 9: Generated tokens are cryptographically formatted and unique

*For any* two independently generated tokens (session tokens or reset tokens), each SHALL be a hex-encoded string of exactly 64 characters (representing 32 bytes of entropy), and the two tokens SHALL NOT be equal to each other.

**Validates: Requirements 5.3, 6.3**

---

### Property 10: Successful password reset satisfies all postconditions

*For any* new password string of length between 8 and 128 characters (inclusive), after a successful `POST /api/auth/reset-password` with a valid reset token, ALL of the following SHALL hold:
- The new password authenticates successfully via `POST /api/auth/login`
- All session tokens that existed before the reset are rejected with HTTP 401
- `auth.json` does not contain a `"resetToken"` field

**Validates: Requirements 5.5**

---

### Property 11: Invalid reset tokens are always rejected

*For any* token string submitted to `POST /api/auth/reset-password` that either does not match the stored reset token or was generated more than 15 minutes ago, the server SHALL return HTTP 400 with a JSON body containing an `"error"` field, and `auth.json` SHALL remain unchanged.

**Validates: Requirements 5.7, 5.8**

---

### Property 12: Out-of-range passwords are rejected at reset time

*For any* password string whose length is less than 8 or greater than 128 characters, `POST /api/auth/reset-password` SHALL return HTTP 400 with a JSON body stating the length requirement, and `auth.json` SHALL remain unchanged.

**Validates: Requirements 5.9**

---

### Property 13: Stored password is always a bcrypt hash, never plaintext

*For any* password string that has been processed by the server's hashing function, the value written to `auth.json` under `"passwordHash"` SHALL start with the bcrypt prefix `"$2b$"` and SHALL NOT equal the original plaintext string.

**Validates: Requirements 6.1**

---

## Error Handling

### Server startup errors

| Condition | Behaviour |
|---|---|
| `auth.json` absent | Create with default hash for `"admin"`, log WARNING with file path, continue |
| `auth.json` present but malformed JSON | Log error with file path, `process.exit(1)` |
| `auth.json` present but missing `passwordHash` field | Log error with file path, `process.exit(1)` |
| `auth.json` present but unreadable (permission/I/O error) | Log error with file path, `process.exit(1)` |

### Login errors

| Condition | HTTP status | Response body |
|---|---|---|
| Missing or empty password | 400 | `{ "error": "Password is required." }` |
| Wrong password | 401 | `{ "error": "Invalid password." }` |
| Rate limit exceeded (> 10/min/IP) | 429 | `{ "error": "Too many login attempts. Try again in a minute." }` |
| `auth.json` read error during login | 500 | `{ "error": "Internal server error." }` |

### Session errors

| Condition | HTTP status | Response body |
|---|---|---|
| No session cookie | 401 | `{ "error": "Not authenticated." }` |
| Cookie present but token not in store | 401 | `{ "error": "Invalid session." }` |
| Token in store but age > 24 h | 401 | `{ "error": "Session expired." }` |

### Password reset errors

| Condition | HTTP status | Response body |
|---|---|---|
| Token missing or not matching stored value | 400 | `{ "error": "Reset token is invalid or has expired." }` |
| Token older than 15 minutes | 400 | `{ "error": "Reset token is invalid or has expired." }` |
| New password < 8 or > 128 chars | 400 | `{ "error": "Password must be between 8 and 128 characters." }` |
| File write failure during reset | 500 | `{ "error": "Password reset failed during <operation>. No changes were committed." }` |

### Client-side error handling

- **Network error on any auth request**: Display inline error message; do not clear the password field; do not change `authStatus`
- **10-second timeout on `GET /api/auth/status`**: Cancel request via `AbortController`, set `authStatus = 'unauthenticated'`, show `LoginForm`
- **Logout failure**: Regardless of server response or network error, set `authStatus = 'unauthenticated'` and clear all option chain state — the user must never be stuck in an authenticated UI state

---

## Testing Strategy

### Overview

This feature uses a dual testing approach: example-based unit tests for specific scenarios and property-based tests for universal correctness guarantees. The property-based testing library chosen for the server is **[fast-check](https://github.com/dubzzz/fast-check)** (JavaScript/Node.js, well-maintained, works with CommonJS). For the React client, **fast-check** is used alongside **React Testing Library**.

### Property-based test configuration

- Minimum **100 runs** per property test
- Each property test is tagged with a comment referencing the design property:
  ```js
  // Feature: user-authentication, Property 1: Unauthenticated or invalid session always returns 401
  ```

### Server unit tests (`server/__tests__/auth.test.js`)

**Example-based tests:**

- `POST /api/auth/login` with correct password → 200, cookie set with correct attributes (HttpOnly, SameSite=Strict, Max-Age=86400)
- `POST /api/auth/login` with empty password → 400
- `POST /api/auth/login` — 11th request from same IP within 1 minute → 429
- `GET /health` without session cookie → 200 (unprotected)
- `POST /api/auth/logout` without session cookie → 200
- `POST /api/auth/request-reset` → 200, `auth.json` contains `resetToken` and `resetTokenTimestamp`
- Two consecutive `POST /api/auth/request-reset` calls → second token overwrites first
- `POST /api/auth/reset-password` with file write mocked to fail → 500, `auth.json` unchanged
- Server startup without `auth.json` → file created, default password `"admin"` authenticates
- Server startup with malformed `auth.json` → startup validation throws
- After login, `auth.json` does not contain any session token field

**Property-based tests (fast-check):**

```
// Property 1
fc.property(fc.constantFrom(...protectedRoutes), fc.string(), (route, randomToken) =>
  // request with randomToken as cookie → 401 with error field
)

// Property 2
fc.property(fc.integer({ min: 0, max: 23 * 3600 * 1000 }), (ageMs) =>
  // token with age ageMs → protected route succeeds
)
fc.property(fc.integer({ min: 24 * 3600 * 1000 + 1, max: 48 * 3600 * 1000 }), (ageMs) =>
  // token with age ageMs → 401
)

// Property 3
fc.property(fc.string().filter(s => s !== correctPassword), (wrongPassword) =>
  // POST /api/auth/login with wrongPassword → 401, store unchanged
)

// Property 6
fc.property(fc.oneof(fc.string(), fc.record({ someOtherField: fc.string() })), (badContent) =>
  // validateCredentialsFile(badContent) throws
)

// Property 7
fc.property(fc.hexaString({ minLength: 64, maxLength: 64 }), (token) =>
  // add token to store, call logout → token removed, 200
)

// Property 9
// generate two tokens, verify 64-char hex and inequality

// Property 10
fc.property(fc.string({ minLength: 8, maxLength: 128 }), (newPassword) =>
  // full reset flow → new password authenticates, old sessions rejected, no resetToken in file
)

// Property 11
fc.property(fc.string().filter(s => s !== storedToken), (badToken) =>
  // POST /api/auth/reset-password with badToken → 400, file unchanged
)

// Property 12
fc.property(fc.oneof(fc.string({ maxLength: 7 }), fc.string({ minLength: 129 })), (badPassword) =>
  // POST /api/auth/reset-password with badPassword → 400, file unchanged
)

// Property 13
fc.property(fc.string({ minLength: 1, maxLength: 128 }), (password) =>
  // hashPassword(password) → starts with "$2b$", !== password
)
```

### Client unit tests (`client/src/__tests__/auth.test.jsx`)

**Example-based tests (React Testing Library):**

- `LoginForm` renders password input with `maxLength=128` and "Login" button when unauthenticated
- `LoginForm` shows "Forgot password?" panel with curl command when link is clicked
- `LoginForm` shows inline error when form submitted with empty password (no network request)
- `LoginForm` shows server error message below input on 401 response
- `LoginForm` retains password field value on network error
- `App` shows loading indicator while `GET /api/auth/status` is pending
- `App` shows option chain UI after `GET /api/auth/status` returns 200
- `App` shows `LoginForm` after `GET /api/auth/status` returns 401
- `App` shows `LoginForm` after `GET /api/auth/status` times out (10 s)
- `App` shows `LoginForm` after `GET /api/auth/status` network error
- `Header` renders "Logout" button when `onLogout` prop is provided
- Clicking "Logout" calls `POST /api/auth/logout`
- After successful logout, `LoginForm` is shown and option chain state is cleared
- After failed logout (network error), `LoginForm` is shown and state is cleared

**Property-based tests (fast-check + React Testing Library):**

```
// Property 4
fc.property(fc.string({ minLength: 1, maxLength: 128 }), (password) =>
  // type password, submit → POST body contains { password: <that string> }
)

// Property 5
fc.property(fc.string({ minLength: 1 }), (errorMessage) =>
  // mock 401 with { error: errorMessage } → LoginForm renders errorMessage below input
)

// Property 8
fc.property(fc.constantFrom(...protectedRoutes), (route) =>
  // while authenticated, route returns 401 → LoginForm shown with sessionExpired=true
)
```

### Integration tests

- Full login → access protected route → logout → protected route returns 401 (end-to-end session lifecycle)
- Server restart invalidates all previously issued session tokens
- CORS: request with non-localhost `Origin` header is rejected; localhost origin is accepted

### Test file locations

```
server/
  __tests__/
    auth.test.js        # Server auth unit + property tests

client/src/
  __tests__/
    LoginForm.test.jsx  # LoginForm component tests
    App.auth.test.jsx   # App-level auth state tests
```
