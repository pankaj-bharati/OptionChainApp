# Requirements Document

## Introduction

This feature adds a user authentication system to the NSE Option Chain Viewer — a single-user, localhost-only trading tool. The goal is to protect the local Express server from unauthorized access (e.g., other devices on the same LAN or accidental browser access) by requiring a password before the option chain data is visible.

The system covers five capabilities: password-protected access to all data routes, login with a password, logout to end the session, session persistence across page reloads, and password reset via a local configuration file. There is no email service, no cloud deployment, and no multi-user support.

## Glossary

- **Auth_Server**: The Express 4 backend (`server/server.js`) responsible for validating credentials, issuing session tokens, and enforcing route protection
- **Auth_Client**: The React 18 frontend (`client/src/App.jsx` and related components) responsible for rendering the login form and managing authenticated state
- **Session_Token**: A cryptographically random token stored server-side in memory and transmitted to the client as an HTTP-only, `SameSite=Strict` cookie, used to authenticate subsequent API requests
- **Credentials_File**: A local JSON file on disk (`server/auth.json`) that stores the hashed password and is the single source of truth for authentication configuration
- **Password_Hash**: A bcrypt hash of the user's password stored in the Credentials_File
- **Login_Form**: The UI component rendered when the user is not authenticated, containing a password input and submit button
- **Protected_Route**: Any API endpoint that requires a valid Session_Token cookie to respond with data
- **Reset_Token**: A one-time, time-limited token written to the Credentials_File by the server to facilitate password reset without an email service

## Requirements

### Requirement 1: Password-Protected Access

**User Story:** As a trader, I want the app to require a password before showing option chain data, so that other devices on my local network cannot access my trading tool without authorization.

#### Acceptance Criteria

1. WHEN an unauthenticated request is made to a Protected_Route, THE Auth_Server SHALL return HTTP 401 with a JSON body containing an `"error"` field.
2. WHEN the Auth_Client receives a 401 response from any Protected_Route, THE Auth_Client SHALL replace the option chain UI with the Login_Form such that no strike prices, OI values, or expiry dates are visible.
3. THE Auth_Server SHALL protect the following routes: `GET /api/option-chain`, `GET /api/expiry-dates`, `POST /api/refresh-session`.
4. THE Auth_Server SHALL leave the `GET /health` endpoint unprotected.
5. WHILE a valid Session_Token cookie is present and has not exceeded its maximum age of 24 hours, THE Auth_Server SHALL allow requests to Protected_Routes to proceed without re-authentication.
6. WHEN a Session_Token has exceeded its maximum age of 24 hours, THE Auth_Server SHALL treat the request as unauthenticated and return HTTP 401 on any Protected_Route request.
7. WHEN an invalid or malformed Session_Token cookie is submitted to a Protected_Route, THE Auth_Server SHALL return HTTP 401 with a JSON body containing an `"error"` field.
8. THE Auth_Server SHALL restrict CORS to `http://localhost` origins only, so that cross-origin requests from non-localhost origins are rejected.

---

### Requirement 2: Login

**User Story:** As a trader, I want to log in with a password, so that I can access the option chain viewer after the app starts.

#### Acceptance Criteria

1. IF the user is not authenticated, THEN THE Auth_Client SHALL render the Login_Form containing a single password input field (max 128 characters) and a submit button labeled "Login".
2. WHEN the user submits the Login_Form, THE Auth_Client SHALL send a `POST /api/auth/login` request with the entered password in the JSON request body under the key `"password"`.
3. WHEN valid credentials are submitted to `POST /api/auth/login`, THE Auth_Server SHALL respond with HTTP 200 and set a `session` cookie that is HTTP-only, `SameSite=Strict`, and expires after 24 hours.
4. WHEN invalid credentials are submitted to `POST /api/auth/login`, THE Auth_Server SHALL respond with HTTP 401 and a JSON body containing an `"error"` field, without creating a Session_Token.
5. WHEN THE Auth_Client receives an HTTP 401 response from `POST /api/auth/login`, THE Auth_Client SHALL display the error message returned by the server below the password input field.
6. WHEN login succeeds, THE Auth_Client SHALL hide the Login_Form and render the full option chain UI.
7. WHEN the password input is empty and the user submits the Login_Form, THE Auth_Client SHALL display an inline validation message below the password input field without sending a network request.
8. IF the login request fails with a network error or receives no response within 10 seconds, THEN THE Auth_Client SHALL display an inline error message below the password input field without clearing the password field.
9. THE Auth_Server SHALL compare submitted passwords against the Password_Hash stored in the Credentials_File using bcrypt.
10. IF the Credentials_File does not exist on server startup, THEN THE Auth_Server SHALL create it with a default Password_Hash for the password `"admin"`, log a warning to the console that includes the Credentials_File path and instructs the user to change the default password, and start normally.
11. IF the Credentials_File exists on server startup but contains malformed JSON or is missing required fields, THEN THE Auth_Server SHALL log the error with the Credentials_File path and exit with a non-zero exit code.
12. THE Auth_Server SHALL enforce a rate limit of 10 login attempts per minute per IP address on `POST /api/auth/login`; WHEN the limit is exceeded, THE Auth_Server SHALL respond with HTTP 429 and a JSON body containing an `"error"` field.

---

### Requirement 3: Logout

**User Story:** As a trader, I want to log out, so that I can secure the app when I step away from my machine.

#### Acceptance Criteria

