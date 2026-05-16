const express = require('express');
const axiosLib = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const cheerio = require('cheerio');
const cors = require('cors');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

// Path to the credentials file on disk
// When running inside a packaged Electron app, auth.json is placed in
// process.resourcesPath (outside the asar archive) so it remains writable.
const AUTH_FILE_PATH = process.env.ELECTRON_RESOURCES_PATH
  ? require('path').join(process.env.ELECTRON_RESOURCES_PATH, 'auth.json')
  : path.join(__dirname, 'auth.json');

const app = express();
const port = 3000;

// ---------------------------------------------------------------------------
// Credential storage helpers
// ---------------------------------------------------------------------------

/**
 * Pure validation helper — throws if the parsed credentials object is missing
 * the required `passwordHash` field. Exported for unit testing.
 *
 * @param {unknown} parsed - The value parsed from auth.json
 * @throws {Error} When parsed is not an object or lacks `passwordHash`
 */
function validateCredentialsFile(parsed) {
    if (
        parsed === null ||
        typeof parsed !== 'object' ||
        Array.isArray(parsed) ||
        typeof parsed.passwordHash !== 'string' ||
        parsed.passwordHash.trim() === ''
    ) {
        throw new Error('Credentials file is missing required field: passwordHash');
    }
}

/**
 * Load credentials from auth.json, or create the file with a default "admin"
 * password hash if it does not exist yet.
 *
 * Exit codes:
 *   - I/O error reading an existing file  → process.exit(1)
 *   - Malformed JSON                       → process.exit(1)
 *   - Missing passwordHash field           → process.exit(1)
 *
 * @returns {{ passwordHash: string, [key: string]: unknown }}
 */
function loadOrCreateCredentials() {
    if (!fs.existsSync(AUTH_FILE_PATH)) {
        // File absent — create with default "admin" password
        const passwordHash = bcrypt.hashSync('admin', 10);
        const data = { passwordHash };
        fs.writeFileSync(AUTH_FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
        console.warn(
            `[AUTH] WARNING: auth.json was not found. A new credentials file has been created at:\n` +
            `  ${AUTH_FILE_PATH}\n` +
            `  The default password is "admin". Change it immediately using the password reset flow.`
        );
        return data;
    }

    // File exists — try to read it
    let raw;
    try {
        raw = fs.readFileSync(AUTH_FILE_PATH, 'utf8');
    } catch (err) {
        console.error(
            `[AUTH] ERROR: Could not read credentials file at ${AUTH_FILE_PATH}: ${err.message}`
        );
        process.exit(1);
    }

    // Try to parse JSON
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (err) {
        console.error(
            `[AUTH] ERROR: Credentials file at ${AUTH_FILE_PATH} contains malformed JSON: ${err.message}`
        );
        process.exit(1);
    }

    // Validate required fields
    try {
        validateCredentialsFile(parsed);
    } catch (err) {
        console.error(
            `[AUTH] ERROR: Credentials file at ${AUTH_FILE_PATH} is invalid: ${err.message}`
        );
        process.exit(1);
    }

    return parsed;
}

// Load (or create) credentials synchronously at startup
let credentials = loadOrCreateCredentials();

// ---------------------------------------------------------------------------
// In-memory session token store
// Map<token: string, { createdAt: number }>
// ---------------------------------------------------------------------------
const sessionTokens = new Map();

// ---------------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------------

/**
 * Express middleware that enforces authentication on protected routes.
 * Reads the `session` cookie, looks it up in `sessionTokens`, and checks
 * that the token is not older than 24 hours.
 */
function requireAuth(req, res, next) {
    const token = req.cookies?.session;
    if (!token) return res.status(401).json({ error: 'Not authenticated.' });

    const entry = sessionTokens.get(token);
    if (!entry) return res.status(401).json({ error: 'Invalid session.' });

    const age = Date.now() - entry.createdAt;
    if (age > 24 * 60 * 60 * 1000) {
        sessionTokens.delete(token);
        return res.status(401).json({ error: 'Session expired.' });
    }

    next();
}

// ---------------------------------------------------------------------------

// Enable CORS — restrict to localhost origins only (any port), allow credentials
// (credentials: true is required so the browser accepts Set-Cookie and sends
// the session cookie on subsequent requests when withCredentials: true is used)
app.use(cors({
    origin: /^http:\/\/localhost(:\d+)?$/,
    credentials: true,
}));

// Parse cookies (must be registered before any route that reads req.cookies)
app.use(require('cookie-parser')());

// Parse JSON request bodies
app.use(express.json());

// Store the latest option chain data and session info
let lastOptionChainData = null;
let lastSuccessfulFetch = null;
let sessionTimestamp = null;
let sessionRefreshPromise = null; // promise for in-flight session refresh to avoid concurrent refreshes

// Use a cookie jar and wrapped axios client so cookies persist like a browser
const cookieJar = new CookieJar();
const axios = wrapper(axiosLib.create({ jar: cookieJar, withCredentials: true }));

// Constants
const SESSION_REFRESH_INTERVAL = 10 * 60 * 1000; // Refresh session every 10 minutes
const RETRY_DELAYS = [1000, 2000, 5000, 10000]; // Retry delays in ms
const DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'en-US,en;q=0.9',
    'Connection': 'keep-alive',
    'sec-ch-ua': '"Chromium";v="118", "Google Chrome";v="118"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
};

// Function to get a fresh session
async function refreshSession(retryCount = 0) {
    // If a refresh is already in progress, return the same promise so callers wait for it
    if (sessionRefreshPromise) {
        console.log('Session refresh already in progress — waiting for existing refresh to complete');
        return sessionRefreshPromise;
    }

    // Store the in-flight promise so concurrent callers can await it
    sessionRefreshPromise = (async function doRefresh() {
    try {
        console.log('Refreshing NSE session (cookie-jar)...');
        // Initial GET to the root to set cookies
        await axios.get('https://www.nseindia.com', {
            headers: {
                ...DEFAULT_HEADERS,
                'Upgrade-Insecure-Requests': '1'
            }
        });

        // Optionally hit the option-chain page to further warm up cookies and any server-side state
        await axios.get('https://www.nseindia.com/option-chain', {
            headers: {
                ...DEFAULT_HEADERS,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Referer': 'https://www.nseindia.com'
            }
        });

        // Check that we have cookies in the jar for the domain
        const cookies = await cookieJar.getCookies('https://www.nseindia.com');
        if (!cookies || cookies.length === 0) {
            throw new Error('No cookies stored in cookie jar after refresh');
        }

        sessionTimestamp = Date.now();
        console.log('Session refreshed successfully; cookies in jar:', cookies.map(c => c.key).join(', '));
        return true;
    } catch (error) {
        console.error(`Session refresh attempt ${retryCount + 1} failed:`, error.message);
        if (retryCount < RETRY_DELAYS.length) {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[retryCount]));
            // clear in-flight promise temporarily so retry creates a new promise chain
            sessionRefreshPromise = null;
            try {
                return await refreshSession(retryCount + 1);
            } finally {
                // if the recursive retry set a new promise, keep it; otherwise clear
                // (the recursive call sets sessionRefreshPromise itself)
            }
        }
        // clear the in-flight promise before throwing so future attempts can start anew
        sessionRefreshPromise = null;
        throw error;
    }
    })();

    try {
        const result = await sessionRefreshPromise;
        // small delay to allow NSE to settle cookies (avoid immediate back-to-back requests)
        await new Promise(resolve => setTimeout(resolve, 300));
        return result;
    } finally {
        // clear the in-flight marker so future refreshes may run
        sessionRefreshPromise = null;
    }
}