1. IF the user is authenticated, THEN THE Auth_Client SHALL render a button labeled "Logout" in the Header component.
2. WHEN the user clicks the "Logout" button, THE Auth_Client SHALL send a `POST /api/auth/logout` request.
3. WHEN `POST /api/auth/logout` is called, THE Auth_Server SHALL remove the Session_Token from the in-memory token store, clear the session cookie by setting it to an expired value, and respond with HTTP 200.
4. WHEN logout succeeds, THE Auth_Client SHALL display the Login_Form and clear all cached option chain data from in-memory component state.
5. WHEN `POST /api/auth/logout` is called with no active session, THE Auth_Server SHALL still respond with HTTP 200 and attempt to clear the session cookie.
6. IF the logout request fails with a network error or a non-200 response, THEN THE Auth_Client SHALL still display the Login_Form and clear in-memory component state, so that the user cannot remain in an authenticated UI state.

---

### Requirement 4: Session Persistence Across Page Reloads

**User Story:** As a trader, I want my session to persist when I refresh the browser, so that I do not have to log in again every time I reload the page.

#### Acceptance Criteria

1. WHEN the Auth_Client mounts, THE Auth_Client SHALL send a `GET /api/auth/status` request to check whether a valid session exists before rendering either the Login_Form or the option chain UI.
2. WHEN `GET /api/auth/status` returns HTTP 200, THE Auth_Client SHALL proceed directly to the option chain UI without showing the Login_Form.
3. WHEN `GET /api/auth/status` returns HTTP 401, THE Auth_Client SHALL display the Login_Form.
4. WHILE the Auth_Client is waiting for the `GET /api/auth/status` response, THE Auth_Client SHALL display a loading indicator instead of either the Login_Form or the option chain UI.
5. IF the `GET /api/auth/status` request has not completed within 10 seconds, THEN THE Auth_Client SHALL cancel the request and display the Login_Form.
6. IF the `GET /api/auth/status` request fails with a network error, THEN THE Auth_Client SHALL display the Login_Form.
7. WHEN a 401 response is received from any Protected_Route while the user is already viewing the option chain UI, THE Auth_Client SHALL display the Login_Form with an inline message indicating the session has expired.
8. WHEN a valid Session_Token has been active for more than 24 hours, THE Auth_Server SHALL return HTTP 401 on `GET /api/auth/status`.

---

### Requirement 5: Password Reset via Local Configuration

**User Story:** As a trader, I want to reset my password using a local file on disk, so that I can regain access if I forget my password without needing an email service.

#### Acceptance Criteria

1. THE Auth_Server SHALL expose a `POST /api/auth/request-reset` endpoint that generates a Reset_Token, writes it to the Credentials_File under a `"resetToken"` key alongside its generation timestamp, and responds with HTTP 200 and a JSON body containing the absolute path to the Credentials_File and instructions to use the token with `POST /api/auth/reset-password`.
2. WHEN `POST /api/auth/request-reset` is called while a previous Reset_Token is still valid, THE Auth_Server SHALL overwrite the previous Reset_Token with the newly generated one, invalidating the old token.
3. WHEN `POST /api/auth/request-reset` is called, THE Auth_Server SHALL generate a Reset_Token using a cryptographically secure random number generator producing at least 32 bytes of entropy, encoded as a hex string.
4. THE Auth_Server SHALL expose a `POST /api/auth/reset-password` endpoint that accepts a `"token"` and a `"newPassword"` in the JSON request body.
5. WHEN a valid Reset_Token (matching the stored value, generated within the last 15 minutes, and not previously used) and a new password between 8 and 128 characters inclusive are submitted to `POST /api/auth/reset-password`, THE Auth_Server SHALL atomically hash the new password with bcrypt, update the Credentials_File, remove all active Session_Tokens from the in-memory token store, and remove the Reset_Token from the Credentials_File; THE Auth_Server SHALL respond with HTTP 200 only after all operations succeed.
6. IF any operation in the reset sequence (hashing, file write, session invalidation) fails, THEN THE Auth_Server SHALL respond with HTTP 500 and a JSON body identifying which operation failed, and SHALL NOT partially commit changes to the Credentials_File.
7. WHEN an invalid or expired Reset_Token is submitted to `POST /api/auth/reset-password`, THE Auth_Server SHALL respond with HTTP 400 and a JSON body stating the token is invalid or has expired.
8. THE Auth_Server SHALL treat a Reset_Token as expired if more than 15 minutes have elapsed since its generation timestamp stored in the Credentials_File.
9. IF the new password submitted to `POST /api/auth/reset-password` is fewer than 8 characters or more than 128 characters, THEN THE Auth_Server SHALL respond with HTTP 400 and a JSON body stating the password length requirement, without modifying the Credentials_File.
10. WHEN the user clicks a "Forgot password?" link on the Login_Form, THE Auth_Client SHALL display a panel showing the exact `curl` command to call `POST /api/auth/request-reset` (e.g., `curl -X POST http://localhost:3000/api/auth/request-reset`) and the absolute path to the Credentials_File where the Reset_Token will be written.

---

### Requirement 6: Credential Storage Security

**User Story:** As a trader, I want my password stored securely on disk, so that it cannot be trivially recovered if someone accesses my machine.

#### Acceptance Criteria

1. THE Auth_Server SHALL store only the bcrypt Password_Hash in the Credentials_File, never the plaintext password.
2. THE Auth_Server SHALL use a bcrypt cost factor of at least 10 when hashing passwords.
3. THE Auth_Server SHALL generate Session_Tokens using a cryptographically secure random number generator producing at least 32 bytes of entropy.
4. THE Auth_Server SHALL store active Session_Tokens in an in-memory Map only and SHALL NOT persist them to disk; WHEN the server process restarts, all previously issued Session_Tokens SHALL be invalidated, and any request using a token issued before the last restart SHALL receive HTTP 401.
5. IF the Credentials_File exists on server startup but cannot be read due to a file system error (e.g., permission denied, I/O error), THEN THE Auth_Server SHALL log the error with the Credentials_File path and exit with a non-zero exit code.