// Function to fetch NSE option chain data
async function fetchOptionChainData(expiry = null, retryCount = 0) {
    try {
        // Always refresh session before fetching data
        await refreshSession();

        let finalExpiry;
        if (expiry) {
            finalExpiry = expiry;
        } else {
            // Fetch expiry dates
            const contractResponse = await axios.get('https://www.nseindia.com/api/option-chain-contract-info?symbol=NIFTY', {
                headers: {
                    ...DEFAULT_HEADERS,
                    'Accept': 'application/json, text/plain, */*',
                    'Referer': 'https://www.nseindia.com/option-chain',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            if (!contractResponse.data || !contractResponse.data.expiryDates || contractResponse.data.expiryDates.length === 0) {
                throw new Error('Invalid expiry dates received from NSE');
            }

            finalExpiry = contractResponse.data.expiryDates[0];
        }

        // Fetch option chain data with cookie-jar enabled axios client
        const response = await axios.get(`https://www.nseindia.com/api/option-chain-v3?type=Indices&symbol=NIFTY&expiry=${finalExpiry}`, {
            headers: {
                ...DEFAULT_HEADERS,
                'Accept': 'application/json, text/plain, */*',
                'Referer': 'https://www.nseindia.com/option-chain',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        if (!response.data || !response.data.records) {
            throw new Error('Invalid data received from NSE');
        }

        lastOptionChainData = response.data;
        lastSuccessfulFetch = Date.now();
        return response.data;

    } catch (error) {
        // Detailed logging to help diagnose API failures
        console.error(`Fetch attempt ${retryCount + 1} failed:`, error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            // Try to safely stringify response body if available
            try {
                console.error('Response data:', JSON.stringify(error.response.data).slice(0, 2000));
            } catch (e) {
                console.error('Response data (raw):', error.response.data);
            }
        }

        // If unauthorized or session error, force session refresh and retry
        if (error.response?.status === 401 || error.response?.status === 403) {
            sessionCookies = null;
            await refreshSession();
        }

        // Retry with exponential backoff if we haven't exhausted retries
        if (retryCount < RETRY_DELAYS.length) {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[retryCount]));
            return fetchOptionChainData(retryCount + 1);
        }

        // If all retries failed but we have any cached data, return it (stale fallback)
        if (lastOptionChainData && lastSuccessfulFetch) {
            console.warn('All fetch retries failed — returning cached data (may be stale)');
            return lastOptionChainData;
        }

        // No cached data available — propagate error to caller
        throw error;
    }
}

// ---------------------------------------------------------------------------
// Token generation helper
// ---------------------------------------------------------------------------

/**
 * Generate a cryptographically secure 32-byte random token encoded as hex.
 * Exported for unit testing (Property 9).
 *
 * @returns {string} 64-character hex string
 */
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

// ---------------------------------------------------------------------------
// Login rate limiter — 10 attempts per minute per IP (Requirement 2.12)
// ---------------------------------------------------------------------------
const loginRateLimiter = rateLimit({
    windowMs: 60_000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    // Skip rate limiting in test environment so tests don't exhaust the window
    // and the in-memory store timer doesn't prevent Jest from exiting.
    skip: () => process.env.NODE_ENV === 'test',
    handler: (req, res) => {
        res.status(429).json({ error: 'Too many login attempts. Try again in a minute.' });
    }
});

// ---------------------------------------------------------------------------
// Auth routes
// ---------------------------------------------------------------------------

/**
 * POST /api/auth/login
 * Validates the submitted password against the stored bcrypt hash.
 * Re-reads auth.json on every call so password changes take effect without restart.
 * On success: issues an HTTP-only session cookie and returns 200 {}.
 * On failure: returns 400 (missing password) or 401 (wrong password).
 */
app.post('/api/auth/login', loginRateLimiter, async (req, res) => {
    const { password } = req.body || {};

    // Validate that password field is present and non-empty
    if (!password || typeof password !== 'string' || password.trim() === '') {
        return res.status(400).json({ error: 'Password is required.' });
    }

    // Re-read auth.json on each login to pick up password changes without restart
    let currentCredentials;
    try {
        const raw = fs.readFileSync(AUTH_FILE_PATH, 'utf8');
        currentCredentials = JSON.parse(raw);
    } catch (err) {
        console.error(`[AUTH] ERROR: Could not read credentials file during login: ${err.message}`);
        return res.status(500).json({ error: 'Internal server error.' });
    }

    // Compare submitted password against stored bcrypt hash
    let match;
    try {
        match = await bcrypt.compare(password, currentCredentials.passwordHash);
    } catch (err) {
        console.error(`[AUTH] ERROR: bcrypt.compare failed: ${err.message}`);
        return res.status(500).json({ error: 'Internal server error.' });
    }

    if (!match) {
        return res.status(401).json({ error: 'Invalid password.' });
    }

    // Generate a 32-byte cryptographically random session token
    const token = generateToken();
    sessionTokens.set(token, { createdAt: Date.now() });

    // Set HTTP-only, SameSite=Strict cookie valid for 24 hours
    res.cookie('session', token, { httpOnly: true, sameSite: 'strict', maxAge: 86400000, path: '/' });

    return res.status(200).json({});
});

/**
 * POST /api/auth/logout
 * Invalidates the session token (if present and known) and clears the cookie.
 * Always returns 200 {} — callers must not depend on a 401 here.
 * Validates: Requirements 1.5, 3.3, 3.5
 */
app.post('/api/auth/logout', (req, res) => {
    const token = req.cookies?.session;
    if (token && sessionTokens.has(token)) {
        sessionTokens.delete(token);
    }
    res.clearCookie('session', { httpOnly: true, sameSite: 'strict', path: '/' });
    return res.status(200).json({});
});

/**
 * GET /api/auth/status
 * Returns 200 { authenticated: true } when the session cookie is present,
 * found in the token store, and not older than 24 hours.
 * Returns 401 { error: 'Not authenticated.' } in all other cases.
 * Validates: Requirements 4.1, 4.2, 4.3, 4.8
 */
app.get('/api/auth/status', (req, res) => {
    const token = req.cookies?.session;
    if (!token) return res.status(401).json({ error: 'Not authenticated.' });

    const entry = sessionTokens.get(token);
    if (!entry) return res.status(401).json({ error: 'Not authenticated.' });

    const age = Date.now() - entry.createdAt;
    if (age > 24 * 60 * 60 * 1000) {
        sessionTokens.delete(token);
        return res.status(401).json({ error: 'Not authenticated.' });
    }

    return res.status(200).json({ authenticated: true });
});

/**
 * POST /api/auth/request-reset
 * Generates a cryptographically secure 32-byte hex reset token, writes it to
 * auth.json alongside its generation timestamp (overwriting any previous reset
 * token), and responds with the file path so the user can read the token.
 * Does NOT require authentication — the user may be locked out.
 * Validates: Requirements 5.1, 5.2, 5.3
 */
app.post('/api/auth/request-reset', (req, res) => {
    // Generate a 32-byte cryptographically secure reset token (64-char hex)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenTimestamp = Date.now();

    // Read the current auth.json so we preserve existing fields (e.g. passwordHash)
    let currentData;
    try {
        const raw = fs.readFileSync(AUTH_FILE_PATH, 'utf8');
        currentData = JSON.parse(raw);
    } catch (err) {
        console.error(`[AUTH] ERROR: Could not read credentials file during request-reset: ${err.message}`);
        return res.status(500).json({ error: 'Internal server error.' });
    }

    // Overwrite any previous reset token with the newly generated one
    const updatedData = {
        ...currentData,
        resetToken,
        resetTokenTimestamp,
    };

    try {
        fs.writeFileSync(AUTH_FILE_PATH, JSON.stringify(updatedData, null, 2), 'utf8');
    } catch (err) {
        console.error(`[AUTH] ERROR: Could not write reset token to credentials file: ${err.message}`);
        return res.status(500).json({ error: 'Internal server error.' });
    }

    return res.status(200).json({
        message: 'Reset token written to auth.json. Use it with POST /api/auth/reset-password within 15 minutes.',
        credentialsFilePath: AUTH_FILE_PATH,
    });
});

/**
 * POST /api/auth/reset-password
 * Validates the reset token and new password, then atomically rewrites auth.json
 * with the new bcrypt hash and no reset token fields. Invalidates all sessions.
 * Does NOT require authentication — the user may be locked out.
 * Validates: Requirements 5.4, 5.5, 5.6, 5.7, 5.8, 5.9
 */
app.post('/api/auth/reset-password', async (req, res) => {
    const { token, newPassword } = req.body || {};

    // Validate newPassword length (8–128 characters)
    if (
        !newPassword ||
        typeof newPassword !== 'string' ||
        newPassword.length < 8 ||
        newPassword.length > 128
    ) {
        return res.status(400).json({ error: 'Password must be between 8 and 128 characters.' });
    }

    // Read auth.json and validate the reset token
    let currentData;
    try {
        const raw = fs.readFileSync(AUTH_FILE_PATH, 'utf8');
        currentData = JSON.parse(raw);
    } catch (err) {
        console.error(`[AUTH] ERROR: Could not read credentials file during reset-password: ${err.message}`);
        return res.status(500).json({ error: 'Password reset failed during file read. No changes were committed.' });
    }

    // Validate token matches and is within 15 minutes
    const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
    const tokenAge = Date.now() - (currentData.resetTokenTimestamp || 0);
    if (
        !token ||
        typeof token !== 'string' ||
        !currentData.resetToken ||
        token !== currentData.resetToken ||
        tokenAge > FIFTEEN_MINUTES_MS
    ) {
        return res.status(400).json({ error: 'Reset token is invalid or has expired.' });
    }

    // Hash the new password with bcrypt cost 10
    let newHash;
    try {
        newHash = await bcrypt.hash(newPassword, 10);
    } catch (err) {
        console.error(`[AUTH] ERROR: bcrypt.hash failed during reset-password: ${err.message}`);
        return res.status(500).json({ error: 'Password reset failed during hashing. No changes were committed.' });
    }

    // Build the updated credentials object — no resetToken or resetTokenTimestamp
    const updatedData = { passwordHash: newHash };

    // Atomically write to a temp file then rename to auth.json
    const TEMP_FILE_PATH = AUTH_FILE_PATH + '.tmp';
    try {
        fs.writeFileSync(TEMP_FILE_PATH, JSON.stringify(updatedData, null, 2), 'utf8');
    } catch (err) {
        console.error(`[AUTH] ERROR: Could not write temp credentials file during reset-password: ${err.message}`);
        return res.status(500).json({ error: 'Password reset failed during file write. No changes were committed.' });
    }

    try {
        fs.renameSync(TEMP_FILE_PATH, AUTH_FILE_PATH);
    } catch (err) {
        console.error(`[AUTH] ERROR: Could not rename temp credentials file during reset-password: ${err.message}`);
        // Attempt to clean up the temp file; ignore errors
        try { fs.unlinkSync(TEMP_FILE_PATH); } catch (_) {}
        return res.status(500).json({ error: 'Password reset failed during file rename. No changes were committed.' });
    }

    // Invalidate all active sessions
    try {
        sessionTokens.clear();
    } catch (err) {
        console.error(`[AUTH] ERROR: Could not clear session tokens during reset-password: ${err.message}`);
        return res.status(500).json({ error: 'Password reset failed during session invalidation. No changes were committed.' });
    }

    return res.status(200).json({ message: 'Password updated. All sessions have been invalidated.' });
});

// API endpoint to get the latest option chain data
app.get('/api/option-chain', requireAuth, async (req, res) => {
    try {
        const data = await fetchOptionChainData(req.query.expiry);
        res.json(data);
    } catch (error) {
        console.error('API error:', error.message);
        // If we have any cached data, send it with warning headers (may be stale)
        if (lastOptionChainData && lastSuccessfulFetch) {
            res.setHeader('X-Data-Source', 'cache');
            res.setHeader('X-Cache-Age', Math.floor((Date.now() - lastSuccessfulFetch) / 1000));
            res.setHeader('X-Cache-Stale', 'true');
            res.setHeader('X-Error-Detail', error.message);
            res.json(lastOptionChainData);
            return;
        }

        // No cached data to serve — return 503 with diagnostic info
        res.status(503).json({
            error: 'Service temporarily unavailable',
            message: 'Unable to fetch fresh data from NSE',
            retryAfter: '30 seconds',
            detail: error.message
        });
    }
});

// API endpoint to get expiry dates
app.get('/api/expiry-dates', requireAuth, async (req, res) => {
    try {
        await refreshSession();

        const contractResponse = await axios.get('https://www.nseindia.com/api/option-chain-contract-info?symbol=NIFTY', {
            headers: {
                ...DEFAULT_HEADERS,
                'Accept': 'application/json, text/plain, */*',
                'Referer': 'https://www.nseindia.com/option-chain',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        if (!contractResponse.data || !contractResponse.data.expiryDates) {
            throw new Error('Invalid expiry dates received from NSE');
        }

        res.json({ expiryDates: contractResponse.data.expiryDates });
    } catch (error) {
        console.error('Error fetching expiry dates:', error.message);
        res.status(500).json({ error: 'Failed to fetch expiry dates' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        lastFetch: lastSuccessfulFetch ? new Date(lastSuccessfulFetch).toISOString() : null,
        sessionAge: sessionTimestamp ? Math.floor((Date.now() - sessionTimestamp) / 1000) : null
    });
});

// Manual session refresh endpoint (useful for debugging)
app.post('/api/refresh-session', requireAuth, async (req, res) => {
    try {
        await refreshSession();
        res.json({ status: 'ok', message: 'Session refreshed' });
    } catch (err) {
        console.error('Manual refresh failed:', err.message);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Start server (only when run directly, not when required for testing)
if (require.main === module) {
    app.listen(port, async () => {
        console.log(`Server running at http://localhost:${port}`);
        try {
            // Initial session setup
            await refreshSession();
            // Fetch initial data
            await fetchOptionChainData();
            console.log('Initial fetch completed successfully');
        } catch (error) {
            console.error('Initial setup failed:', error.message);
            console.log('Server will retry on first request');
        }
    });
}

// ---------------------------------------------------------------------------
// Exports (for testing only — does not affect normal server operation)
// ---------------------------------------------------------------------------
module.exports = { validateCredentialsFile, sessionTokens, requireAuth, generateToken, app };
